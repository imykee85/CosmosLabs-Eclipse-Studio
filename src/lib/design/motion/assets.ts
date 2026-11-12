"use client";
// Design Studio Motion: Atlas makes the pictures and clips a motion uses. A picture goes through Image Studio's own start (prices, holds, moderation),
// a clip through Video Studio's route; both are polled until they are finished and then handed back to be attached to the motion.
import { startImages, tierResolution } from "@/lib/image-render";
import { capsFor, PICKER_MODELS, type VideoModel } from "@/lib/video-models";
import { fmtCredits } from "@/lib/credit-units";
import type { PublicModel } from "@/lib/models";
import type { MotionDefaults } from "./spec";

export type MadeAsset = { kind: "image" | "video"; id: string; label: string; sec?: number | null };

const ratioValue = (r: string) => { const [w, h] = r.split(":").map(Number); return w > 0 && h > 0 ? w / h : 1; };
/** The offered ratio nearest the wanted one (on a log scale, so 2:1 is as far from 1:1 as 1:2). */
export function nearestRatio(want: string, offered: string[]): string {
  const list = offered.filter((r) => /^\d+:\d+$/.test(r));
  if (!list.length) return want;
  if (list.includes(want)) return want;
  const w = Math.log(ratioValue(want));
  return list.reduce((best, r) => (Math.abs(Math.log(ratioValue(r)) - w) < Math.abs(Math.log(ratioValue(best)) - w) ? r : best), list[0]);
}

export const liveVideoModels = (): VideoModel[] => PICKER_MODELS.filter((m) => !!m.live && !m.draftOf);
/** The clip model: the person's default when it is connected, else Seedance 2.5, else the first connected one. */
export function videoModelFor(d: MotionDefaults): VideoModel | null {
  const live = liveVideoModels();
  return live.find((m) => m.id === d.video) ?? live.find((m) => m.id === "seedance_2_5") ?? live[0] ?? null;
}

async function startImage(prompt: string, ratio: string, d: MotionDefaults, models: PublicModel[], projectId: string | null): Promise<{ id: string } | { error: string }> {
  const usable = models.filter((m) => !m.requiresReference);
  const chosen = usable.find((m) => m.id === d.image) ?? null;
  const model = chosen ?? usable.find((m) => m.verified) ?? usable[0];
  if (!model) return { error: "No picture model is available right now." };
  const r = await startImages({ models: usable, model, auto: !chosen, prompt, ratio: chosen ? nearestRatio(ratio, chosen.ratios) : ratio, tier: chosen && !tierResolution(chosen.resolutions, "2k") ? "1k" : "2k", qty: 1, refs: [], seedOn: false, seedNum: null, projectId });
  const first = r.results[0];
  return first?.ok && first.id ? { id: first.id } : { error: first?.error ?? "The picture could not be started." };
}

async function startVideo(prompt: string, ratio: string, d: MotionDefaults, projectId: string | null, confirm = false): Promise<{ id: string } | { error: string }> {
  const m = videoModelFor(d);
  if (!m) return { error: "No video model is available right now." };
  const caps = capsFor(m, "t2v");
  const body = {
    prompt, model: m.id, duration: caps.defaultDuration, projectId: projectId ?? undefined, resolution: caps.defaultQuality || undefined,
    aspectRatio: caps.ratios.length ? nearestRatio(ratio, caps.ratios) || caps.defaultRatio : undefined, audio: caps.audio ? false : undefined, confirm: confirm || undefined,
  };
  const res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 && data.needsConfirm && !confirm) {
    if (!window.confirm(`This clip costs ${fmtCredits(data.cost)} credits. Make it?`)) return { error: "Not made." };
    return startVideo(prompt, ratio, d, projectId, true);
  }
  if (!res.ok || typeof data.id !== "string") return { error: typeof data.error === "string" ? data.error : "The clip could not be started." };
  return { id: data.id };
}

/** Waits for a picture or clip to finish (the status route also finishes it on our side). */
export async function waitFor(id: string, signal?: AbortSignal): Promise<{ ok: true; sec: number | null } | { ok: false; error: string }> {
  const until = Date.now() + 40 * 60_000;
  let wait = 3000;
  while (Date.now() < until) {
    if (signal?.aborted) return { ok: false, error: "Stopped." };
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(8000, wait + 1000);
    const res = await fetch(`/api/generations/${id}/status`).catch(() => null);
    if (!res) continue;
    if (res.status === 404) return { ok: false, error: "It was removed." };
    const g = await res.json().catch(() => ({}));
    if (g.status === "completed") return { ok: true, sec: typeof g.durationSec === "number" ? g.durationSec : null };
    if (g.status === "failed") return { ok: false, error: typeof g.error === "string" ? g.error : "It could not be made." };
  }
  return { ok: false, error: "It took too long." };
}

/** Starts the asset and resolves when it is finished (or failed). `onStarted` fires as soon as the render is running. */
export async function makeAsset(o: { kind: "image" | "video"; prompt: string; ratio: string; defaults: MotionDefaults; models: PublicModel[]; projectId: string | null; onStarted?: () => void }): Promise<{ ok: true; asset: MadeAsset } | { ok: false; error: string }> {
  const prompt = o.prompt.trim();
  if (prompt.length < 3) return { ok: false, error: "There is no prompt for it." };
  const started = o.kind === "video" ? await startVideo(prompt, o.ratio, o.defaults, o.projectId) : await startImage(prompt, o.ratio, o.defaults, o.models, o.projectId);
  if ("error" in started) return { ok: false, error: started.error };
  o.onStarted?.();
  const done = await waitFor(started.id);
  if (!done.ok) return done;
  return { ok: true, asset: { kind: o.kind, id: started.id, label: prompt.slice(0, 60), sec: done.sec } };
}
