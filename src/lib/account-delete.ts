import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { deleteOwnVoice } from "@/lib/audio/voices";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payments";
import { SANDBOX_OPEN } from "@/lib/reservations";
import { deletePrefix, storageEnabled } from "@/lib/storage";

// Deletes a person's account for good: their files, everything we hold about them and their sign-in. Steps run in an order that is safe to repeat:
// if one fails the person can press the button again and it carries on (nothing is lost that was not already meant to go).

export type DeleteResult = { ok: true; notes: string[] } | { ok: false; status: number; error: string };

// Every table with a user_id column. A unit test compares this with the schema, so a new table cannot be forgotten.
export const USER_TABLES = [
  "generation", "onboarding", "project", "canvasState", "canvas", "creditLedger", "connectChat", "memory", "userSkill", "userAgent", "connectorLink",
  "upload", "usageEvent", "audioJob", "userVoice", "sandboxRun", "sandboxAudit", "skillSetting", "portfolio", "certificate", "sandboxJob", "coreTool",
  "apiKey", "oauthGrant", "oauthCode", "soulId", "billingSettings", "freeRender", "chatSpend", "agentRun", "canvasTemplate", "canvasComment",
] as const;

/** Something still running for this person (a render, a voice take, a sandbox job, Soul ID training). */
export async function busyReason(userId: string): Promise<string | null> {
  const [gen, audio, sandbox, soul] = await Promise.all([
    db.generation.count({ where: { userId, status: { in: ["pending", "saving"] } } }),
    db.audioJob.count({ where: { userId, status: "pending" } }),
    db.sandboxJob.count({ where: { userId, status: { in: SANDBOX_OPEN } } }),
    db.soulId.count({ where: { userId, status: "pending" } }),
  ]);
  return gen + audio + sandbox + soul > 0 ? "Something is still being made in your account. Wait for it to finish, or cancel it, then try again." : null;
}

export async function deleteAccount(userId: string, opts: { closeSignIn?: boolean } = {}): Promise<DeleteResult> {
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(userId)) return { ok: false, status: 400, error: "Unexpected account id." };
  const busy = await busyReason(userId);
  if (busy) return { ok: false, status: 409, error: busy };
  const notes: string[] = [];

  // 1. A subscription keeps charging after the account is gone, so end it first when we know which one it is.
  const settings = await db.billingSettings.findUnique({ where: { userId } });
  if (settings?.providerMembershipId) {
    const provider = paymentProvider();
    if (provider?.cancelMembership) {
      try { await provider.cancelMembership(settings.providerMembershipId); }
      catch (err) { console.error("account delete: could not cancel the subscription", userId, err); notes.push("We could not end your subscription automatically. Please cancel it in your payment account so you are not charged again."); }
    } else notes.push("Please cancel your subscription in your payment account so you are not charged again.");
  }

  // 2. Cloned and designed voices also live at the voice provider.
  const voices = await db.userVoice.findMany({ where: { userId }, select: { id: true } });
  let stuck = 0;
  for (const v of voices) { const r = await deleteOwnVoice(userId, v.id).catch(() => ({ ok: false as const })); if (!r.ok) stuck++; }
  if (stuck) notes.push(`${stuck} cloned or designed voice${stuck === 1 ? "" : "s"} could not be removed from the voice provider.`);

  // 3. Files. A failure here stops everything, so nothing is left behind that we can no longer find.
  if (storageEnabled) {
    try {
      for (const prefix of [`u/${userId}/`, `audio/${userId}/`, `thumbs/u/${userId}/`]) await deletePrefix(prefix);
    } catch (err) {
      console.error("account delete: files could not be removed", userId, err);
      return { ok: false, status: 502, error: "Your files could not be removed just now. Nothing else was deleted; please try again." };
    }
  }

  // 4. Rows. One transaction, so it is all or nothing.
  try {
    await db.$transaction(USER_TABLES.map((t) => (db[t] as unknown as { deleteMany: (a: { where: { userId: string } }) => Prisma.PrismaPromise<unknown> }).deleteMany({ where: { userId } })));
  } catch (err) {
    console.error("account delete: rows could not be removed", userId, err);
    return { ok: false, status: 500, error: "Your data could not be removed just now. Please try again." };
  }

  // 5. The sign-in itself, last.
  if (opts.closeSignIn !== false) {
    try { await (await clerkClient()).users.deleteUser(userId); }
    catch (err) {
      console.error("account delete: sign-in could not be closed", userId, err);
      return { ok: false, status: 502, error: "Your data is deleted, but closing your sign-in failed. Press delete again to finish." };
    }
  }
  return { ok: true, notes };
}
