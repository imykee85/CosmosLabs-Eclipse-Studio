import { clerkClient } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { grantCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { WELCOME_CREDITS } from "@/lib/plans";

// The welcome gift: an account made on or after WELCOME_FROM (a date; FREE_RENDERS_FROM is read as a fallback so the old setting keeps working) gets
// WELCOME_CREDITS (10 credits) once, as a plain GRANT line, usable on anything. It only applies in the person's own workspace (never a team's) and
// only while credits are switched on (otherwise everything is free anyway). Accounts that existed before the offer are marked once so Clerk is asked once.
// The FREE_RENDERS_COUNT and FREE_RENDERS_MAX_CREDITS settings no longer do anything. The marker row is the free_renders table; the grant itself is made
// idempotent by the ledger's unique (provider, externalId).
const since = () => { const t = Date.parse(process.env.WELCOME_FROM ?? process.env.FREE_RENDERS_FROM ?? "2026-10-20"); return Number.isFinite(t) ? t : Date.parse("2026-10-20"); };
const personal = (userId: string) => userId.startsWith("user_");
const welcomeOn = () => (Number(process.env.WELCOME_CREDITS) >= 0 && process.env.WELCOME_CREDITS ? Math.floor(Number(process.env.WELCOME_CREDITS)) : WELCOME_CREDITS);

async function accountCreatedAt(userId: string): Promise<number | null> {
  try { return (await (await clerkClient()).users.getUser(userId)).createdAt; } catch (err) { console.error("welcome credits: could not read the account", userId, err); return null; }
}

/** Gives the welcome credits to an eligible account, once. Returns the amount the account has been given (0 when it is not eligible). `createdAtOf` is for tests. */
export async function ensureWelcomeCredits(userId: string, createdAtOf: (id: string) => Promise<number | null> = accountCreatedAt): Promise<number> {
  const amount = welcomeOn();
  if (!personal(userId) || amount <= 0 || process.env.CREDITS_ENABLED !== "1" || (!clerkEnabled && createdAtOf === accountCreatedAt)) return 0;
  if (await hadWelcome(userId)) return amount; // already given: nothing more to do
  let row = await db.freeRender.findUnique({ where: { userId } });
  if (!row) {
    const made = await createdAtOf(userId);
    if (made == null) return 0; // could not tell: try again next time rather than deciding wrongly
    await db.freeRender.createMany({ data: [{ userId, remaining: 0, granted: made >= since() ? 1 : 0 }], skipDuplicates: true });
    row = await db.freeRender.findUnique({ where: { userId } });
  }
  if (!row || row.granted <= 0) return 0;
  await grantCredits(userId, amount, { reason: "GRANT", provider: "eclipse", externalId: `welcome:${userId}`, note: "Welcome credits" });
  return amount;
}

/** True when this account was given the welcome credits (so the pop-up and the "used up" message know). */
export async function hadWelcome(userId: string): Promise<boolean> {
  if (!personal(userId)) return false;
  const row = await db.creditLedger.findFirst({ where: { userId, provider: "eclipse", externalId: `welcome:${userId}` }, select: { id: true } });
  return Boolean(row);
}
