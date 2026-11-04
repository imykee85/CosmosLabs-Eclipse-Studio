import { createHmac, timingSafeEqual } from "node:crypto";
import { serverSecret } from "@/lib/server-secret";
import { waitUntil } from "@vercel/functions";
import type { AgentPlan, Prisma } from "@prisma/client";
import { db } from "./db";
import { enabledModels, toPublic } from "./models";
import { DIRECT_KEY, routeFor } from "./routes";
import { arkRouteBlocked } from "./video-submit";
import { finalizeGeneration } from "./generation-jobs";
import { finalizeVideo } from "./video-jobs";
import { freeCredits } from "./reservations";
import { startRender, type StartRenderInput, type StartRenderResult } from "./start-render";
import { startVideoRender, videoSettings, type StartVideoInput, type StartVideoResult } from "./start-video";
import { getAudioJob, startAudioJob, type StartAudioInput, type StartAudioResult } from "./audio/jobs";
import { findAudioModel } from "./audio/registry";
import { ctxFor, providerFor } from "./audio/providers";
import { newPlan, type PlanSpec, type PlanState, type PlanStep } from "./agent-plan";
import { planSetup, quoteWith, type PlanSetup } from "./agent-plan-setup";

// Atlas plans run on the SERVER: the person approves once and can close the app. `advancePlan` does whatever can be done now (start a step, check one that runs) and
// returns; `drive` calls it every few seconds for up to ~4.5 minutes and then hands over to a fresh function (`chain`), so a plan keeps going without any browser.
// Every start goes through the same functions as the studios (prices, holds, limits, moderation). A failed step stops the plan; nothing later is started.
export const PLAN_MAX_MS = 90 * 60 * 1000; // a plan that has not finished after this long is given up
const LOCK_MS = 90 * 1000;
const POLL_MS = 4000;
const DRIVE_MS = 270 * 1000;
const MAX_RUNNING = 2;

type Run = { setup: PlanSetup; heroId?: string; sceneIds?: string[]; videoId?: string; voiceId?: string; musicId?: string };
export type PlanDeps = {
  startImage: (i: StartRenderInput) => Promise<StartRenderResult>;
  startVideo: (i: StartVideoInput) => Promise<StartVideoResult>;
  check: (kind: "image" | "video" | "audio", id: string, userId: string) => Promise<{ status: "pending" | "completed" | "failed"; error?: string }>;
  startAudio: (i: StartAudioInput) => Promise<StartAudioResult>;
  quoteAudio: (i: StartAudioInput) => Promise<{ ok: true; quote: number | null } | { ok: false; status: number; error: string }>;
  voice: () => Promise<{ id: string; name: string } | null>; // the voice a plan's voiceover is spoken in
};
export const VOICE_MODEL = "eleven_v4";
export const MUSIC_MODEL = "music_v2_5";
let voiceCache: { at: number; v: { id: string; name: string } | null } | null = null;
async function defaultVoice(): Promise<{ id: string; name: string } | null> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60_000) return voiceCache.v;
  const m = findAudioModel(VOICE_MODEL);
  const ctx = m ? ctxFor(m) : null;
  if (!m || !ctx) return null;
  try {
    const list = await providerFor(m).listVoices?.(ctx, {});
    const v = list?.[0] ? { id: list[0].voiceId, name: list[0].name } : null;
    voiceCache = { at: Date.now(), v };
    return v;
  } catch { return null; }
}
export const realDeps: PlanDeps = {
  startImage: startRender,
  startVideo: startVideoRender,
  startAudio: (i) => startAudioJob(i),
  quoteAudio: (i) => startAudioJob(i, { dryRun: true }),
  voice: defaultVoice,
  async check(kind, id, userId) {
    if (kind === "audio") {
      const j = await getAudioJob(userId, id);
      if (!j) return { status: "failed", error: "It was removed before it finished." };
      return j.status === "completed" ? { status: "completed" } : j.status === "failed" ? { status: "failed", error: j.error ?? undefined } : { status: "pending" };
    }
    const row = await db.generation.findFirst({ where: { id, userId } });
    if (!row) return { status: "failed", error: "It was removed before it finished." };
    const g = kind === "video" ? await finalizeVideo(row) : await finalizeGeneration(row);
    return g.status === "completed" ? { status: "completed" } : g.status === "failed" ? { status: "failed", error: g.error ?? undefined } : { status: "pending" };
  },
};

