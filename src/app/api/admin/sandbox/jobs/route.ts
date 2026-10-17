import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { advanceIfStale, cancel, sweep, FINAL_STATUSES } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only: the latest sandbox jobs of every account (open ones are moved forward while this page is open), with a kill button, and a
// "sweep now" that does what the daily cron does.
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const rows = await db.sandboxJob.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
  const jobs = [];
  for (const r of rows) {
    const j = FINAL_STATUSES.includes(r.status) ? r : await advanceIfStale(r, 2500).catch(() => r);
    jobs.push({ ...(await jobView(j, true)), user: j.userId.slice(-8), sandbox: j.sandboxName, step: j.step, activeCpuMs: j.activeCpuMs });
  }
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const b = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown } | null;
  if (b?.action === "kill" && typeof b.id === "string") {
    const job = await cancel(b.id, null);
    return job ? NextResponse.json({ job: await jobView(job, true) }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (b?.action === "sweep") return NextResponse.json(await sweep());
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
