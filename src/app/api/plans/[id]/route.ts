import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";
import { advancePlan, cancelPlan, planView } from "@/lib/agent-plan-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function owner(id: string) {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const row = await db.agentPlan.findFirst({ where: { id, userId }, select: { id: true } });
  return row ? { userId } : { res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
}

// Where the plan is now. Looking also gives it a push (safe: one caller at a time does the work), so an open card is always current.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const o = await owner(id);
  if (!o.userId) return o.res;
  const row = await advancePlan(id);
  return row ? NextResponse.json(planView(row)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Stop after the step that is running.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const o = await owner(id);
  if (!o.userId) return o.res;
  const b = await req.json().catch(() => null);
  if (b?.action !== "cancel") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const row = await cancelPlan(id, o.userId);
  return row ? NextResponse.json(planView(row)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