const asRun = (r: Prisma.JsonValue) => r as unknown as Run;
const asSteps = (s: Prisma.JsonValue) => s as unknown as PlanStep[];
const asSpec = (s: Prisma.JsonValue) => s as unknown as PlanSpec;

/** The plan as the card shows it. */
export function planView(row: AgentPlan): { id: string; createdAt: string; plan: PlanState } {
  return { id: row.id, createdAt: row.createdAt.toISOString(), plan: { id: row.id, spec: asSpec(row.spec), steps: asSteps(row.steps), status: row.status as PlanState["status"], price: row.price, note: row.note ?? undefined } };
}
/** The person's plans, newest first (the history list). */
export async function listPlans(userId: string, limit = 30) {
  return (await db.agentPlan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit })).map(planView);
}

/** The settings the server would run a spec with, and the card's price. Used by the create route. */
export function quoteOnServer(spec: PlanSpec): { setup: PlanSetup | string; plan: PlanState } {
  const models = enabledModels().map(toPublic);
  const direct = Object.keys(DIRECT_KEY).filter((id) => routeFor(id) === "direct" && !(arkRouteBlocked() && id.startsWith("seedance")));
  const setup = planSetup(spec, models, direct, videoSettings().creditsOn);
  return { setup, plan: quoteWith(spec, setup, models) };
}

/** The card's plan with its TOTAL price, the voiceover and music included (their own quotes), or the plain reason the plan cannot run. */
export async function quoteFull(userId: string, spec: PlanSpec, deps: PlanDeps = realDeps): Promise<{ setup: PlanSetup | string; plan: PlanState }> {
  const { setup, plan } = quoteOnServer(spec);
  if (typeof setup === "string") return { setup, plan };
  let extra = 0, known = plan.price != null;
  if (plan.spec.voiceover) {
    const voice = await deps.voice();
    if (!voice) return { setup: "A voice for the voiceover is not available right now.", plan: { ...plan, note: "A voice for the voiceover is not available right now.", price: null } };
    const q = await deps.quoteAudio({ userId, kind: "tts", model: VOICE_MODEL, text: plan.spec.voiceover, voiceId: voice.id });
    if (!q.ok) return { setup: q.error, plan: { ...plan, note: q.error, price: null } };
    if (q.quote == null) known = false; else extra += q.quote;
  }
  if (plan.spec.music) {
    const q = await deps.quoteAudio({ userId, kind: "music", model: MUSIC_MODEL, text: plan.spec.music, durationSec: Math.max(3, setup.seconds), instrumental: true });
    if (!q.ok) return { setup: q.error, plan: { ...plan, note: q.error, price: null } };
    if (q.quote == null) known = false; else extra += q.quote;
  }
  return { setup, plan: { ...plan, price: known && plan.price != null ? plan.price + extra : null } };
}

export type CreateResult = { ok: true; row: AgentPlan } | { ok: false; status: number; error: string };
export async function createPlan(o: { userId: string; personId: string | null; projectId: string | null; spec: PlanSpec }, deps: PlanDeps = realDeps): Promise<CreateResult> {
  if ((await db.agentPlan.count({ where: { userId: o.userId, status: "running" } })) >= MAX_RUNNING) return { ok: false, status: 429, error: "You already have plans running. Wait for one to finish." };
  const { setup, plan } = await quoteFull(o.userId, o.spec, deps);
  if (typeof setup === "string") return { ok: false, status: 400, error: setup };
  if (plan.price != null && (await freeCredits(o.userId)) < plan.price) return { ok: false, status: 402, error: "You don't have enough credits for the whole plan. Top up in Settings, Billing, then approve it again." };
  const row = await db.agentPlan.create({
    data: { userId: o.userId, personId: o.personId, projectId: o.projectId, spec: plan.spec as unknown as Prisma.InputJsonValue, steps: plan.steps as unknown as Prisma.InputJsonValue, run: { setup } as unknown as Prisma.InputJsonValue, status: "running", price: plan.price ?? null, deadlineAt: new Date(Date.now() + PLAN_MAX_MS) },
  });
  return { ok: true, row };
}

const setStep = (steps: PlanStep[], id: string, patch: Partial<PlanStep>) => steps.map((s) => (s.id === id ? { ...s, ...patch } : s));

type Out = { steps: PlanStep[]; run: Run; status: "running" | "done" | "failed"; note?: string };

