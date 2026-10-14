import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finalizeGeneration, purgeFailed } from "@/lib/generation-jobs";
import { finalizeVideo, isLateWatch, rescueLateVideo } from "@/lib/video-jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH = 40;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Finishes renders nobody is waiting on: stores finished images, charges credits and fails the ones that ran out of time.
// Called by the scheduler in vercel.json, which sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
// The work is the same finalizeGeneration the app runs when someone opens it, which is claimed atomically, so a render is
// never saved or charged twice even if a person and this job reach it at the same moment.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const staleSaving = new Date(Date.now() - 2 * 60 * 1000);
    const staleVideoSaving = new Date(Date.now() - 10 * 60 * 1000);
    const rows = await db.generation.findMany({
      where: { OR: [{ status: "pending" }, { kind: "image", status: "saving", updatedAt: { lt: staleSaving } }, { kind: "video", status: "saving", updatedAt: { lt: staleVideoSaving } }] },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    const results = await Promise.allSettled(rows.map((g) => (g.kind === "video" ? finalizeVideo(g) : finalizeGeneration(g))));
    const late = (await db.generation.findMany({ where: { kind: "video", status: "failed", statusUrl: { not: null } }, orderBy: { createdAt: "desc" }, take: BATCH })).filter(isLateWatch);
    const rescued = (await Promise.allSettled(late.map(rescueLateVideo))).filter((r) => r.status === "fulfilled" && r.value.status === "completed").length;
    const done = results.filter((r) => r.status === "fulfilled" && r.value.status !== "pending" && r.value.status !== "saving").length;
    const cleared = await purgeFailed().catch(() => 0);
    return NextResponse.json({ checked: rows.length, finished: done, rescuedLate: rescued, clearedFailed: cleared, more: rows.length === BATCH });
  } catch (err) {
    console.error("render finishing job failed", err);
    return NextResponse.json({ error: "The job failed." }, { status: 500 });
  }
}
