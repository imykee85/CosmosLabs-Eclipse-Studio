import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startSound } from "@/lib/design/motion/agent";
import { type MotionAudio, type MotionComment } from "@/lib/design/motion/spec";
import { motionUser } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Actions on one version: approve or decline its sound, stop it, star it, pin or remove a comment, delete it.
export async function POST(req: Request, props: { params: Promise<{ id: string; vid: string }> }) {
  const { id, vid } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const v = await db.motionVersion.findFirst({ where: { id: vid, motionId: id, userId: u.userId } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => null);
  const a = (v.audio as MotionAudio | null) ?? {};
  switch (b?.action) {
    case "approve": {
      // Flips once: a double tap starts the sound only once.
      const r = await db.motionVersion.updateMany({ where: { id: vid, status: "approval" }, data: { audio: { ...a, approval: "approved" } as object, status: "finishing" } });
      if (r.count) await startSound(vid, u.userId);
      return NextResponse.json({ ok: true });
    }
    case "decline":
      await db.motionVersion.updateMany({ where: { id: vid, status: "approval" }, data: { audio: { ...a, approval: "declined" } as object, status: "ready" } });
      return NextResponse.json({ ok: true });
    case "stop":
      await db.motionVersion.updateMany({ where: { id: vid, status: { in: ["planning", "writing", "reviewing"] } }, data: { status: "stopped", error: "Stopped." } });
      return NextResponse.json({ ok: true });
    case "star": case "unstar":
      await db.motionVersion.update({ where: { id: vid }, data: { starred: b.action === "star" } });
      return NextResponse.json({ ok: true });
    case "comment": {
      const text = typeof b?.text === "string" ? b.text.trim().slice(0, 500) : "";
      const n = (k: unknown, max: number) => { const x = Number(k); return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0; };
      if (!text) return NextResponse.json({ error: "Write the comment first." }, { status: 400 });
      const list = Array.isArray(v.comments) ? (v.comments as MotionComment[]) : [];
      if (list.length >= 40) return NextResponse.json({ error: "This version has enough comments. Send an edit first." }, { status: 400 });
      const c: MotionComment = { id: crypto.randomUUID(), t: n(b?.t, v.duration), x: n(b?.x, 1), y: n(b?.y, 1), text, at: new Date().toISOString() };
      await db.motionVersion.update({ where: { id: vid }, data: { comments: [...list, c] as object } });
      return NextResponse.json(c);
    }
    case "uncomment": {
      const list = Array.isArray(v.comments) ? (v.comments as MotionComment[]) : [];
      await db.motionVersion.update({ where: { id: vid }, data: { comments: list.filter((c) => c.id !== b?.commentId) as object } });
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      if (["planning", "writing", "reviewing", "finishing"].includes(v.status)) return NextResponse.json({ error: "It is still being made." }, { status: 409 });
      const count = await db.motionVersion.count({ where: { motionId: id } });
      if (count <= 1) return NextResponse.json({ error: "A motion keeps at least one version. Delete the motion instead." }, { status: 409 });
      await db.motionVersion.delete({ where: { id: vid } });
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
