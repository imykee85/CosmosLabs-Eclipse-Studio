import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepDeletedTeams } from "@/lib/team-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Removes the data of teams that were deleted in Clerk and have been quiet for 30 days (vercel.json, daily). Protected by CRON_SECRET (Secret).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sweepDeletedTeams());
  } catch (err) {
    console.error("team sweep failed", err);
    return NextResponse.json({ error: "The team sweep failed." }, { status: 500 });
  }
}
