import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Credit expiry (owner addendum to the pricing master brief, 2026-10-20):
//  1. PLAN credits expire at the end of the period that granted them (the plan period plus a few days of grace) and never roll over: when the next plan payment
//     arrives, whatever is left of the previous plan grant is removed.
//  2. TOP-UP credits expire 90 days after purchase and can only be SPENT while subscribed (subscription.ts).
//  3. Spend order: plan credits first (the ones that expire first), then credits that never expire (owner grants, refunds), then top-up credits, oldest first.
// The append-only ledger stays the single source of truth. A "grant" is a positive ledger row; what is left of each grant (and when it expires) is worked out by
// replaying the ledger in order, so there is no second balance to drift and nothing to migrate. The expiry job writes one negative EXPIRE row per expired grant
// (externalId expire:<grant id>, unique, so running it twice does the same as once). Nothing expires until the Config value CREDIT_EXPIRY_START (a date) is set.

const DAY = 24 * 3600 * 1000;
export type Source = "plan" | "topup" | "other";
export type Grant = { id: string; source: Source; amount: number; remaining: number; createdAt: number; expiresAt: number }; // expiresAt = Infinity when it never expires
export type LedgerRow = { id: string; delta: number; reason: string; note: string | null; externalId: string | null; createdAt: Date };
export type ExpiryRules = { start: number | null; planDays: number; topupDays: number; graceDays: number };

const num = (name: string, fallback: number) => { const n = Number(process.env[name]); return Number.isFinite(n) && n >= 1 ? n : fallback; };
/** The rules from Config values. `start` is null (nothing expires) until CREDIT_EXPIRY_START is set to a date. */
export function expiryRules(): ExpiryRules {
  const raw = process.env.CREDIT_EXPIRY_START;
  const t = raw ? Date.parse(raw) : NaN;
  return { start: Number.isFinite(t) ? t : null, planDays: num("CREDIT_PLAN_DAYS", num("SUBSCRIPTION_DAYS", 33)), topupDays: num("CREDIT_TOPUP_DAYS", 90), graceDays: num("CREDIT_EXPIRY_GRACE_DAYS", 7) };
}

export const sourceOf = (r: { reason: string; note: string | null }): Source =>
  r.reason === "PURCHASE" && r.note?.startsWith("Plan:") ? "plan"
  : r.reason === "PURCHASE" && (r.note?.startsWith("Top-up:") || r.note?.startsWith("Auto top-up:")) ? "topup"
  : "other";

export type ReplayResult = {
  grants: Grant[];
  /** Unspent credits whose expiry time has passed and that the expiry job has not removed yet (they are no longer spendable). */
  expiredUnswept: number;
  /** Unspent, unexpired top-up credits. */
  topup: number;
  /** The earliest expiry among unspent plan and top-up credits, with how many expire then. */
  next: { at: number; amount: number } | null;
};

/** Pure: replays ledger rows (oldest first, as sorted below) into grants with what is left of each. */
export function replayLedger(input: LedgerRow[], rules: ExpiryRules, now: number): ReplayResult {
  const rows = input.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || b.delta - a.delta || (a.id < b.id ? -1 : 1));
  const grants = new Map<string, Grant>();
  const planIds: string[] = [];
  const startGrace = rules.start == null ? null : rules.start + rules.graceDays * DAY;
  for (const r of rows) {
    if (r.delta <= 0) continue;
    const source = sourceOf(r);
    const created = r.createdAt.getTime();
    grants.set(r.id, { id: r.id, source, amount: r.delta, remaining: r.delta, createdAt: created, expiresAt: Infinity });
    if (source === "plan") planIds.push(r.id);
  }
  if (rules.start != null) {
    planIds.forEach((id, i) => {
      const g = grants.get(id)!;
      let exp = g.createdAt + rules.planDays * DAY;
      const next = grants.get(planIds[i + 1] ?? "");
      if (next) exp = Math.min(exp, next.createdAt); // no rollover: the next plan payment removes what is left
      if (g.createdAt < rules.start!) exp = Math.max(exp, startGrace!); // a balance from before the rule gets a short grace, never an instant wipe
      g.expiresAt = exp;
    });
    for (const g of grants.values()) if (g.source === "topup") g.expiresAt = Math.max(g.createdAt, rules.start) + rules.topupDays * DAY;
  }
  const seen: Grant[] = [];
  const order = (t: number) => {
    const live = seen.filter((g) => g.remaining > 0 && g.expiresAt > t);
    const by = (s: Source) => live.filter((g) => g.source === s).sort((a, b) => a.expiresAt - b.expiresAt || a.createdAt - b.createdAt);
    return [...by("plan"), ...by("other"), ...by("topup")];
  };
  for (const r of rows) {
    const t = r.createdAt.getTime();
    if (r.delta > 0) { seen.push(grants.get(r.id)!); continue; }
    if (r.reason === "EXPIRE") { const g = grants.get((r.externalId ?? "").replace(/^expire:/, "")); if (g) g.remaining = 0; continue; }
    let need = -r.delta;
    for (const g of order(t)) { if (need <= 0) break; const take = Math.min(g.remaining, need); g.remaining -= take; need -= take; }
    // A charge the live grants cannot cover was authorised while a job held its price: credits that ran out meanwhile still pay for it (soonest expiry first).
    if (need > 0) for (const g of seen.filter((x) => x.remaining > 0).sort((a, b) => a.expiresAt - b.expiresAt)) { if (need <= 0) break; const take = Math.min(g.remaining, need); g.remaining -= take; need -= take; }
  }
  const all = [...grants.values()];
  const expiredUnswept = all.filter((g) => g.remaining > 0 && g.expiresAt <= now).reduce((a, g) => a + g.remaining, 0);
  const topup = all.filter((g) => g.source === "topup" && g.remaining > 0 && g.expiresAt > now).reduce((a, g) => a + g.remaining, 0);
  const expiring = all.filter((g) => g.source !== "other" && g.remaining > 0 && g.expiresAt > now && Number.isFinite(g.expiresAt)).sort((a, b) => a.expiresAt - b.expiresAt);
  const next = expiring.length ? { at: expiring[0].expiresAt, amount: expiring.filter((g) => g.expiresAt === expiring[0].expiresAt).reduce((a, g) => a + g.remaining, 0) } : null;
  return { grants: all, expiredUnswept, topup, next };
}

