import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";

// The result of an agent reply started in the background. Only the person who started it can read it; the browser deletes it once it has shown it.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const run = await db.agentRun.findFirst({ where: { id, userId }, select: { status: true, result: true } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.status === "pending") return NextResponse.json({ status: "pending" });
  return NextResponse.json({ status: run.status, result: run.result });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ ok: true });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  await db.agentRun.deleteMany({ where: { id, userId, NOT: { status: "pending" } } });
  return NextResponse.json({ ok: true });
}
