"use client";

import type { PublicModel } from "./models";
import { imageCost, startImages, tierResolution } from "./image-render";
import { toolModel, toolTier } from "./picture-tools";
import { capsFor, isLive, videoModelById, videoPrice, workflowFor } from "./video-models";
import { readCurrentProject } from "./projects";
import { refreshCredits } from "./use-credits";
import { fmtCredits } from "./credit-units";
import { newPlan, type PlanSpec, type PlanState } from "./agent-plan";

// Runs an Atlas plan in the browser after the person's single approval: hero image, then the extra pictures (made from the hero), then ONE video that uses all
// of them as references. Every step goes through the same routes as the studios, so prices, holds, limits and plan locks are the usual ones. If a step fails the plan
// stops there; what was already made stays in the Gallery and nothing later is started or charged.
const VIDEO_MODEL = "seedance_2_5";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Setup = { models: PublicModel[]; model: PublicModel; tier: string; resolution?: string; ratio: string; refMax: number; vmodelId: string; quality: string; seconds: number; route: "direct" | "higgsfield"; creditsOn: boolean; vratio: string };

async function setupFor(spec: PlanSpec): Promise<Setup | string> {
  const [mr, cr] = await Promise.all([fetch("/api/models").then((r) => (r.ok ? r.json() : null)).catch(() => null), fetch("/api/video/config").then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  const models: PublicModel[] = Array.isArray(mr?.models) ? mr.models : [];
  const model = toolModel(models, "camera");
  if (!model) return "No picture model is available on this account.";
  const vm = videoModelById(VIDEO_MODEL);
  if (!vm || !isLive(vm)) return "The video model for plans is not available right now.";
  const caps = capsFor(vm, workflowFor(vm, false, true));
  if (caps.refMax < 2) return "The video model for plans cannot take reference pictures right now.";
  const tier = toolTier(model, "camera");
  const quality = caps.qualities.includes("720p") ? "720p" : caps.defaultQuality;
  const seconds = caps.durations.reduce((best, d) => (Math.abs(d - spec.seconds) < Math.abs(best - spec.seconds) ? d : best), caps.durations[0]);
  const vratio = caps.ratios.includes(spec.ratio) ? spec.ratio : caps.defaultRatio;
  return { models, model, tier, resolution: model.resolutions.length ? tierResolution(model.resolutions, tier) : undefined, ratio: model.ratios.includes(spec.ratio) ? spec.ratio : "auto", refMax: caps.refMax, vmodelId: vm.id, quality, seconds, route: Array.isArray(cr?.direct) && cr.direct.includes(vm.id) ? "direct" : "higgsfield", creditsOn: !!cr?.creditsOn, vratio };
}

/** The pictures the video can take: the hero plus the scenes, trimmed to what the model accepts. */
export const sceneLimit = (refMax: number, scenes: number) => Math.max(0, Math.min(scenes, refMax - 1));

/** The total price of a plan in ledger units (null while credits are off or a price is missing) with the plan as the card shows it. */
export async function quotePlan(spec: PlanSpec): Promise<PlanState> {
  const s = await setupFor(spec);
  if (typeof s === "string") return { ...newPlan(spec, null), note: s };
  const n = 1 + sceneLimit(s.refMax, spec.scenes.length);
  const img = imageCost(s.model, s.resolution, 1);
  const vid = videoPrice(videoModelById(s.vmodelId)!, s.quality, s.seconds, false, s.route);
  const plan = newPlan({ ...spec, scenes: spec.scenes.slice(0, n - 1), seconds: s.seconds, ratio: s.vratio }, s.creditsOn && img != null && vid != null ? img * n + vid : null);
  return plan;
}

async function waitFor(path: string, cancelled: () => boolean, doneWhen: (g: Record<string, unknown>) => boolean = (g) => g.status === "completed"): Promise<string | null> {
  for (let i = 0; i < 600; i++) {
    if (cancelled()) return "Stopped.";
    await sleep(i < 10 ? 2500 : 5000);
    try {
      const res = await fetch(path);
      if (res.status === 404) return "It was removed before it finished.";
      const g = await res.json().catch(() => ({}));
      if (doneWhen(g)) return null;
      if (res.ok && g.status === "failed") return typeof g.error === "string" ? g.error : "It could not be made.";
    } catch {}
  }
  return "It took too long and the plan stopped.";
}

/** Runs the plan. `update` is called with the new state each time it changes. Resolves when the plan is done, failed or canceled. */
export async function runPlan(start: PlanState, update: (p: PlanState) => void, cancelled: () => boolean): Promise<void> {
  let p: PlanState = { ...start, status: "running", steps: start.steps.map((s) => ({ ...s })), note: undefined };
  const set = (id: string, patch: Partial<PlanState["steps"][number]>) => { p = { ...p, steps: p.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }; update(p); };
  const stop = (id: string, why: string) => { set(id, { state: "failed", error: why }); p = { ...p, status: cancelled() ? "canceled" : "failed", note: why }; update(p); refreshCredits(); };
  update(p);
  const s = await setupFor(p.spec);
  if (typeof s === "string") { p = { ...p, status: "failed", note: s }; update(p); return; }
  const bal = await fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (s.creditsOn && p.price != null && bal && typeof bal.balance === "number" && bal.balance < p.price) {
    p = { ...p, status: "failed", note: "You don't have enough credits for the whole plan. Top up in Settings, Billing, then approve it again." };
    update(p); return;
  }
  const projectId = readCurrentProject()?.id;
  const spec = p.spec;

  // 1. the hero image
  set("hero", { state: "running" });
  const hero = await startImages({ models: s.models, model: s.model, auto: false, prompt: spec.hero, ratio: s.ratio, tier: s.tier, qty: 1, refs: [], seedOn: false, seedNum: null, projectId });
  const h = hero.results[0];
  if (!h?.ok || !h.id) return stop("hero", h?.error ?? "The hero image could not be started.");
  const heroId = h.id;
  const heroWhy = await waitFor(`/api/generations/${heroId}`, cancelled);
  if (heroWhy) return stop("hero", heroWhy);
  set("hero", { state: "done", ids: [heroId] });
  refreshCredits();

  // 2. the extra pictures, each made from the hero so the subject and look stay the same
  set("scenes", { state: "running" });
  const prompts = spec.scenes.slice(0, sceneLimit(s.refMax, spec.scenes.length));
  const started = await Promise.all(prompts.map((sc) => startImages({ models: s.models, model: s.model, auto: false, prompt: `Image 1 is the hero image. ${sc} Keep the same subject, identity, look, lighting and style as image 1.`, ratio: s.ratio, tier: s.tier, qty: 1, refs: [{ type: "render", id: heroId }], seedOn: false, seedNum: null, projectId }).then((r) => r.results[0])));
  const bad = started.find((r) => !r?.ok || !r.id);
  const sceneIds = started.flatMap((r) => (r?.ok && r.id ? [r.id] : []));
  if (bad) return stop("scenes", bad?.error ?? "A picture could not be started.");
  const sceneWhy = (await Promise.all(sceneIds.map((id) => waitFor(`/api/generations/${id}`, cancelled)))).find(Boolean);
  if (sceneWhy) { set("scenes", { ids: sceneIds }); return stop("scenes", sceneWhy); }
  set("scenes", { state: "done", ids: sceneIds });
  refreshCredits();
  if (cancelled()) return stop("video", "Stopped.");

  // 3. one video from all of them, in order
  set("video", { state: "running" });
  const body = (confirm: boolean) => JSON.stringify({ prompt: spec.video, model: s.vmodelId, duration: s.seconds, projectId, resolution: s.quality, aspectRatio: s.vratio, audio: false, refs: [heroId, ...sceneIds].map((id) => ({ type: "render", id })), confirm: confirm || undefined });
  let res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: body(false) });
  let d = await res.json().catch(() => ({}));
  if (res.status === 409 && d.needsConfirm) {
    if (!window.confirm(`The video now costs ${fmtCredits(Number(d.cost))} credits. Start it?`)) return stop("video", "You chose not to start the video. The pictures are in your Gallery.");
    res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: body(true) });
    d = await res.json().catch(() => ({}));
  }
  if (!res.ok || typeof d.id !== "string") return stop("video", typeof d.error === "string" ? d.error : "The video could not be started.");
  const vWhy = await waitFor(`/api/generations/${d.id}/status`, cancelled);
  if (vWhy) return stop("video", vWhy);
  set("video", { state: "done", ids: [d.id] });
  p = { ...p, status: "done" };
  update(p);
  refreshCredits();
}
