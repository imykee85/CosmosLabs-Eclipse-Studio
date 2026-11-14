import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepAbandonedUploads } from "@/lib/upload-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Deletes upload files nobody finished within 24 hours (vercel.json, daily). Protected by CRON_SECRET (Secret).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sweepAbandonedUploads());
  } catch (err) {
    console.error("upload sweep failed", err);
    return NextResponse.json({ error: "The upload sweep failed." }, { status: 500 });
  }
}
