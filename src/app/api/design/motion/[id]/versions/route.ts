import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";
import { briefCheck } from "@/lib/design/motion/agent";
import { cleanSettings, isAspect, type MotionComment } from "@/lib/design/motion/spec";
import { checkedSettings, kitFor, MAX_RUNNING, motionUser, runInBackground, runningCount } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A new version from an existing one: "edit" (a change request plus any pinned comments), "adapt" (another aspect ratio, a new branch) or "retry".
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser();
  if ("res" in u) return u.res;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Motion is not available yet. Please try again later." }, { status: 503 });
  const motion = await db.motion.findFirst({ where: { id, userId: u.userId, deletedAt: null } });
  if (!motion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => null);
  const action = b?.action === "adapt" ? "adapt" : b?.action === "retry" ? "retry" : "edit";
  const from = typeof b?.from === "string" ? await db.motionVersion.findFirst({ where: { id: b.from, motionId: id } }) : null;
  if (!from) return NextResponse.json({ error: "Pick a version first." }, { status: 400 });
  const text = typeof b?.text === "string" ? b.text.trim().slice(0, 4000) : "";
  const all = Array.isArray(from.comments) ? (from.comments as MotionComment[]) : [];
  const comments = action === "edit" ? all.filter((c) => !c.used) : [];
  if (action === "edit" && !text && !comments.length) return NextResponse.json({ error: "Describe a change or pin a comment first." }, { status: 400 });
  if ((action === "edit" || action === "adapt") && !from.code) return NextResponse.json({ error: "That version has no motion to change yet." }, { status: 400 });
  const bad = briefCheck([text, ...comments.map((c) => c.text)].join("\n"));
  if (bad) return NextResponse.json({ error: bad }, { status: 422 });
  if (!(await claimUsage(u.userId, "design-motion", 10, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  if ((await runningCount(u.userId)) >= MAX_RUNNING) return NextResponse.json({ error: `${MAX_RUNNING} motions are already being made. Wait for one to finish.` }, { status: 429 });
  const base = cleanSettings(motion.settings);
  const aspect = action === "adapt" && isAspect(b?.aspect) ? b.aspect : (from.aspect as typeof base.aspect);
  const settings = { ...(await checkedSettings(u.userId, { ...base, ...(b?.settings && typeof b.settings === "object" ? b.settings : {}) })), aspect, duration: action === "retry" ? base.duration : from.duration };
  const last = await db.motionVersion.findFirst({ where: { motionId: id }, orderBy: { n: "desc" } });
  const label = action === "adapt" ? `Adapt to ${aspect}` : action === "retry" ? `Try again: ${motion.prompt.slice(0, 200)}` : [comments.length ? `${comments.map((c) => `${c.t.toFixed(1)}s ${c.text}`).join("; ")}` : "", text].filter(Boolean).join(" · ").slice(0, 300);
  const v = await db.motionVersion.create({ data: { motionId: id, userId: u.userId, n: (last?.n ?? 0) + 1, parentId: from.id, label, kind: action, aspect, duration: from.duration } });
  if (comments.length) await db.motionVersion.update({ where: { id: from.id }, data: { comments: all.map((c) => (comments.some((x) => x.id === c.id) ? { ...c, used: true } : c)) as object } });
  await db.motion.update({ where: { id }, data: { updatedAt: new Date() } });
  const kit = await kitFor(u.userId, settings.brandKitId);
  runInBackground({ versionId: v.id, userId: u.userId, personId: u.personId, settings, kit, brief: action === "retry" ? motion.prompt : text,
    base: action === "retry" ? null : { code: from.code!, duration: from.duration, aspect: from.aspect as typeof aspect }, comments });
  return NextResponse.json({ versionId: v.id });
}
