import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import AcceptTerms from "@/components/auth/AcceptTerms";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { safeNext } from "@/lib/safe-next";
import { hasAcceptedTerms } from "@/lib/terms-db";

export const dynamic = "force-dynamic";

export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next) ?? "/dashboard";
  if (clerkEnabled) {
    const { userId } = await auth.protect();
    if (await hasAcceptedTerms(userId).catch(() => false)) redirect(next);
  }
  return <AuthShell><AcceptTerms next={next} /></AuthShell>;
}
