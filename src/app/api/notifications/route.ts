import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditState } from "@/lib/expiry";
import { fmtCredits } from "@/lib/credit-units";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// What finished (or failed) for the signed-in person in the last 3 days: renders, videos and voice takes. Built from the jobs themselves, nothing extra is stored.
// `at` is when it ended; the browser decides what counts as unread.
export async function GET() {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  try {
    const [gens, takes] = await Promise.all([
      db.generation.findMany({ where: { userId: u.userId, deletedAt: null, status: { in: ["completed", "failed"] }, updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, kind: true, status: true, prompt: true, error: true, updatedAt: true, finishedAt: true } }),
      db.audioJob.findMany({ where: { userId: u.userId, deletedAt: null, status: { in: ["completed", "failed"] }, updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, kind: true, status: true, text: true, error: true, updatedAt: true, finishedAt: true } }),
    ]);
    // Credits about to run out (10 credits or more, within 7 days; nothing is stored, this is worked out from the ledger each time).
    const now = Date.now();
    const state = await creditState(u.userId);
    const soon = state.grants.filter((g) => g.source !== "other" && g.remaining >= 100 && Number.isFinite(g.expiresAt) && g.expiresAt > now && g.expiresAt - now <= 7 * 24 * 3600 * 1000).sort((a, b) => a.expiresAt - b.expiresAt);
    const expiring = soon.map((g) => ({ id: `expiry-${g.id}`, ok: false, title: `${fmtCredits(g.remaining)} credits expire on ${new Date(g.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, body: g.source === "plan" ? "Plan credits renew monthly and do not roll over." : "Top-up credits last 90 days.", href: "/settings?tab=billing", at: new Date(g.expiresAt - 7 * 24 * 3600 * 1000).toISOString() }));
    const label = (k: string) => (k === "video" ? "video" : k === "stt" ? "transcript" : k === "sfx" || k === "vsfx" ? "sound effect" : k === "music" ? "music" : k === "tts" ? "voice take" : "image");
    const items = [
      ...expiring,
      ...gens.map((g) => ({ id: g.id, ok: g.status === "completed", title: g.status === "completed" ? `Your ${label(g.kind)} is ready` : `Your ${label(g.kind)} could not be made`, body: (g.status === "completed" ? g.prompt : g.error ?? g.prompt).slice(0, 90), href: "/gallery", at: (g.finishedAt ?? g.updatedAt).toISOString() })),
      ...takes.map((t) => ({ id: t.id, ok: t.status === "completed", title: t.status === "completed" ? `Your ${label(t.kind)} is ready` : `Your ${label(t.kind)} could not be made`, body: (t.status === "completed" ? t.text : t.error ?? t.text).slice(0, 90), href: "/voice", at: (t.finishedAt ?? t.updatedAt).toISOString() })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 20);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("notifications failed", err);
    return NextResponse.json({ items: [] });
  }
}
