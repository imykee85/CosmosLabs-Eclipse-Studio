import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { heldNow } from "@/lib/held";
import { db } from "@/lib/db";
import { expireCredits, usersToExpire } from "@/lib/expiry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Removes credits whose time has run out (vercel.json, daily): one EXPIRE ledger row per expired grant. Safe to run twice (the row's external id is unique).
// Someone with a job running is skipped until the next run, so a hold is never cut from under a render. Protected by CRON_SECRET (Secret).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  let people = 0, removed = 0, skipped = 0;
  try {
    for (const userId of await usersToExpire()) {
      if (Date.now() - started > 250_000) break; // the rest waits for tomorrow's run
      if ((await heldNow(db, userId)) > 0) { skipped++; continue; }
      const n = await expireCredits(userId);
      if (n > 0) { people++; removed += n; }
    }
    return NextResponse.json({ people, removed, skipped });
  } catch (err) {
    console.error("credit expiry failed", err);
    return NextResponse.json({ error: "The expiry run failed." }, { status: 500 });
  }
}
