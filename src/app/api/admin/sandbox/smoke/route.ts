import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getAdmin } from "@/lib/admin";
import { chromePath } from "@/lib/sandbox";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only: the smoke test (boots the base with no network and checks node, ffmpeg, a 2-second test video and, if installed, the browser).
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const q = await enqueue("smoke", admin.userId, { chrome: (await chromePath()) ?? "" }, { admin: true });
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: q.status });
  waitUntil(drive(q.job.id, 50_000).catch((e) => console.error("smoke drive failed", e)));
  return NextResponse.json({ job: await jobView(q.job, true) }, { status: 202 });
}
