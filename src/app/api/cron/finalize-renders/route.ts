import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finalizeGeneration } from "@/lib/generation-jobs";

export const maxDuration = 60;
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
    const rows = await db.generation.findMany({
      where: { OR: [{ status: "pending" }, { status: "saving", updatedAt: { lt: staleSaving } }] },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    const results = await Promise.allSettled(rows.map((g) => finalizeGeneration(g)));
    const done = results.filter((r) => r.status === "fulfilled" && r.value.status !== "pending" && r.value.status !== "saving").length;
    return NextResponse.json({ checked: rows.length, finished: done, more: rows.length === BATCH });
  } catch (err) {
    console.error("render finishing job failed", err);
    return NextResponse.json({ error: "The job failed." }, { status: 500 });
  }
}
