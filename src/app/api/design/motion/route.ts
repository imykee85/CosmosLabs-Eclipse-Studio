import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";
import { briefCheck } from "@/lib/design/motion/agent";
import { type MotionStatus, type MotionSummary } from "@/lib/design/motion/spec";
import { checkedSettings, kitFor, MAX_RUNNING, motionUser, runInBackground, runningCount } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Your motions (newest first), and starting a new one from a brief.
export async function GET() {
  const u = await motionUser(false);
  if ("res" in u) return u.res.status === 503 ? NextResponse.json({ items: [] }) : u.res;
  const rows = await db.motion.findMany({ where: { userId: u.userId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 60 });
  const latest = rows.length ? await db.motionVersion.findMany({ where: { motionId: { in: rows.map((r) => r.id) } }, orderBy: { n: "desc" }, select: { motionId: true, status: true, aspect: true, n: true } }) : [];
  const items: MotionSummary[] = rows.map((m) => {
    const vs = latest.filter((v) => v.motionId === m.id);
    return { id: m.id, title: m.title, prompt: m.prompt.slice(0, 200), aspect: (vs[0]?.aspect ?? "16:9") as MotionSummary["aspect"], versions: vs.length, updatedAt: m.updatedAt.toISOString(), status: (vs[0]?.status as MotionStatus) ?? null };
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const u = await motionUser();
  if ("res" in u) return u.res;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Motion is not available yet. Please try again later." }, { status: 503 });
  const b = await req.json().catch(() => null);
  const prompt = typeof b?.prompt === "string" ? b.prompt.trim().slice(0, 8000) : "";
  if (prompt.length < 3) return NextResponse.json({ error: "Describe the motion first." }, { status: 400 });
  const bad = briefCheck(prompt);
  if (bad) return NextResponse.json({ error: bad }, { status: 422 });
  if (!(await claimUsage(u.userId, "design-motion", 10, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  if ((await runningCount(u.userId)) >= MAX_RUNNING) return NextResponse.json({ error: `${MAX_RUNNING} motions are already being made. Wait for one to finish.` }, { status: 429 });
  const settings = await checkedSettings(u.userId, b?.settings);
  const kit = await kitFor(u.userId, settings.brandKitId);
  const motion = await db.motion.create({ data: { userId: u.userId, projectId: typeof b?.projectId === "string" ? b.projectId.slice(0, 80) : null, prompt, settings: settings as object } });
  const v = await db.motionVersion.create({ data: { motionId: motion.id, userId: u.userId, n: 1, label: prompt.slice(0, 300), kind: "create", aspect: settings.aspect, duration: settings.duration === "auto" ? 10 : settings.duration } });
  runInBackground({ versionId: v.id, userId: u.userId, personId: u.personId, settings, brief: prompt, kit });
  return NextResponse.json({ id: motion.id, versionId: v.id });
}
