import { syncTeamSeats } from "./team-seats";
import { randomUUID } from "node:crypto";
import type { BillingSettings } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { paymentProvider, type PaymentEvent, type PaymentRefs } from "@/lib/payments";
import { hasSubscription, subscriptionRuleOn, NEEDS_SUBSCRIPTION } from "@/lib/subscription";
import { AUTO_MONTHLY_CAPS, AUTO_THRESHOLDS, CUSTOM_PACK_ID, creditPacks, productById } from "@/lib/plans";

// Money settings per person: the auto top-up choice, and what the payment provider told us when they paid, so a top-up can be charged to the same
// saved card later. No card number is ever stored here.

export const creditsOn = () => process.env.CREDITS_ENABLED === "1";
const DAY = 24 * 3600 * 1000;
const PENDING_WAIT = 30 * 60_000;
const NOT_OFF_SESSION = "Your saved card is not set up for automatic charges, so auto top-up was switched off. Buy credits once with the card you want to use, then switch it on again.";
const DECLINED = "The last automatic top-up could not be charged, so auto top-up was switched off. Check your card and switch it on again.";
const NEEDS_ACTION = "Your bank asked you to confirm the last automatic top-up. Confirm it to receive the credits; auto top-up waits until then.";
const ACTION_WAIT = DAY;

export type AutoTopupView = { enabled: boolean; packId: string; credits: number | null; threshold: number; maxPerMonth: number; hasCard: boolean; lastError: string | null; usedThisMonth: number; actionUrl: string | null };

export async function usedThisMonth(userId: string): Promise<number> {
  return db.creditLedger.count({ where: { userId, reason: "PURCHASE", note: { startsWith: "Auto top-up" }, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } });
}

export function viewOf(s: BillingSettings | null, used = 0): AutoTopupView {
  return {
    enabled: s?.autoEnabled ?? false,
    packId: s?.autoPack ?? "topup_2000",
    credits: s?.autoCredits ?? null,
    threshold: s?.autoThreshold ?? 250,
    maxPerMonth: s?.autoMaxPerMonth ?? 3,
    hasCard: Boolean(s?.providerMemberId && s?.providerPaymentMethod),
    lastError: s?.autoLastError ?? null,
    usedThisMonth: used,
    actionUrl: s?.autoActionUrl ?? null,
  };
}

export async function getAutoTopup(userId: string): Promise<AutoTopupView> {
  const [s, used] = await Promise.all([db.billingSettings.findUnique({ where: { userId } }), usedThisMonth(userId)]);
  return viewOf(s, used);
}

export type AutoTopupInput = { enabled?: unknown; packId?: unknown; credits?: unknown; threshold?: unknown; maxPerMonth?: unknown };

/** Validates and saves the person's choice. Anything outside the offered options is refused, never rounded. */
export async function saveAutoTopup(userId: string, input: AutoTopupInput): Promise<{ ok: true; view: AutoTopupView } | { ok: false; error: string }> {
  const prev = await db.billingSettings.findUnique({ where: { userId } });
  const cur = viewOf(prev);
  if (input.enabled === true && subscriptionRuleOn() && !(await hasSubscription(userId))) return { ok: false, error: NEEDS_SUBSCRIPTION };
  const enabled = input.enabled === undefined ? cur.enabled : input.enabled === true;
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") return { ok: false, error: "Switch must be on or off." };
  const packId = input.packId === undefined ? cur.packId : input.packId;
  // A custom amount is saved with its credits (checked against the allowed range); a fixed pack clears it.
  const credits = packId === CUSTOM_PACK_ID ? (input.credits === undefined ? cur.credits : input.credits) : null;
  if (typeof packId !== "string" || !(creditPacks.some((p) => p.id === packId) || (packId === CUSTOM_PACK_ID && productById(CUSTOM_PACK_ID, credits)))) return { ok: false, error: packId === CUSTOM_PACK_ID ? "Choose an amount of credits inside the allowed range." : "Choose one of the credit packs." };
  const threshold = input.threshold === undefined ? cur.threshold : input.threshold;
  if (typeof threshold !== "number" || !(AUTO_THRESHOLDS as readonly number[]).includes(threshold)) return { ok: false, error: "Choose one of the listed amounts." };
  const maxPerMonth = input.maxPerMonth === undefined ? cur.maxPerMonth : input.maxPerMonth;
  if (typeof maxPerMonth !== "number" || !(AUTO_MONTHLY_CAPS as readonly number[]).includes(maxPerMonth)) return { ok: false, error: "Choose one of the listed limits." };
  const data = { autoEnabled: enabled, autoPack: packId, autoCredits: credits as number | null, autoThreshold: threshold, autoMaxPerMonth: maxPerMonth, ...(enabled && !cur.enabled ? { autoLastError: null } : {}) };
  const row = await db.billingSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { ok: true, view: viewOf(row, await usedThisMonth(userId)) };
}

/** Remembers who paid and with what, from a successful payment (only what the provider actually sent; never overwrites with nothing).
 * The membership id is kept only for a plan payment: a one-time top-up has its own membership, and the saved id must stay the subscription's
 * (it finds the owner of a renewal, ends the plan when the account is deleted, and matches the "subscription ended" event). */
