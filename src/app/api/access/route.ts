import { NextResponse } from "next/server";
import { accessFor, gatingOn } from "@/lib/access";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { FEATURE_MIN, planAllows, type Feature } from "@/lib/access-table";
import { workspaceSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Which plan the current workspace is on and which features it includes, so the app can show locks and open the upgrade pop-up at once (for example when Atlas is
// switched on). The server still checks every use itself.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ plan: "scale", features: Object.keys(FEATURE_MIN), gating: false });
  const w = await workspaceSession();
  if (!w.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const a = await accessFor(w.workspaceId, w.personId);
  return NextResponse.json({ plan: a.plan, admin: a.admin, gating: gatingOn(), features: (Object.keys(FEATURE_MIN) as Feature[]).filter((f) => planAllows(a.plan, f)) }, { headers: { "Cache-Control": "no-store" } });
}
