import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { builtinDef } from "@/lib/core-skills/builtin";
import { sandboxAvailable } from "@/lib/sandbox";
import { claimUsage } from "@/lib/usage";
import { skillEnabled, setSkillEnabled } from "@/lib/core-skills/settings";
import { estimate, startRun, sweepRuns } from "@/lib/sandbox/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const view = (r: { id: string; skillId: string; status: string; step: string; creditsCharged: number; creditCap: number; note: string | null; credits: string | null; resultKey: string | null; createdAt: Date; endedAt: Date | null }) =>
  ({ id: r.id, skillId: r.skillId, status: r.status, step: r.step, creditsCharged: r.creditsCharged, creditCap: r.creditCap, note: r.note, credits: r.credits, hasResult: Boolean(r.resultKey), createdAt: r.createdAt, endedAt: r.endedAt });

// The current estimate, whether builds are switched on, and the person's latest runs.
export async function GET() {
  const u = requireUser(); if ("fail" in u) return u.fail;
  await sweepRuns().catch(() => 0);
  const runs = await db.sandboxRun.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: 5 });
  return NextResponse.json({ available: sandboxAvailable(), enabled: await skillEnabled(u.userId, "design-taste-frontend"), estimate: estimate(), runs: runs.map(view) });
}

// Starts a build. `confirm: true` is the person agreeing to the estimate; without it nothing starts.
export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  const skillId = typeof body?.skillId === "string" ? body.skillId : "";
  if (!builtinDef(skillId)?.requiresSandbox) return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
  if (body?.confirm !== true) return NextResponse.json({ error: "Confirm the cost to start.", estimate: estimate() }, { status: 400 });
  if (!(await claimUsage(u.userId, "sandbox-start", 6, 3600_000))) return NextResponse.json({ error: "Too many tries. Wait a little." }, { status: 429 });
  const r = await startRun(u.userId, skillId);
  if (!r.ok) return NextResponse.json({ error: r.message, code: r.code }, { status: r.code === "unavailable" ? 503 : r.code === "not_paid" ? 402 : r.code === "credits" ? 402 : r.code === "busy" ? 409 : 500 });
  return NextResponse.json({ id: r.runId });
}

// The on/off switch of a built-in skill.
export async function PATCH(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  const skillId = typeof body?.skillId === "string" ? body.skillId : "";
  if (!builtinDef(skillId) || typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
  await setSkillEnabled(u.userId, skillId, body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}
