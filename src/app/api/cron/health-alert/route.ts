import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Daily look at the last 24 hours (vercel.json). Sends an alert (see ops-alert.ts) only when something is off:
// many failed renders, renders stuck for over an hour, or payment deliveries that could not be matched. Protected by CRON_SECRET (Secret).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const day = new Date(Date.now() - 24 * 3600_000);
  const hour = new Date(Date.now() - 3600_000);
  const [done, failed, stuck, payments] = await Promise.all([
    db.generation.count({ where: { createdAt: { gte: day }, status: "completed" } }),
    db.generation.count({ where: { createdAt: { gte: day }, status: "failed" } }),
    db.generation.count({ where: { status: { in: ["pending", "saving"] }, createdAt: { lt: hour } } }),
    db.paymentEventLog.count({ where: { createdAt: { gte: day }, outcome: { in: ["unmatched", "error"] } } }),
  ]);
  const sent: string[] = [];
  const total = done + failed;
  if (failed >= 10 && failed / Math.max(total, 1) > 0.3) { if (await opsAlert("failed-renders", `${failed} of ${total} renders failed in the last 24 hours. Open /admin/jobs.`)) sent.push("failed-renders"); }
  if (stuck >= 5) { if (await opsAlert("stuck-renders", `${stuck} renders have been running for over an hour. Open /admin/jobs.`)) sent.push("stuck-renders"); }
  if (payments > 0) { if (await opsAlert("payments", `${payments} payment events could not be matched or errored in the last 24 hours. Open /admin/health, Payment events.`)) sent.push("payments"); }
  return NextResponse.json({ done, failed, stuck, payments, sent });
}
