import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeature } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";
import { claimUsage } from "@/lib/usage";
import { cleanMission } from "@/lib/agent-mission-spec";
import { createMission, driveMissionInBackground, listMissions, missionView } from "@/lib/agent-mission";

export const maxDuration = 300;

// Start a mission: the goal is saved and the server works on it step by step (it carries on if the app is closed).
export async function POST(req: Request) {
  const gated = await gateFeature("plans");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Missions are not available yet. Please try again later." }, { status: 503 });
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await claimUsage(personId ?? userId, "mission-start", 10, 3600_000))) return NextResponse.json({ error: "You started a lot of missions. Try again in a little while." }, { status: 429 });
  const b = await req.json().catch(() => null);
  const spec = cleanMission({ goal: b?.goal, budget_credits: b?.budget, autopilot: b?.autopilot });
  if (!spec) return NextResponse.json({ error: "Describe the goal in a sentence or two." }, { status: 400 });
  const r = await createMission({ userId, personId: personId ?? null, projectId: typeof b?.projectId === "string" ? b.projectId.slice(0, 64) : null, goal: spec.goal, budgetCredits: spec.budget, autopilot: spec.autopilot });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  driveMissionInBackground(r.row.id);
  return NextResponse.json(missionView(r.row));
}

export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ missions: await listMissions(userId) });
}
