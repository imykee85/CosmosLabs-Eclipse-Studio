import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// What finished (or failed) for the signed-in person in the last 3 days: renders, videos and voice takes. Built from the jobs themselves, nothing extra is stored.
// `at` is when it ended; the browser decides what counts as unread.
export async function GET() {
  const u = audioUser();
  if ("res" in u) return u.res;
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  try {
    const [gens, takes] = await Promise.all([
      db.generation.findMany({ where: { userId: u.userId, deletedAt: null, status: { in: ["completed", "failed"] }, updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, kind: true, status: true, prompt: true, error: true, updatedAt: true, finishedAt: true } }),
      db.audioJob.findMany({ where: { userId: u.userId, deletedAt: null, status: { in: ["completed", "failed"] }, updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, kind: true, status: true, text: true, error: true, updatedAt: true, finishedAt: true } }),
    ]);
    const label = (k: string) => (k === "video" ? "video" : k === "stt" ? "transcript" : k === "sfx" || k === "vsfx" ? "sound effect" : k === "music" ? "music" : k === "tts" ? "voice take" : "image");
    const items = [
      ...gens.map((g) => ({ id: g.id, ok: g.status === "completed", title: g.status === "completed" ? `Your ${label(g.kind)} is ready` : `Your ${label(g.kind)} could not be made`, body: (g.status === "completed" ? g.prompt : g.error ?? g.prompt).slice(0, 90), href: "/gallery", at: (g.finishedAt ?? g.updatedAt).toISOString() })),
      ...takes.map((t) => ({ id: t.id, ok: t.status === "completed", title: t.status === "completed" ? `Your ${label(t.kind)} is ready` : `Your ${label(t.kind)} could not be made`, body: (t.status === "completed" ? t.text : t.error ?? t.text).slice(0, 90), href: "/voice", at: (t.finishedAt ?? t.updatedAt).toISOString() })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 20);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("notifications failed", err);
    return NextResponse.json({ items: [] });
  }
}
