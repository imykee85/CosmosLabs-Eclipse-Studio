import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PromptForm from "@/components/PromptForm";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  // First visit after signing up: collect onboarding answers once. If the database
  // can't be reached, let the user through rather than block them.
  if (clerkEnabled) {
    const { userId } = auth();
    if (userId) {
      const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => true);
      if (!done) redirect("/onboarding");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create</h1>
      <Suspense>
        <PromptForm />
      </Suspense>
    </div>
  );
}
