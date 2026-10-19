import { randomUUID } from "node:crypto";
import type { BillingSettings } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { paymentProvider, type PaymentEvent, type PaymentRefs } from "@/lib/payments";
import { AUTO_MONTHLY_CAPS, AUTO_THRESHOLDS, creditPacks, productById } from "@/lib/plans";

// Money settings per person: the auto top-up choice, and what the payment provider told us when they paid, so a top-up can be charged to the same
// saved card later. No card number is ever stored here.

export const creditsOn = () => process.env.CREDITS_ENABLED === "1";
const DAY = 24 * 3600 * 1000;
const DECLINED = "The last automatic top-up could not be charged, so auto top-up was switched off. Check your card and switch it on again.";

export type AutoTopupView = { enabled: boolean; packId: string; threshold: number; maxPerMonth: number; hasCard: boolean; lastError: string | null; usedThisMonth: number };

export async function usedThisMonth(userId: string): Promise<number> {
  return db.creditLedger.count({ where: { userId, reason: "PURCHASE", note: { startsWith: "Auto top-up" }, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } });
}

export function viewOf(s: BillingSettings | null, used = 0): AutoTopupView {
  return {
    enabled: s?.autoEnabled ?? false,
    packId: s?.autoPack ?? "topup_2000",
    threshold: s?.autoThreshold ?? 250,
    maxPerMonth: s?.autoMaxPerMonth ?? 3,
    hasCard: Boolean(s?.providerMemberId && s?.providerPaymentMethod),
    lastError: s?.autoLastError ?? null,
    usedThisMonth: used,
  };
}

export async function getAutoTopup(userId: string): Promise<AutoTopupView> {
  const [s, used] = await Promise.all([db.billingSettings.findUnique({ where: { userId } }), usedThisMonth(userId)]);
  return viewOf(s, used);
}

export type AutoTopupInput = { enabled?: unknown; packId?: unknown; threshold?: unknown; maxPerMonth?: unknown };

/** Validates and saves the person's choice. Anything outside the offered options is refused, never rounded. */
export async function saveAutoTopup(userId: string, input: AutoTopupInput): Promise<{ ok: true; view: AutoTopupView } | { ok: false; error: string }> {
  const prev = await db.billingSettings.findUnique({ where: { userId } });
  const cur = viewOf(prev);
  const enabled = input.enabled === undefined ? cur.enabled : input.enabled === true;
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") return { ok: false, error: "Switch must be on or off." };
  const packId = input.packId === undefined ? cur.packId : input.packId;
  if (typeof packId !== "string" || !creditPacks.some((p) => p.id === packId)) return { ok: false, error: "Choose one of the credit packs." };
  const threshold = input.threshold === undefined ? cur.threshold : input.threshold;
  if (typeof threshold !== "number" || !(AUTO_THRESHOLDS as readonly number[]).includes(threshold)) return { ok: false, error: "Choose one of the listed amounts." };
  const maxPerMonth = input.maxPerMonth === undefined ? cur.maxPerMonth : input.maxPerMonth;
  if (typeof maxPerMonth !== "number" || !(AUTO_MONTHLY_CAPS as readonly number[]).includes(maxPerMonth)) return { ok: false, error: "Choose one of the listed limits." };
  const data = { autoEnabled: enabled, autoPack: packId, autoThreshold: threshold, autoMaxPerMonth: maxPerMonth, ...(enabled && !cur.enabled ? { autoLastError: null } : {}) };
  const row = await db.billingSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { ok: true, view: viewOf(row, await usedThisMonth(userId)) };
}

/** Remembers who paid and with what, from a successful payment (only what the provider actually sent; never overwrites with nothing). */
export async function rememberRefs(userId: string, refs: PaymentRefs | undefined): Promise<void> {
  if (!refs) return;
  const data = {
    ...(refs.memberId ? { providerMemberId: refs.memberId } : {}),
    ...(refs.paymentMethodId ? { providerPaymentMethod: refs.paymentMethodId } : {}),
    ...(refs.membershipId ? { providerMembershipId: refs.membershipId } : {}),
  };
  if (!Object.keys(data).length) return;
  await db.billingSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** Grants the credits for one successful payment (a plan or a top-up pack), once however often the provider delivers it. */
export async function applyPayment(event: PaymentEvent & { auto?: boolean }): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  if (event.cardOnly) { await rememberRefs(event.userId, event.refs); return { ok: true, duplicate: false }; }
  const product = productById(event.planId);
  if (!product) return { ok: false, error: "Unknown plan" };
  const note = event.auto ? `Auto top-up: ${product.name}` : product.kind === "pack" ? `Top-up: ${product.name}` : `Plan: ${product.name}`;
  const added = await grantCredits(event.userId, product.credits, { reason: "PURCHASE", provider: event.provider, externalId: event.externalId, note });
  await rememberRefs(event.userId, event.refs).catch((e) => console.error("could not save payment references", e));
  return { ok: true, duplicate: !added };
}

/**
 * Tops up automatically when the person has asked for it, has a saved card, and their free credits are below their limit (or below `needed`, the
 * price of the job they just tried to start). Returns true when credits were added. Never throws: a failure switches auto top-up off and says why.
 * Guards: one attempt at a time per person (a 2 minute claim), a monthly limit of their choosing, and a hard cap of 3 a day.
 */