// Does everything that can be done right now, in order, and stops at the first thing still running.
async function step(row: AgentPlan, deps: PlanDeps): Promise<Out> {
  const spec = asSpec(row.spec);
  let steps = asSteps(row.steps);
  const run = { ...asRun(row.run) };
  const s = run.setup;
  const fail = (id: string, why: string): Out => ({ steps: setStep(steps, id, { state: "failed", error: why }), run, status: "failed", note: why });
  const userId = row.userId;
  const projectId = row.projectId ?? undefined;

  // 1. the hero image
  if (!run.heroId) {
    const mine = spec.refs ?? [];
    const r = await deps.startImage({ userId, prompt: spec.hero, model: s.modelId, aspectRatio: s.ratio, resolution: s.resolution, projectId, ...(mine.length ? { references: mine } : {}) });
    if (!r.ok) return fail("hero", r.error);
    run.heroId = r.item.id;
    steps = setStep(steps, "hero", { state: "running", ids: [run.heroId] });
  }
  if (steps.find((x) => x.id === "hero")?.state !== "done") {
    const c = await deps.check("image", run.heroId, userId);
    if (c.status === "failed") return fail("hero", c.error ?? "The hero image could not be made.");
    if (c.status === "pending") return { steps, run, status: "running" };
    steps = setStep(steps, "hero", { state: "done", ids: [run.heroId] });
  }

  // 2. the extra pictures, each made from the hero so the subject and look stay the same
  if (!run.sceneIds) {
    const ids: string[] = [];
    let why = "";
    for (const sc of spec.scenes.slice(0, s.pictures - 1)) {
      const r = await deps.startImage({ userId, prompt: `Image 1 is the hero image${(spec.refs?.length ?? 0) ? ", and the other pictures are the user's own references" : ""}. ${sc} Keep the same subject, identity, look, lighting and style as image 1.`, model: s.modelId, aspectRatio: s.ratio, resolution: s.resolution, projectId, references: [{ type: "render", id: run.heroId }, ...(spec.refs ?? [])] });
      if (!r.ok) { why = r.error; break; }
      ids.push(r.item.id);
    }
    run.sceneIds = ids;
    steps = setStep(steps, "scenes", { state: why ? "failed" : "running", ids, ...(why ? { error: why } : {}) });
    if (why) return { steps, run, status: "failed", note: why };
  }
  if (steps.find((x) => x.id === "scenes")?.state !== "done") {
    const cs = await Promise.all(run.sceneIds.map((id) => deps.check("image", id, userId)));
    const bad = cs.find((c) => c.status === "failed");
    if (bad) return fail("scenes", bad.error ?? "A picture could not be made.");
    if (cs.some((c) => c.status === "pending")) return { steps, run, status: "running" };
    steps = setStep(steps, "scenes", { state: "done", ids: run.sceneIds });
  }

  // 3. one video from all of them, in order
  if (!run.videoId) {
    const r = await deps.startVideo({
      userId, personId: row.personId, prompt: spec.video, model: s.vmodelId, duration: s.seconds, resolution: s.quality, aspectRatio: s.vratio, audio: false, projectId,
      refs: [...[run.heroId, ...run.sceneIds].map((id) => ({ type: "render", id })), ...(spec.refs ?? [])],
    });
    if (!r.ok) return fail("video", r.needsConfirm ? "The video now costs more than the plan showed, so it was not started. The pictures are in your Gallery." : r.error);
    run.videoId = r.item.id;
    steps = setStep(steps, "video", { state: "running", ids: [run.videoId] });
  }
  // 4. the sound (optional): made beside the video, from the same moment it starts
  if (spec.voiceover && !run.voiceId) {
    const voice = await deps.voice();
    if (!voice) return fail("voice", "A voice for the voiceover is not available right now.");
    const r = await deps.startAudio({ userId, kind: "tts", model: VOICE_MODEL, text: spec.voiceover, voiceId: voice.id, voiceName: voice.name, projectId });
    if (!r.ok) return fail("voice", r.error);
    run.voiceId = r.item.id;
    steps = setStep(steps, "voice", { state: "running", ids: [run.voiceId] });
  }
  if (spec.music && !run.musicId) {
    const r = await deps.startAudio({ userId, kind: "music", model: MUSIC_MODEL, text: spec.music, durationSec: Math.max(3, s.seconds), instrumental: true, projectId });
    if (!r.ok) return fail("music", r.error);
    run.musicId = r.item.id;
    steps = setStep(steps, "music", { state: "running", ids: [run.musicId] });
  }

  // 5. everything started: wait for all of it
  const waits: { id: string; kind: "video" | "audio"; stepId: string }[] = [{ id: run.videoId, kind: "video", stepId: "video" }, ...(run.voiceId ? [{ id: run.voiceId, kind: "audio" as const, stepId: "voice" }] : []), ...(run.musicId ? [{ id: run.musicId, kind: "audio" as const, stepId: "music" }] : [])];
  let pending = false;
  for (const w of waits) {
    if (steps.find((x) => x.id === w.stepId)?.state === "done") continue;
    const c = await deps.check(w.kind, w.id, userId);
    if (c.status === "failed") return fail(w.stepId, c.error ?? (w.kind === "video" ? "The video could not be made." : "The sound could not be made."));
    if (c.status === "pending") { pending = true; continue; }
    steps = setStep(steps, w.stepId, { state: "done", ids: [w.id] });
  }
  return { steps, run, status: pending ? "running" : "done" };
}