export async function rememberRefs(userId: string, refs: PaymentRefs | undefined, isPlan = false): Promise<void> {
  if (!refs) return;
  // The first card ever used becomes the default; a later payment or a newly added card never replaces a default the person has.
  const current = await db.billingSettings.findUnique({ where: { userId }, select: { providerPaymentMethod: true } });
  const data = {
    ...(refs.memberId ? { providerMemberId: refs.memberId } : {}),
    ...(refs.paymentMethodId && !current?.providerPaymentMethod ? { providerPaymentMethod: refs.paymentMethodId } : {}),
    ...(refs.membershipId && isPlan ? { providerMembershipId: refs.membershipId } : {}),
  };
  if (!Object.keys(data).length) return;
  await db.billingSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** Whose subscription a provider membership id is (a renewal that arrives without our own metadata). */
async function ownerOfMembership(membershipId: string | undefined): Promise<string | null> {
  if (!membershipId) return null;
  const row = await db.billingSettings.findFirst({ where: { providerMembershipId: membershipId }, select: { userId: true } });
  return row?.userId ?? null;
}

/** Grants the credits for one successful payment (a plan or a top-up pack), once however often the provider delivers it. Also handles the
 * provider saying a subscription ended, and a refund (the credits that payment granted are taken back, as far as they are still there). */
export async function applyPayment(event: PaymentEvent & { auto?: boolean }): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  if (event.cardOnly) {
    const owner = event.userId || (event.refs?.memberId ? (await db.billingSettings.findFirst({ where: { providerMemberId: event.refs.memberId }, select: { userId: true } }))?.userId : null);
    if (!owner) return { ok: false, error: "Unknown customer" };
    await rememberRefs(owner, event.refs);
    return { ok: true, duplicate: false };
  }
  if (event.kind === "deactivated" || event.kind === "activated") {
    // Only the subscription we saved counts: a top-up's own membership, an old subscription after a new one, or one we never saw changes nothing.
    const owner = await ownerOfMembership(event.refs?.membershipId);
    if (!owner) return { ok: true, duplicate: false };
    const at = event.at ?? new Date();
    if (event.kind === "deactivated") await db.billingSettings.update({ where: { userId: owner }, data: { subscriptionEndedAt: at, autoEnabled: false } });
    // Deliveries can arrive out of order: an "active" update older than the end we recorded does not undo it.
    else await db.billingSettings.updateMany({ where: { userId: owner, subscriptionEndedAt: { lt: at } }, data: { subscriptionEndedAt: null } });
    return { ok: true, duplicate: false };
  }
  if (event.kind === "failed" || event.kind === "action") {
    const owner = (await db.billingSettings.findFirst({ where: { autoPendingPaymentId: event.externalId }, select: { userId: true } }))?.userId ?? (event.auto && event.userId ? event.userId : null);
    if (!owner) return { ok: true, duplicate: false }; // a checkout the person was present for: Whop shows them the error itself
    if (event.kind === "failed") await db.billingSettings.updateMany({ where: { userId: owner }, data: { autoEnabled: false, autoLastError: DECLINED, autoPendingPaymentId: null, autoPendingAt: null, autoActionUrl: null } });
    // 3D Secure: auto top-up stays on; the person confirms with their bank and payment.succeeded grants the credits.
    else await db.billingSettings.updateMany({ where: { userId: owner }, data: { autoLastError: NEEDS_ACTION, autoActionUrl: event.actionUrl ?? null, autoPendingPaymentId: event.externalId, autoPendingAt: new Date() } });
    return { ok: true, duplicate: false };
  }
  if (event.kind === "refund") return applyRefund(event);
  const product = productById(event.planId, event.credits);
  if (!product) return { ok: false, error: "Unknown plan" };
  const userId = event.userId || (await ownerOfMembership(event.refs?.membershipId));
  if (!userId) return { ok: false, error: "Unknown customer" };
  const note = event.auto ? `Auto top-up: ${product.name}` : product.kind === "pack" ? `Top-up: ${product.name}` : `Plan: ${product.name}`;
  const added = await grantCredits(userId, product.credits, { reason: "PURCHASE", provider: event.provider, externalId: event.externalId, note });
  if (event.auto) await db.billingSettings.updateMany({ where: { userId }, data: { autoPendingPaymentId: null, autoPendingAt: null, autoActionUrl: null, autoLastError: null } }); // confirmed
  if (product.kind === "plan") await db.billingSettings.updateMany({ where: { userId }, data: { subscriptionEndedAt: null } }); // paid again: active
  if (product.kind === "plan") await syncTeamSeats(userId, product.id); // a team's member limit follows its plan (no-op for a person)
  await rememberRefs(userId, event.refs, product.kind === "plan").catch((e) => console.error("could not save payment references", e));
  return { ok: true, duplicate: !added };
}