type Client = Prisma.TransactionClient | typeof db;
export async function creditState(userId: string, client: Client = db, now = Date.now(), rules = expiryRules()): Promise<ReplayResult> {
  const rows = await client.creditLedger.findMany({ where: { userId }, select: { id: true, delta: true, reason: true, note: true, externalId: true, createdAt: true } });
  return replayLedger(rows, rules, now);
}

/** What is left of each unexpired plan or top-up grant, for the Billing list. */
export const liveGrants = (state: ReplayResult, now = Date.now()) =>
  state.grants.filter((g) => g.remaining > 0 && g.expiresAt > now && g.source !== "other").sort((a, b) => a.expiresAt - b.expiresAt)
    .map((g) => ({ source: g.source, amount: g.amount, remaining: g.remaining, grantedAt: new Date(g.createdAt).toISOString(), expiresAt: Number.isFinite(g.expiresAt) ? new Date(g.expiresAt).toISOString() : null }));

/** Writes one EXPIRE row for every grant of this person that has run out of time (idempotent: the unique external id makes a second run a no-op). Returns credits removed. */
export async function expireCredits(userId: string, now = Date.now()): Promise<number> {
  const rules = expiryRules();
  if (rules.start == null || now < rules.start) return 0;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`; // the lock every spend takes
    const state = await creditState(userId, tx, now, rules);
    let removed = 0;
    for (const g of state.grants) {
      if (g.remaining <= 0 || g.expiresAt > now) continue;
      const already = await tx.creditLedger.findFirst({ where: { provider: "expiry", externalId: `expire:${g.id}` }, select: { id: true } });
      if (already) continue;
      await tx.creditLedger.create({ data: { userId, delta: -g.remaining, reason: "EXPIRE", provider: "expiry", externalId: `expire:${g.id}`, note: g.source === "plan" ? "Plan credits expired (they renew monthly and do not roll over)" : "Top-up credits expired (they last 90 days)" } });
      removed += g.remaining;
    }
    return removed;
  });
}

/** The people whose credits may have run out of time: anyone with a plan or top-up purchase old enough to have a grant past its date. */
export async function usersToExpire(now = Date.now(), limit = 5000): Promise<string[]> {
  const rules = expiryRules();
  if (rules.start == null || now < rules.start) return [];
  const rows = await db.creditLedger.findMany({ where: { reason: "PURCHASE", createdAt: { lte: new Date(now - 1 * DAY) } }, distinct: ["userId"], select: { userId: true }, take: limit });
  return rows.map((r) => r.userId);
}

/** The owner's dry run: what would expire if the rule started on `start`. Reads only; writes nothing. */
export async function expiryDryRun(start: number, limit = 5000) {
  const rules: ExpiryRules = { ...expiryRules(), start };
  const people = await db.creditLedger.findMany({ where: { reason: "PURCHASE" }, distinct: ["userId"], select: { userId: true }, take: limit });
  const checkpoints = [1, rules.graceDays + 1, 40, rules.topupDays + 1].map((d) => ({ days: d, accounts: 0, credits: 0 }));
  let withCredits = 0;
  for (const { userId } of people) {
    const rows = await db.creditLedger.findMany({ where: { userId }, select: { id: true, delta: true, reason: true, note: true, externalId: true, createdAt: true } });
    const balance = rows.reduce((a: number, r) => a + r.delta, 0);
    if (balance <= 0) continue;
    withCredits++;
    for (const c of checkpoints) {
      const gone = replayLedger(rows, rules, start + c.days * DAY).expiredUnswept;
      if (gone > 0) { c.accounts++; c.credits += gone; }
    }
  }
  return { start, accountsChecked: people.length, accountsWithCredits: withCredits, checkpoints };
}
