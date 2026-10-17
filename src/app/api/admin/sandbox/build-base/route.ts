import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getAdmin } from "@/lib/admin";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only: builds the base snapshot every job boots from (see src/lib/sandbox/kinds/base.ts). Takes several minutes; /admin/sandbox follows it.
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const q = await enqueue("build.base", admin.userId, {}, { admin: true });
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: q.status });
  waitUntil(drive(q.job.id, 50_000).catch((e) => console.error("build-base drive failed", e)));
  return NextResponse.json({ job: await jobView(q.job, true) }, { status: 202 });
}
