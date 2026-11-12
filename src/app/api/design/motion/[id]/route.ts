import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadMotion, motionUser } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const m = await loadMotion(u.userId, id);
  return m ? NextResponse.json(m) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const b = await req.json().catch(() => null);
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 80) : "";
  if (!title) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  const r = await db.motion.updateMany({ where: { id, userId: u.userId, deletedAt: null }, data: { title } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const r = await db.motion.updateMany({ where: { id, userId: u.userId, deletedAt: null }, data: { deletedAt: new Date() } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
