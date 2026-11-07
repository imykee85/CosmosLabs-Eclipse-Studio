import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";
import type { Prisma } from "@prisma/client";

// The result of an agent reply started in the background. Only the person who started it can read it; the browser deletes it once it has shown it.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  const run = await db.agentRun.findFirst({ where: { id, userId }, select: { status: true, result: true, createdAt: true } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // A reply still "pending" long after it started was cut off by the server (its answer will never come): it is closed as failed so the chat is free.
  if (run.status === "pending" && Date.now() - run.createdAt.getTime() > 6 * 60_000) {
    const result = { status: 502, body: { error: "The agent couldn't answer. Please try again." } };
    await db.agentRun.updateMany({ where: { id, userId, status: "pending" }, data: { status: "failed", result: result as unknown as Prisma.InputJsonValue } });
    return NextResponse.json({ status: "failed", result });
  }
  if (run.status === "pending") return NextResponse.json({ status: "pending" });
  return NextResponse.json({ status: run.status, result: run.result });
}

// Stop: a reply still being written is marked canceled. Its answer is then never shown, and the chat is free again.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ ok: true });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.action !== "stop") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const { id } = await props.params;
  await db.agentRun.updateMany({ where: { id, userId, status: "pending" }, data: { status: "canceled" } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ ok: true });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await props.params;
  await db.agentRun.deleteMany({ where: { id, userId, NOT: { status: "pending" } } });
  return NextResponse.json({ ok: true });
}
