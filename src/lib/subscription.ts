import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creditState } from "@/lib/expiry";
import { heldNow } from "@/lib/held";

// Top-up credits need a subscription to be USED. They are never taken away: bought credits stay in the balance, and spending them is locked while
// the plan has lapsed. A person is subscribed while their latest plan payment is recent (a monthly plan renews every month, so the window is a
// month plus a few days of grace), unless the provider has since said the subscription ended (BillingSettings.subscriptionEndedAt). Credits from other sources (plan credits, owner grants, refunds) are not affected.
// Switch the whole rule off with TOPUP_REQUIRES_SUBSCRIPTION=off.

const DAY = 24 * 3600 * 1000;
type Client = Prisma.TransactionClient | typeof db;

export const subscriptionRuleOn = () => process.env.TOPUP_REQUIRES_SUBSCRIPTION !== "off";
export const subscriptionDays = () => { const n = Number(process.env.SUBSCRIPTION_DAYS); return Number.isFinite(n) && n >= 1 ? n : 33; };

/** The name of the plan (as written on the ledger: "Starter", "Growth", "Scale") while a plan payment is recent and the provider has not ended it, else null. */
export async function currentPlanName(userId: string, client: Client = db): Promise<string | null> {
  const row = await client.creditLedger.findFirst({
    where: { userId, reason: "PURCHASE", note: { startsWith: "Plan:" }, createdAt: { gte: new Date(Date.now() - subscriptionDays() * DAY) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, note: true },
  });
  if (!row) return null;
  // The provider told us the subscription ended after its latest payment (cancelled and run out, or payment failed for good).
  const s = await client.billingSettings.findUnique({ where: { userId }, select: { subscriptionEndedAt: true } });
  if (s?.subscriptionEndedAt && s.subscriptionEndedAt > row.createdAt) return null;
  return (row.note ?? "").replace(/^Plan:\s*/, "").trim() || null;
}

/** True while a plan payment has been received within the subscription window. */
export async function hasSubscription(userId: string, client: Client = db): Promise<boolean> {
  return (await currentPlanName(userId, client)) !== null;
}

/**
 * How many of the person's credits came from top-ups and are still unspent and unexpired. Spending takes plan credits first, other credits next and top-up credits last
 * (expiry.ts replays the ledger to know). People who never bought anything cost one cheap count.
 */
export async function topupRemaining(userId: string, client: Client = db): Promise<number> {
  if (!(await client.creditLedger.count({ where: { userId, reason: "PURCHASE" } }))) return 0;
  return (await creditState(userId, client)).topup;
}

/** Credits in the balance that cannot be spent right now: top-up credits while there is no subscription (`locked`), and credits whose time ran out that the expiry job has not removed yet (`expired`). */
export async function unusable(userId: string, client: Client = db): Promise<{ locked: number; expired: number }> {
  if (!(await client.creditLedger.count({ where: { userId, reason: "PURCHASE" } }))) return { locked: 0, expired: 0 };
  const state = await creditState(userId, client);
  const locked = subscriptionRuleOn() && state.topup > 0 && !(await hasSubscription(userId, client)) ? state.topup : 0;
  // Credits that ran out of time while a running job holds its price still pay for that job (the hold stays valid); they are removed once it settles.
  const expired = state.expiredUnswept > 0 ? Math.max(0, state.expiredUnswept - (await heldNow(client, userId))) : 0;
  return { locked, expired };
}

/** Top-up credits the person cannot spend right now (0 when subscribed, when the rule is off, or when they have none). */
export async function lockedTopup(userId: string, client: Client = db): Promise<number> {
  return (await unusable(userId, client)).locked;
}

export const NEEDS_SUBSCRIPTION = "Top-ups are for subscribers. Subscribe to a plan first, then you can top up.";
