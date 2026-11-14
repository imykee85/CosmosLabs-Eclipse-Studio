import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkedSettings, loadMotion, motionUser } from "@/lib/design/motion/server";
import { cleanSettings } from "@/lib/design/motion/spec";

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
  // Pictures, clips and default models attached to the motion afterwards (Atlas makes them, or the person adds them): used by the next edit.
  if (b?.settings && typeof b.settings === "object") {
    const m = await db.motion.findFirst({ where: { id, userId: u.userId, deletedAt: null } });
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = cleanSettings(m.settings), x = b.settings as Record<string, unknown>;
    const next = await checkedSettings(u.userId, { ...cur, ...(x.refs !== undefined ? { refs: x.refs } : {}), ...(x.clips !== undefined ? { clips: x.clips } : {}), ...(x.defaults !== undefined ? { defaults: x.defaults } : {}) });
    await db.motion.update({ where: { id }, data: { settings: next as object } });
    return NextResponse.json({ ok: true, settings: next });
  }
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
