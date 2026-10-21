import { NextResponse } from "next/server";
import { cancelPlan } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { NOT_TEAM_ADMIN, workspaceSession } from "@/lib/workspace";

// "Cancel plan" in Settings > Billing: the plan stops at the end of the period already paid for. Team admins only for a team's plan.
export async function POST() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, isAdmin } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: NOT_TEAM_ADMIN }, { status: 403 });
  const done = await cancelPlan(userId);
  if (!done.ok) return NextResponse.json({ error: done.error }, { status: done.status });
  return NextResponse.json({ ok: true });
}
