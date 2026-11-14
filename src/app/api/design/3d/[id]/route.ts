import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { workspaceSession } from "@/lib/workspace";
import { db } from "@/lib/db";
import { delete3D, finalize3D, toItem3D } from "@/lib/design/jobs3d";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function who() {
  if (!clerkEnabled) return null;
  const { workspaceId } = await workspaceSession();
  return workspaceId || null;
}
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await who();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await db.model3D.findFirst({ where: { id, userId, deletedAt: null } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toItem3D(await finalize3D(r)));
}
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await who();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  const done = await db.model3D.updateMany({ where: { id, userId, deletedAt: null }, data: { name } });
  return done.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await who();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = await delete3D(userId, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "It is still being made, or was not found." }, { status: 409 });
}
