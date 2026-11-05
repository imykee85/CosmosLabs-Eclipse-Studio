import { clerkClient } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
const FREE_RENDERS_DEFAULT = 2;

// The welcome offer: an account made on or after FREE_RENDERS_FROM (a date, default 2026-10-20) gets FREE_RENDERS_COUNT (default 2) free image renders on
// ANY image model (set FREE_RENDERS_MAX_CREDITS to leave out the dearest ones; unset means no limit). It only applies in the person's own workspace (never a team's), and only while
// credits are switched on (otherwise everything is free anyway). Accounts that existed before the offer get a row with nothing left, so Clerk is asked once.
export const freeRendersCount = () => (Number(process.env.FREE_RENDERS_COUNT) >= 0 && process.env.FREE_RENDERS_COUNT ? Math.floor(Number(process.env.FREE_RENDERS_COUNT)) : FREE_RENDERS_DEFAULT);
export const freeMaxCredits = () => 100000; // no cap: a free render may be on any model (FREE_RENDERS_MAX_CREDITS is ignored)
const since = () => { const t = Date.parse(process.env.FREE_RENDERS_FROM ?? "2026-10-20"); return Number.isFinite(t) ? t : Date.parse("2026-10-20"); };

const personal = (userId: string) => userId.startsWith("user_");

async function accountCreatedAt(userId: string): Promise<number | null> {
  try { return (await (await clerkClient()).users.getUser(userId)).createdAt; } catch (err) { console.error("free renders: could not read the account", userId, err); return null; }
}

/** The same inbox written in different ways is one inbox: Gmail ignores dots and +tags in the name, and +tags are ignored almost everywhere. */
export function normalizeEmail(raw: string): string {
  const [local0, domain0] = raw.trim().toLowerCase().split("@");
  if (!local0 || !domain0) return raw.trim().toLowerCase();
  let local = local0.split("+")[0], domain = domain0;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

async function accountEmail(userId: string): Promise<string | null> {
  try {
    const u = await (await clerkClient()).users.getUser(userId);
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
    return primary?.emailAddress ?? null;
  } catch { return null; }
}

/** How many free renders this person still has (0 when the offer does not apply). `createdAtOf` is for tests. */
export async function freeRendersLeft(userId: string, createdAtOf: (id: string) => Promise<number | null> = accountCreatedAt, emailOf: (id: string) => Promise<string | null> = accountEmail): Promise<number> {
  if (!personal(userId) || process.env.CREDITS_ENABLED !== "1" || (!clerkEnabled && createdAtOf === accountCreatedAt)) return 0;
  const row = await db.freeRender.findUnique({ where: { userId } });
  if (row) return leftOf(row); // never more than the current offer allows, even for an account made while it was bigger
  const made = await createdAtOf(userId);
  if (made == null) return 0; // could not tell: try again next time rather than deciding wrongly
  let granted = made >= since() ? freeRendersCount() : 0;
  if (granted > 0) {
    // One offer per inbox: a second account on the same address (Gmail dots, +tags) gets nothing.
    const email = await emailOf(userId);
    if (email) {
      const emailHash = createHash("sha256").update(normalizeEmail(email)).digest("hex");
      await db.freeEmailClaim.createMany({ data: [{ emailHash, userId }], skipDuplicates: true });
      const claim = await db.freeEmailClaim.findUnique({ where: { emailHash } });
      if (claim && claim.userId !== userId) granted = 0;
    }
  }
  await db.freeRender.createMany({ data: [{ userId, remaining: granted, granted }], skipDuplicates: true });
  const made2 = await db.freeRender.findUnique({ where: { userId } });
  return made2 ? leftOf(made2) : 0;
}

const leftOf = (row: { remaining: number; granted: number }) => Math.max(0, Math.min(row.remaining, freeRendersCount() - (row.granted - row.remaining)));

/** True when this person was given free renders and has used every one (so "out of credits" can say so). */
export async function freeUsedUp(userId: string): Promise<boolean> {
  if (!personal(userId)) return false;
  const row = await db.freeRender.findUnique({ where: { userId } });
  return Boolean(row && row.granted > 0 && leftOf(row) === 0);
}

/** Takes one free render when the person has one and this render is light enough. True when it is free. */
export async function claimFreeRender(userId: string, price: number, createdAtOf?: (id: string) => Promise<number | null>, emailOf?: (id: string) => Promise<string | null>): Promise<boolean> {
  if (price > freeMaxCredits() || (await freeRendersLeft(userId, createdAtOf, emailOf)) <= 0) return false;
  return (await db.freeRender.updateMany({ where: { userId, remaining: { gt: 0 } }, data: { remaining: { decrement: 1 } } })).count > 0;
}

/** A free render that did not happen (it failed or never started) goes back to the person. Never above what they were given. */
export async function giveBackFreeRender(userId: string): Promise<void> {
  const row = await db.freeRender.findUnique({ where: { userId } });
  if (!row || row.remaining >= row.granted) return;
  await db.freeRender.updateMany({ where: { userId, remaining: { lt: row.granted } }, data: { remaining: { increment: 1 } } });
}