/** One pass. Safe to call from anywhere at any time: one caller at a time does the work (a lock row), the others just read. */
export async function advancePlan(id: string, deps: PlanDeps = realDeps): Promise<AgentPlan | null> {
  const row = await db.agentPlan.findUnique({ where: { id } });
  if (!row || row.status !== "running") return row;
  if (row.deadlineAt.getTime() < Date.now()) {
    return db.agentPlan.update({ where: { id }, data: { status: "failed", note: "The plan took too long and was stopped. What it made is in your Gallery.", lockedAt: null } });
  }
  const claimed = await db.agentPlan.updateMany({ where: { id, status: "running", OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] }, data: { lockedAt: new Date() } });
  if (claimed.count === 0) return db.agentPlan.findUnique({ where: { id } });
  let out: Out | null = null;
  try {
    // read it again now that it is ours: another pass may have finished a step between the first read and the claim
    const mine = await db.agentPlan.findUnique({ where: { id } });
    if (!mine || mine.status !== "running") { await db.agentPlan.updateMany({ where: { id }, data: { lockedAt: null } }); return mine; }
    out = await step(mine, deps);
  } catch (err) {
    console.error("plan step failed", err);
    return db.agentPlan.update({ where: { id }, data: { lockedAt: null } }); // try again on the next pass
  }
  // a Stop pressed while the step ran wins
  const fresh = await db.agentPlan.findUnique({ where: { id }, select: { status: true } });
  const status = fresh?.status === "canceled" ? "canceled" : out.status;
  return db.agentPlan.update({ where: { id }, data: { steps: out.steps as unknown as Prisma.InputJsonValue, run: out.run as unknown as Prisma.InputJsonValue, status, note: out.note ?? (status === "canceled" ? "Stopped. What it made is in your Gallery." : null), lockedAt: null } });
}

export async function cancelPlan(id: string, userId: string): Promise<AgentPlan | null> {
  const r = await db.agentPlan.updateMany({ where: { id, userId, status: "running" }, data: { status: "canceled", note: "Stopped. What it made is in your Gallery." } });
  return r.count ? db.agentPlan.findUnique({ where: { id } }) : db.agentPlan.findFirst({ where: { id, userId } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Advances a plan every few seconds until it ends or the time is up; then hands over to a fresh function so it never depends on a browser. */
export async function drive(id: string, deps: PlanDeps = realDeps, budgetMs = DRIVE_MS, chainOn = true): Promise<AgentPlan | null> {
  const end = Date.now() + budgetMs;
  let row = await advancePlan(id, deps);
  while (row && row.status === "running" && Date.now() < end) {
    await sleep(POLL_MS);
    row = await advancePlan(id, deps);
  }
  if (row && row.status === "running" && chainOn) await chain(id);
  return row;
}

// ---- the hand-over ----
const secret = () => serverSecret(process.env.CRON_SECRET, process.env.CLERK_SECRET_KEY);
export const planToken = (id: string) => createHmac("sha256", secret()).update(`plan:${id}`).digest("hex");
export function validPlanToken(id: string, given: string | null): boolean {
  const a = Buffer.from(given ?? ""), b = Buffer.from(planToken(id));
  return a.length === b.length && timingSafeEqual(a, b);
}
const base = () => (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
async function chain(id: string) {
  try {
    await fetch(`${base()}/api/plans/${id}/continue`, { method: "POST", headers: { "x-plan-token": planToken(id) }, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    console.error("plan hand-over failed (the daily job or the next look will carry on)", err);
  }
}

/** Keeps a plan going after the reply has been sent. */
export const driveInBackground = (id: string) => waitUntil(drive(id).then(() => undefined).catch((e) => console.error("plan drive failed", e)));
