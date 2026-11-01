import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/terms";

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

/** App screens call this: a signed-in person who has not accepted the current terms is sent to the accept page first. */
export async function requireTerms(nextPath: string) {
  if (!clerkEnabled) return;
  const { userId } = await auth();
  if (!userId) return;
  // If the database cannot be reached, let them in rather than lock everyone out.
  const ok = await hasAcceptedTerms(userId).catch(() => true);
  if (!ok) redirect(`/accept-terms?next=${encodeURIComponent(nextPath)}`);
}
