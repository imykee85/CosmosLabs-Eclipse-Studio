import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

type Ctx = { params: { id: string } };
const MAX_BYTES = 600_000;

function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

// One canvas with its whole graph. Works for ones in "Recently deleted" too, so a restored canvas opens at once.
export async function GET(_req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  try {
    const row = await db.canvas.findFirst({ where: { id: params.id, userId: u.userId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item: { id: row.id, name: row.name, projectId: row.projectId, deletedAt: row.deletedAt, updatedAt: row.updatedAt }, data: row.data });
  } catch (err) {
    console.error("load canvas failed", err);
    return NextResponse.json({ error: "Could not load the canvas." }, { status: 500 });
  }
}

// Save the graph (the whole thing, replacing the old one).
export async function PUT(req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "The canvas is too large to save." }, { status: 413 });
  let body: { data?: { nodes?: unknown; edges?: unknown }; thumbId?: unknown } | null = null;
  try { body = JSON.parse(text); } catch {}
  const data = body?.data;
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > 300 || data.edges.length > 600) return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
  try {
    const hit = await db.canvas.updateMany({
      where: { id: params.id, userId: u.userId },
      data: { data: data as object, nodeCount: data.nodes.length, thumbId: typeof body?.thumbId === "string" ? body.thumbId.slice(0, 64) : null },
    });
    if (!hit.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save canvas failed", err);
    return NextResponse.json({ error: "Could not save the canvas." }, { status: 500 });
  }
}

// rename, trash (move to Recently deleted) and restore.
export async function PATCH(req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  let body: { action?: unknown; name?: unknown } | null = null;
  try { body = await req.json(); } catch {}
  const action = body?.action;
  try {
    const row = await db.canvas.findFirst({ where: { id: params.id, userId: u.userId }, select: { id: true, projectId: true, deletedAt: true } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (action === "rename") {
      const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
      if (!name) return NextResponse.json({ error: "Give the canvas a name." }, { status: 400 });
      await db.canvas.updateMany({ where: { id: row.id, userId: u.userId }, data: { name } });
    } else if (action === "trash") {
      await db.canvas.updateMany({ where: { id: row.id, userId: u.userId }, data: { deletedAt: new Date() } });
    } else if (action === "restore") {
      await db.canvas.updateMany({ where: { id: row.id, userId: u.userId }, data: { deletedAt: null } });
    } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update canvas failed", err);
    return NextResponse.json({ error: "Could not update the canvas." }, { status: 500 });
  }
}

// Delete for good. Only a canvas that is already in "Recently deleted" can be removed this way.
export async function DELETE(_req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  try {
    const hit = await db.canvas.deleteMany({ where: { id: params.id, userId: u.userId, deletedAt: { not: null } } });
    if (!hit.count) return NextResponse.json({ error: "Only a canvas in Recently deleted can be deleted for good." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete canvas failed", err);
    return NextResponse.json({ error: "Could not delete the canvas." }, { status: 500 });
  }
}
