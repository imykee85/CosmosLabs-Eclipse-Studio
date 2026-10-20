import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Top-up credits need a subscription to be USED. They are never taken away: bought credits stay in the balance, and spending them is locked while
// the plan has lapsed. A person is subscribed while their latest plan payment is recent (a monthly plan renews every month, so the window is a
// month plus a few days of grace). Credits from other sources (plan credits, owner grants, refunds) are not affected.
// Switch the whole rule off with TOPUP_REQUIRES_SUBSCRIPTION=off.

const DAY = 24 * 3600 * 1000;
type Client = Prisma.TransactionClient | typeof db;

export const subscriptionRuleOn = () => process.env.TOPUP_REQUIRES_SUBSCRIPTION !== "off";
export const subscriptionDays = () => { const n = Number(process.env.SUBSCRIPTION_DAYS); return Number.isFinite(n) && n >= 1 ? n : 33; };

const isTopupPurchase = (r: { reason: string; note: string | null }) => r.reason === "PURCHASE" && Boolean(r.note && (r.note.startsWith("Top-up:") || r.note.startsWith("Auto top-up:")));

/** True while a plan payment has been received within the subscription window. */
export async function hasSubscription(userId: string, client: Client = db): Promise<boolean> {
  const row = await client.creditLedger.findFirst({
    where: { userId, reason: "PURCHASE", note: { startsWith: "Plan:" }, createdAt: { gte: new Date(Date.now() - subscriptionDays() * DAY) } },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * How many of the person's credits came from top-ups and are still unspent. Spending takes other credits first and top-up credits last, so this is
 * worked out by replaying the ledger in order. People who never bought a top-up cost one cheap count.
 */
export async function topupRemaining(userId: string, client: Client = db): Promise<number> {
  const bought = await client.creditLedger.count({ where: { userId, reason: "PURCHASE", OR: [{ note: { startsWith: "Top-up:" } }, { note: { startsWith: "Auto top-up:" } }] } });
  if (!bought) return 0;
  const rows = await client.creditLedger.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { delta: "desc" }, { id: "asc" }], select: { delta: true, reason: true, note: true } });
  let others = 0;
  let top = 0;
  for (const r of rows) {
    if (isTopupPurchase(r)) top += r.delta;
    else if (r.delta > 0) others += r.delta;
    else {
      let need = -r.delta;
      const fromOthers = Math.min(others, need);
      others -= fromOthers;
      need -= fromOthers;
      top = Math.max(0, top - need);
    }
  }
  return top;
}

/** Top-up credits the person cannot spend right now (0 when subscribed, when the rule is off, or when they have none). */
export async function lockedTopup(userId: string, client: Client = db): Promise<number> {
  if (!subscriptionRuleOn()) return 0;
  const top = await topupRemaining(userId, client);
  if (top <= 0) return 0;
  return (await hasSubscription(userId, client)) ? 0 : top;
}

export const NEEDS_SUBSCRIPTION = "Top-ups are for subscribers. Subscribe to a plan first, then you can top up.";
