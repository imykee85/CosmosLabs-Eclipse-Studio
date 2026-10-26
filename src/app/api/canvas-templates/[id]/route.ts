import { NextResponse } from "next/server";
import { canvasUser } from "@/lib/canvas-api";
import { removeTemplate } from "@/lib/canvas-collab";

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const ok = await removeTemplate(u.workspace, params.id).catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
