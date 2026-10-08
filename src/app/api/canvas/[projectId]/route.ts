import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

type Ctx = { params: { projectId: string } };

const MAX_BYTES = 600_000;

function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode" }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

// The canvas saved for one of the signed-in user's projects.
export async function GET(_req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  try {
    const row = await db.canvasState.findUnique({ where: { userId_projectId: { userId: u.userId, projectId: params.projectId } } });
    return NextResponse.json({ data: row?.data ?? null, updatedAt: row?.updatedAt ?? null });
  } catch (err) {
    console.error("load canvas failed", err);
    return NextResponse.json({ error: "Could not load the canvas." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "The canvas is too large to save." }, { status: 413 });
  let body: { data?: { nodes?: unknown; edges?: unknown } } | null = null;
  try { body = JSON.parse(text); } catch {}
  const data = body?.data;
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > 300 || data.edges.length > 600) {
    return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
  }
  try {
    // Only the owner of the project can save a canvas for it.
    const project = await db.project.findFirst({ where: { id: params.projectId, userId: u.userId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const json = data as object;
    await db.canvasState.upsert({
      where: { userId_projectId: { userId: u.userId, projectId: params.projectId } },
      create: { userId: u.userId, projectId: params.projectId, data: json },
      update: { data: json },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save canvas failed", err);
    return NextResponse.json({ error: "Could not save the canvas." }, { status: 500 });
  }
}