export async function autoTopup(userId: string, opts: { needed?: number } = {}): Promise<boolean> {
  try {
    if (!creditsOn()) return false;
    const s = await db.billingSettings.findUnique({ where: { userId } });
    if (!s?.autoEnabled || !s.providerMemberId || !s.providerPaymentMethod) return false;
    const provider = paymentProvider();
    if (!provider?.chargeSavedCard) return false;
    const pack = creditPacks.find((p) => p.id === s.autoPack);
    if (!pack) return false;

    const { freeCredits } = await import("@/lib/reservations");
    const free = await freeCredits(userId);
    if (free >= s.autoThreshold && free >= (opts.needed ?? 0)) return false;

    const claimed = await db.billingSettings.updateMany({
      where: { userId, OR: [{ autoLastAttemptAt: null }, { autoLastAttemptAt: { lt: new Date(Date.now() - 120_000) } }] },
      data: { autoLastAttemptAt: new Date() },
    });
    if (!claimed.count) return false;

    const month = await usedThisMonth(userId);
    const today = await db.creditLedger.count({ where: { userId, reason: "PURCHASE", note: { startsWith: "Auto top-up" }, createdAt: { gte: new Date(Date.now() - DAY) } } });
    if (month >= s.autoMaxPerMonth || today >= 3) {
      await db.billingSettings.update({ where: { userId }, data: { autoLastError: "Your limit for automatic top-ups this month is used up. Buy a pack yourself, or raise the limit." } });
      return false;
    }

    let charge;
    try {
      charge = await provider.chargeSavedCard({ userId, productId: pack.id, price: pack.price, memberId: s.providerMemberId, paymentMethodId: s.providerPaymentMethod, idempotencyKey: `auto-${userId}-${randomUUID()}` });
    } catch (err) {
      console.error("auto top-up charge failed", userId, err);
      await db.billingSettings.update({ where: { userId }, data: { autoEnabled: false, autoLastError: DECLINED } });
      return false;
    }
    if (charge.status !== "paid") return false; // the provider confirms by webhook, which grants the credits (once)
    await grantCredits(userId, pack.credits, { reason: "PURCHASE", provider: provider.name, externalId: charge.externalId, note: `Auto top-up: ${pack.name}` });
    await db.billingSettings.update({ where: { userId }, data: { autoLastError: null } });
    return true;
  } catch (err) {
    console.error("auto top-up failed", userId, err);
    return false;
  }
}

/** Called after credits are spent: tops up in the background when the balance has fallen below the person's limit. */
export function scheduleAutoTopup(userId: string): void {
  if (!creditsOn()) return;
  waitUntil(autoTopup(userId));
}


// ---- Saved cards: listed and removed at the provider; we only remember which one auto top-up uses. ----

export type CardView = { id: string; brand: string; last4: string; expMonth?: number; expYear?: number; isDefault: boolean };
export type CardsResult = { ok: true; cards: CardView[] } | { ok: false; error: string; status: number };

async function cardsFor(userId: string): Promise<{ s: BillingSettings | null; cards: CardView[] } | { error: string; status: number }> {
  const provider = paymentProvider();
  if (!provider?.listPaymentMethods) return { error: "Payments are not set up yet.", status: 503 };
  const s = await db.billingSettings.findUnique({ where: { userId } });
  if (!s?.providerMemberId) return { s, cards: [] };
  try {
    const list = await provider.listPaymentMethods(s.providerMemberId);
    return { s, cards: list.map((c) => ({ ...c, isDefault: c.id === s.providerPaymentMethod })) };
  } catch (err) {
    console.error("listing saved cards failed", err);
    return { error: "Could not load your cards. Try again in a moment.", status: 502 };
  }
}

export async function listCards(userId: string): Promise<CardsResult> {
  const r = await cardsFor(userId);
  return "error" in r ? { ok: false, ...r } : { ok: true, cards: r.cards };
}

/** Removes one of the person's own saved cards. If it was the card auto top-up uses, another card takes over, or auto top-up is switched off. */
export async function removeCard(userId: string, cardId: string): Promise<CardsResult> {
  const r = await cardsFor(userId);
  if ("error" in r) return { ok: false, ...r };
  const card = r.cards.find((c) => c.id === cardId);
  if (!card || !r.s?.providerMemberId) return { ok: false, error: "That card was not found.", status: 404 };
  const provider = paymentProvider()!;
  try { await provider.removePaymentMethod!(r.s.providerMemberId, cardId); }
  catch (err) { console.error("removing a saved card failed", err); return { ok: false, error: "Could not remove the card. Try again in a moment.", status: 502 }; }
  const left = r.cards.filter((c) => c.id !== cardId);
  if (card.isDefault) {
    const next = left[0]?.id ?? null;
    await db.billingSettings.update({ where: { userId }, data: { providerPaymentMethod: next, ...(next ? {} : { autoEnabled: false, autoLastError: "Your last saved card was removed, so auto top-up was switched off." }) } });
    if (next) left[0] = { ...left[0], isDefault: true };
  }
  return { ok: true, cards: left };
}

/** Chooses which saved card auto top-up charges. */
export async function setDefaultCard(userId: string, cardId: string): Promise<CardsResult> {
  const r = await cardsFor(userId);
  if ("error" in r) return { ok: false, ...r };
  if (!r.cards.some((c) => c.id === cardId)) return { ok: false, error: "That card was not found.", status: 404 };
  await db.billingSettings.update({ where: { userId }, data: { providerPaymentMethod: cardId } });
  return { ok: true, cards: r.cards.map((c) => ({ ...c, isDefault: c.id === cardId })) };
}
