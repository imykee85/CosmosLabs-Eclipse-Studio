import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeature } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";
import { cleanSpec } from "@/lib/agent-plan";
import { createPlan, driveInBackground, planView } from "@/lib/agent-plan-server";

// 300 s: the first stretch of the plan keeps running after the reply (waitUntil); a fresh function takes over for the rest, so closing the app does not stop it.
export const maxDuration = 300;

// Approve a plan: it is saved and started, and the server carries it on step by step.
export async function POST(req: Request) {
  const gated = await gateFeature("plans");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const spec = cleanSpec(b?.spec);
  if (!spec) return NextResponse.json({ error: "This plan could not be read." }, { status: 400 });
  const r = await createPlan({ userId, personId: personId ?? null, projectId: typeof b?.projectId === "string" ? b.projectId.slice(0, 64) : null, spec });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  driveInBackground(r.row.id);
  return NextResponse.json(planView(r.row));
}
