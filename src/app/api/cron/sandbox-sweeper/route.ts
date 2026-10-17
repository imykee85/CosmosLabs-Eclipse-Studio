import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweep } from "@/lib/sandbox/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// The sandbox safety net (vercel.json; Hobby plans allow a daily schedule only): moves on jobs nobody is following, stops every sandbox that is
// past its deadline and settles them. Jobs normally move while their page is open; this catches the rest. Protected by CRON_SECRET (Secret).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sweep(60));
  } catch (err) {
    console.error("sandbox sweeper failed", err);
    return NextResponse.json({ error: "The sweep failed." }, { status: 500 });
  }
}
