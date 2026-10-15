import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (clerkEnabled) {
    const { userId } = auth().protect();
    // New accounts answer the onboarding questions first; if the database can't be reached, let them in.
    const done = await db.onboarding.findUnique({ where: { userId } }).catch(() => true);
    if (!done) redirect("/onboarding");
  }
  return <DashboardView />;
}
