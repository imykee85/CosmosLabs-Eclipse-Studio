import { gateFeature } from "@/lib/access";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";
import { advanceMission, answerMission, cancelMission, decideMission, driveMissionInBackground, missionView } from "@/lib/agent-mission";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function owner(id: string) {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const row = await db.agentMission.findFirst({ where: { id, userId }, select: { id: true, personId: true } });
  return row ? { userId, mine: row.personId === personId } : { res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
}

// Where the mission is now. Looking also gives it a push (safe: one caller at a time does the work), so an open card is always current.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const o = await owner(id);
  if (!o.userId) return o.res;
  const row = await advanceMission(id);
  return row ? NextResponse.json(missionView(row)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// approve | decline (spending requests), reply (an answer to a question), cancel.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const o = await owner(id);
  if (!o.userId) return o.res;
  const b = await req.json().catch(() => null);
  let row = null;
  // Approving can post through the starter's own connected apps, so only the person who started the mission may decide. Others on the team can watch it or stop it.
  if ((b?.action === "approve" || b?.action === "decline" || b?.action === "reply") && !o.mine) return NextResponse.json({ error: "Only the person who started this mission can do that." }, { status: 403 });
  if (b?.action === "approve" || b?.action === "reply") { const gated = await gateFeature("plans"); if (gated) return gated; }
  if (b?.action === "approve" || b?.action === "decline") row = await decideMission(id, o.userId, b.action === "approve");
  else if (b?.action === "reply" && typeof b.text === "string") row = await answerMission(id, o.userId, b.text);
  else if (b?.action === "cancel") row = await cancelMission(id, o.userId);
  else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "running") driveMissionInBackground(id);
  return NextResponse.json(missionView(row));
}
