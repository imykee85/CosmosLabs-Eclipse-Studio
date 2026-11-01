import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { requireTermsForNewAccount } from "@/lib/terms-db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (clerkEnabled) {
    const { userId } = await auth.protect();
    const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => null);
    if (done) redirect("/dashboard");
    // Only accounts created on or after the terms date must accept here; older accounts are left alone.
    await requireTermsForNewAccount("/onboarding");
  }
  return <OnboardingFlow />;
}
