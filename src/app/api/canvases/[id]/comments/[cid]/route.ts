import { NextResponse } from "next/server";
import { canvasUser } from "@/lib/canvas-api";
import { deleteComment, setResolved } from "@/lib/canvas-collab";

type Ctx = { params: Promise<{ id: string; cid: string }> };

// Mark a comment resolved (or open again). Anyone in the workspace may.
export async function PATCH(req: Request, props: Ctx) {
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const body = await req.json().catch(() => null);
  if (typeof body?.resolved !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await setResolved(u.workspace, params.id, params.cid, body.resolved).catch(() => ({ ok: false as const, status: 500, error: "Could not change the comment." }));
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}

// Delete a comment (the canvas belongs to the workspace, so any member may).
export async function DELETE(_req: Request, props: Ctx) {
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const r = await deleteComment(u.workspace, params.id, params.cid).catch(() => ({ ok: false as const, status: 500, error: "Could not delete the comment." }));
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
