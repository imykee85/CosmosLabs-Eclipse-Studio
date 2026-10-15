import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

const MAX_BYTES = 600_000;
const MAX_CANVASES = 100; // per project, not counting the ones in "Recently deleted"

function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

const META = { id: true, name: true, nodeCount: true, thumbId: true, createdAt: true, updatedAt: true, deletedAt: true } as const;

// The signed-in user's canvases in one project (no graphs, just what the library cards need). ?bin=1 lists "Recently deleted" instead.
export async function GET(req: Request) {
  const u = userOr401();
  if (!u.userId) return u.res;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const bin = url.searchParams.get("bin") === "1";
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  try {
    // The one canvas older versions kept per project becomes the first canvas, once. Two requests arriving together must not both make it: whichever
    // deletes the old row first (inside one transaction with creating the canvas) is the one that creates it.
    const any = await db.canvas.count({ where: { userId: u.userId, projectId } });
    if (any === 0) {
      await db.$transaction(async (tx) => {
        const legacy = await tx.canvasState.findUnique({ where: { userId_projectId: { userId: u.userId, projectId } } });
        const d = legacy?.data as { nodes?: unknown[] } | null | undefined;
        if (!legacy || !d || !Array.isArray(d.nodes)) return;
        const gone = await tx.canvasState.deleteMany({ where: { userId: u.userId, projectId } });
        if (gone.count !== 1) return;
        await tx.canvas.create({ data: { userId: u.userId, projectId, name: "Canvas 1", data: legacy.data as object, nodeCount: d.nodes.length } });
      });
    }
    const rows = await db.canvas.findMany({
      where: { userId: u.userId, projectId, deletedAt: bin ? { not: null } : null },
      orderBy: bin ? { deletedAt: "desc" } : { updatedAt: "desc" },
      select: META,
      take: 200,
    });
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("list canvases failed", err);
    return NextResponse.json({ error: "Could not load your canvases." }, { status: 500 });
  }
}

// A new canvas, blank or with a graph (used for "Duplicate" and for turning an Image Studio prompt into a canvas).
export async function POST(req: Request) {
  const u = userOr401();
  if (!u.userId) return u.res;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "That canvas is too large." }, { status: 413 });
  let body: { projectId?: unknown; name?: unknown; data?: { nodes?: unknown; edges?: unknown } | null; thumbId?: unknown } | null = null;
  try { body = JSON.parse(text); } catch {}
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  const name = (typeof body?.name === "string" ? body.name.trim() : "").slice(0, 60) || "Untitled canvas";
  const data = body?.data ?? { nodes: [], edges: [], viewport: null };
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > 300 || data.edges.length > 600) return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
  try {
    const project = await db.project.findFirst({ where: { id: projectId, userId: u.userId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const live = await db.canvas.count({ where: { userId: u.userId, projectId, deletedAt: null } });
    if (live >= MAX_CANVASES) return NextResponse.json({ error: `A project holds up to ${MAX_CANVASES} canvases. Delete one first.` }, { status: 409 });
    const row = await db.canvas.create({
      data: { userId: u.userId, projectId, name, data: data as object, nodeCount: data.nodes.length, thumbId: typeof body?.thumbId === "string" ? body.thumbId.slice(0, 64) : null },
      select: META,
    });
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("create canvas failed", err);
    return NextResponse.json({ error: "Could not create the canvas." }, { status: 500 });
  }
}
