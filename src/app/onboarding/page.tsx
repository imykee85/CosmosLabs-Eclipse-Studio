import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { requireTerms } from "@/lib/terms-db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (clerkEnabled) {
    const { userId } = await auth.protect();
    await requireTerms("/onboarding");
    const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => null);
    if (done) redirect("/dashboard");
  }
  return <OnboardingFlow />;
}
