import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { TERMS_REQUIRED_FROM, TERMS_VERSION } from "@/lib/terms";

export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const row = await db.termsAcceptance.findUnique({ where: { userId_version: { userId, version: TERMS_VERSION } }, select: { id: true } });
  return !!row;
}

/** Records the acceptance once per person and version (a repeat changes nothing, the first time and address stay). */
export async function recordAcceptance(userId: string, meta: { ip: string | null; userAgent: string | null; source: string }) {
  await db.termsAcceptance.upsert({
    where: { userId_version: { userId, version: TERMS_VERSION } },
    create: { userId, version: TERMS_VERSION, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) ?? null, source: meta.source },
    update: {},
  });
}

/** Onboarding calls this: an account created on or after TERMS_REQUIRED_FROM that has not accepted the current terms is sent to the accept page first. Older accounts are never asked. */
export async function requireTermsForNewAccount(nextPath: string) {
  if (!clerkEnabled) return;
  const user = await currentUser();
  if (!user) return;
  if (user.createdAt < TERMS_REQUIRED_FROM.getTime()) return;
  const userId = user.id;
  // If the database cannot be reached, let them in rather than lock everyone out.
  const ok = await hasAcceptedTerms(userId).catch(() => true);
  if (!ok) redirect(`/accept-terms?next=${encodeURIComponent(nextPath)}`);
}
