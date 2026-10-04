import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (clerkEnabled) {
    const { userId } = auth().protect();
    const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => null);
    if (done) redirect("/create");
  }
  return <OnboardingFlow />;
}