/** Takes back the credits a refunded payment granted: the refunded share of them (a partial refund takes back part), as far as they are still
 * there. Several refunds of one payment never take back more than it granted. A refund that arrives before its payment is answered with an
 * error so the provider delivers it again later. */
async function applyRefund(event: PaymentEvent): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  const paid = await db.creditLedger.findFirst({ where: { provider: event.provider, externalId: event.refundOf ?? "" } });
  if (!paid) return { ok: false, error: "Refund for a payment not recorded yet" };
  if (paid.delta <= 0) return { ok: true, duplicate: false }; // nothing was granted for it
  let share = 1;
  if (event.refundAmount !== undefined && event.paymentTotal) share = Math.min(1, event.refundAmount / event.paymentTotal);
  else console.error("PAYMENT ALERT: refund without an amount or payment total, the whole grant is taken back", event.externalId);
  const done = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paid.userId}))`; // the same lock spending takes
    if (await tx.creditLedger.findFirst({ where: { provider: event.provider, externalId: event.externalId } })) return false;
    const before = await tx.creditLedger.aggregate({ where: { provider: event.provider, externalId: { startsWith: `refund:${event.refundOf}:` } }, _sum: { delta: true } });
    const left = paid.delta + (before._sum.delta ?? 0); // earlier refunds of this payment are negative rows
    const sum = await tx.creditLedger.aggregate({ where: { userId: paid.userId }, _sum: { delta: true } });
    // never below zero: credits already spent cannot be taken back
    const take = Math.max(0, Math.min(Math.round(paid.delta * share), left, Math.max(0, sum._sum.delta ?? 0)));
    await tx.creditLedger.create({ data: { userId: paid.userId, delta: -take, reason: "ADJUST", provider: event.provider, externalId: event.externalId, note: `Refund: ${paid.note ?? "purchase"}` } });
    return true;
  });
  return { ok: true, duplicate: !done };
}

/**
 * Tops up automatically when the person has asked for it, has a saved card, and their free credits are below their limit (or below `needed`, the
 * price of the job they just tried to start). Returns true only when credits were added at once; with Whop the charge is confirmed later by the
 * payment.succeeded webhook, so this starts the charge and returns false (the job that triggered it is refused this time). Never throws: a failure switches auto top-up off and says why.
 * Guards: one attempt at a time per person (a 2 minute claim), a monthly limit of their choosing, and a hard cap of 3 a day.
 */
export async function autoTopup(userId: string, opts: { needed?: number } = {}): Promise<boolean> {
  try {
    if (!creditsOn()) return false;
    const s = await db.billingSettings.findUnique({ where: { userId } });
    if (!s?.autoEnabled || !s.providerMemberId || !s.providerPaymentMethod) return false;
    if (subscriptionRuleOn() && !(await hasSubscription(userId))) return false; // top-ups are for subscribers: never charge a card that could not use the credits
    // A charge already started and not yet confirmed: wait for its webhook rather than charging again. After 30 minutes it is given up on.
    if (s.autoPendingAt && Date.now() - s.autoPendingAt.getTime() < (s.autoActionUrl ? ACTION_WAIT : PENDING_WAIT)) return false;
    if (s.autoPendingAt) console.error("PAYMENT ALERT: an automatic top-up was never confirmed", userId, s.autoPendingPaymentId);
    const provider = paymentProvider();
    if (!provider?.chargeSavedCard) return false;
    const pack = s.autoPack === CUSTOM_PACK_ID ? productById(CUSTOM_PACK_ID, s.autoCredits) : creditPacks.find((p) => p.id === s.autoPack);
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

    // Only a card the person saved for charging without them present may be charged here.
    if (provider.listPaymentMethods) {
      let offSession;
      try { offSession = await provider.listPaymentMethods(s.providerMemberId, { offSessionOnly: true }); }
      catch (err) { console.error("auto top-up could not check the saved card", userId, err); return false; }
      if (!offSession.some((c) => c.id === s.providerPaymentMethod)) {
        await db.billingSettings.update({ where: { userId }, data: { autoEnabled: false, autoLastError: NOT_OFF_SESSION } });
        return false;
      }
    }

    let charge;
    try {
      charge = await provider.chargeSavedCard({ userId, productId: pack.id, ...(pack.id === CUSTOM_PACK_ID ? { credits: pack.credits } : {}), price: pack.price, memberId: s.providerMemberId, paymentMethodId: s.providerPaymentMethod, idempotencyKey: `auto-${userId}-${randomUUID()}` });
    } catch (err) {
      console.error("auto top-up charge failed", userId, err);
      await db.billingSettings.update({ where: { userId }, data: { autoEnabled: false, autoLastError: DECLINED } });
      return false;
    }
    if (charge.status !== "paid") { // the provider confirms by webhook, which grants the credits (once); Whop always answers this way
      await db.billingSettings.update({ where: { userId }, data: { autoLastError: null, autoActionUrl: null, autoPendingPaymentId: charge.externalId, autoPendingAt: new Date() } });
      return false;
    }
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
  if (r.cards.length < 2) return { ok: false, error: "This is your only saved card. Add another card before removing it.", status: 409 };
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
