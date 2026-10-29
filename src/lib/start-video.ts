import { finalizeVideo } from "@/lib/video-jobs";
import { startRefusalText } from "@/lib/video-submit";
import { outOfCredits } from "@/lib/credit-message";
import { refusal } from "@/lib/subscribe-alert";
import { AUTO_RATIO, autoTarget, resolveAutoRatio } from "@/lib/auto-ratio";
import { autoTrimEnabled } from "@/lib/conform";
import { randomInt, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { HiggsfieldError } from "@/lib/higgsfield";
import { ArkError } from "@/lib/providers/byteplus-video";
import { NeedsMoreCredits, PriceChanged, submitRouted, videoRouteNow } from "@/lib/video-submit";
import type { Route } from "@/lib/routes";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, parseVideoRefIds, resolveAudioReferences, resolveReferences, resolveVideoReferences, type ReferenceRef } from "@/lib/references";
import { createGenerationHeld } from "@/lib/reservations";
import { claimUsage } from "@/lib/usage";
import { buildVideoBody, capsFor, findVideoModel, videoPrice, workflowFor } from "@/lib/video-models";

import { fmtCredits, LEDGER_UNITS_PER_CREDIT } from "@/lib/credit-units";
// Settings (all Config values, none are secrets). Defaults are deliberately tight; raise them in Vercel when real costs are known (docs/video-pricing.md).
const num = (name: string, fallback: number) => (Number(process.env[name]) > 0 ? Math.floor(Number(process.env[name])) : fallback);
export const videoSettings = () => ({
  paused: process.env.VIDEO_KILL_SWITCH === "1",             // the global kill switch: set to 1 and every new video is refused (running ones finish)
  perMinute: num("VIDEO_RENDERS_PER_MINUTE", 6),
  perDay: num("VIDEO_RENDERS_PER_DAY", 30),
  maxRunning: num("VIDEO_MAX_RUNNING", 3),
  dailyCredits: num("VIDEO_DAILY_CREDITS", 5000) * LEDGER_UNITS_PER_CREDIT,            // a person's spend on video per rolling day: the setting is in CREDITS (5000), held here in LEDGER units, only counted while credits are on
  confirmAbove: num("VIDEO_CONFIRM_CREDITS", 500) * LEDGER_UNITS_PER_CREDIT,           // above this price (the setting is in CREDITS, 500) one render asks for a confirm first
  creditsOn: process.env.CREDITS_ENABLED === "1",
});

export type StartVideoInput = {
  userId: string; prompt: unknown; model: unknown; duration?: unknown; resolution?: unknown; aspectRatio?: unknown; audio?: unknown;
  seed?: unknown; lockSeed?: unknown; negativePrompt?: unknown; cfgScale?: unknown; start?: unknown; end?: unknown; refs?: unknown; videoRefs?: unknown; audioRefs?: unknown; shots?: unknown; motion?: { orientation?: unknown; keepSound?: unknown } | null; confirm?: unknown; projectId?: unknown; draft?: unknown;
};
export type StartVideoResult = { ok: true; item: RenderItem; seedNote?: string } | { ok: false; status: number; error: string; needsConfirm?: boolean; cost?: number; code?: string };

const oneRef = (v: unknown): ReferenceRef | null | undefined => {
  if (v == null) return undefined;
  const r = parseReferenceRefs([v]);
  return r && r.length === 1 ? r[0] : null; // null = not understood
};

// The one place a video is validated and started (POST /api/video). Same rules as images, plus the video-only ones: kill switch, running and daily limits,
// price confirm. Nothing falls back to another model.
export async function startVideoRender(input: StartVideoInput): Promise<StartVideoResult> {
  const { userId } = input;
  const cfg = videoSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Video generation is paused right now. Please try again later." };
  if (!process.env.HIGGSFIELD_API_KEY) return { ok: false, status: 503, error: "Video generation is not set up yet." };

  const picked = findVideoModel(input.model);
  if (!picked) return { ok: false, status: 400, error: "That model is not available." };
  // A draft entry in the picker is its model in draft mode (a 480p preview; the final 1080p video is made from it later).
  const model = picked.draftOf ? findVideoModel(picked.draftOf) ?? picked : picked;
  const draftMode = model !== picked || input.draft === true;
  if (!model.live) return { ok: false, status: 400, error: `${model.label} is not available yet.` };
  const live = model.live;

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const negativePrompt = typeof input.negativePrompt === "string" ? input.negativePrompt.trim() : "";
  for (const text of [prompt, negativePrompt]) {
    if (!text) continue;
    const m = checkPrompt(text);
    if (!m.ok) { console.warn("prompt refused", m.category); return { ok: false, status: 422, error: m.reason }; }
  }

  let duration = typeof input.duration === "number" ? input.duration : NaN;
  // Multi-shot (Kling 3.0): a list of { prompt, duration }; the length is their sum (checked by buildVideoBody with the model's limits).
  let shots: { prompt: string; duration: number }[] | undefined;
  if (input.shots != null) {
    if (!Array.isArray(input.shots) || input.shots.length > 6 || input.shots.some((x) => !x || typeof x.prompt !== "string" || typeof x.duration !== "number")) return { ok: false, status: 400, error: "The shots were not understood." };
    shots = (input.shots as { prompt: string; duration: number }[]).map((x) => ({ prompt: x.prompt.slice(0, 600), duration: x.duration }));
    if (shots.length) duration = shots.reduce((a, x) => a + x.duration, 0); else shots = undefined;
    for (const sh of shots ?? []) { const c = checkPrompt(sh.prompt); if (!c.ok) return { ok: false, status: 422, error: c.reason }; }
  }
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  // Start and end frames: ids of the person's own pictures, never addresses.
  const start = oneRef(input.start);
  const end = oneRef(input.end);
  if (start === null || end === null) return { ok: false, status: 400, error: "The pictures were not understood." };
  if (end && !start) return { ok: false, status: 400, error: "An end frame needs a start frame too." };
  // Reference pictures (reference-to-video): ids only, never together with a start or end frame.
  const refs = input.refs == null ? [] : parseReferenceRefs(input.refs, 64); // the model's own limit (up to 30) is checked next
  if (refs === null) return { ok: false, status: 400, error: "The reference pictures were not understood." };
  const videoRefIds = parseVideoRefIds(input.videoRefs, 64); // the model's own limit (up to 10) is checked next
  if (videoRefIds === null) return { ok: false, status: 400, error: "The reference clips were not understood." };
  const audioRefIds = parseVideoRefIds(input.audioRefs, 10); // the person's own Audio Studio takes, [{ id }]
  if (audioRefIds === null) return { ok: false, status: 400, error: "The reference sounds were not understood." };
  const anyRefs = refs.length + videoRefIds.length + audioRefIds.length > 0;
  const motion = live.motion;
  if (motion) {
    // Motion transfer (the Motion chip): ONE subject picture (the start frame) and ONE motion clip, nothing else.
    if (!start || videoRefIds.length !== 1 || refs.length > 0 || end) return { ok: false, status: 400, error: "Motion transfer needs one subject picture (Start frame) and one motion clip." };
  } else if (anyRefs && (start || end)) return { ok: false, status: 400, error: "Use either a start frame or reference pictures and clips, not both." };
  const wf = workflowFor(model, !!start, anyRefs);
  const caps = capsFor(model, wf);
  if (refs.length && !caps.refMax) return { ok: false, status: 400, error: `${model.label} takes no reference pictures yet.` };
  if (videoRefIds.length && !caps.refVideoMax) return { ok: false, status: 400, error: `${model.label} takes no reference clips.` };
  if (audioRefIds.length && !caps.refAudioMax) return { ok: false, status: 400, error: `${model.label} takes no reference sounds.` };
  if (videoRefIds.length > caps.refVideoMax) return { ok: false, status: 400, error: `${model.label} takes up to ${caps.refVideoMax} reference clips (you chose ${videoRefIds.length}).` };
  if (refs.length > caps.refMax) return { ok: false, status: 400, error: `${model.label} takes up to ${caps.refMax} reference pictures (you chose ${refs.length}).` };
  if (end && !caps.endFrame) return { ok: false, status: 400, error: `${model.label} has no end frame.` };
  const pictures = refs.length ? refs : [start, end].filter((r): r is ReferenceRef => !!r);
  // No per-video rights box: every picture and clip here is one of the person's own (finished Eclipse renders, or pictures that were scanned and confirmed when uploaded, src/lib/upload-scan.ts).

  // "Auto" aspect ratio: a model that can pick its own gets the word; otherwise the first picture's shape (nearest ratio the model offers), else its usual ratio.
  let aspectIn = typeof input.aspectRatio === "string" && caps.ratios.length ? input.aspectRatio : undefined;
  // The result must end up in the REFERENCE's exact ratio: the model gets the nearest one it offers and the stored clip is trimmed to the exact ratio (src/lib/conform.ts). Saved on the row as `params.conform`.
  const conform = autoTrimEnabled() && input.aspectRatio === AUTO_RATIO && caps.ratios.length ? await autoTarget(userId, refs[0] ?? start ?? undefined) : null;
  if (aspectIn === AUTO_RATIO && !caps.ratios.includes(AUTO_RATIO)) aspectIn = await resolveAutoRatio(userId, refs[0] ?? start ?? undefined, caps.ratios, caps.defaultRatio);
  // Draft mode (Seedance 2.5 only): a cheap 480p preview that can later be turned into the final 1080p video (src/lib/video-draft.ts). Direct route only.
  const draft = draftMode;
  if (draft && (model.id !== "seedance_2_5" || motion || shots)) return { ok: false, status: 400, error: "Draft previews are available for Seedance 2.5 only." };
  const resolution = draft ? "480p" : typeof input.resolution === "string" ? input.resolution : undefined;
  const audio = typeof input.audio === "boolean" ? input.audio : undefined;

  // Seed: only for a model that has one; always sent to it (the user's, a locked one, or a fresh random one) so a result can be re-run.
  let seed: number | null = null;
  let seedLocked = false;
  let seedNote: string | undefined;
  const seedSpec = caps.seed;
  if (!seedSpec) {
    if (input.seed != null || input.lockSeed === true) seedNote = `${model.label} does not support seeds, so none was used.`;
  } else {
    if (input.seed != null && (typeof input.seed !== "number" || !Number.isInteger(input.seed) || input.seed < seedSpec.min || input.seed > seedSpec.max)) {
      return { ok: false, status: 400, error: `The seed must be a whole number from ${seedSpec.min.toLocaleString("en-US")} to ${seedSpec.max.toLocaleString("en-US")} for ${model.label}.` };
    }
    if (input.seed != null || input.lockSeed === true) {
      seedLocked = true;
      seed = (input.seed as number | null | undefined) ?? (await db.generation.findFirst({ where: { userId, model: model.id, kind: "video", seed: { not: null } }, orderBy: { createdAt: "desc" }, select: { seed: true } }))?.seed ?? randomInt(seedSpec.min, seedSpec.max + 1);
    } else seed = randomInt(seedSpec.min, seedSpec.max + 1);
  }

  // Motion transfer: the length of the result follows the motion clip, so the price and the stored length come from the clip's recorded length.
  const keepSound = input.motion?.keepSound === false ? false : true;
  const orientation = input.motion?.orientation === "image" ? "image" : "video";
  if (motion) {
    const clip = await db.generation.findFirst({ where: { id: videoRefIds[0], userId, kind: "video", status: "completed", deletedAt: null }, select: { durationSec: true } });
    if (!clip) return { ok: false, status: 400, error: "That motion clip could not be found. It may have been deleted." };
    if (clip.durationSec == null) return { ok: false, status: 400, error: "The length of that clip was not recorded, so it cannot be used as a motion clip." };
    if (clip.durationSec < motion.minSec) return { ok: false, status: 400, error: `${model.label} needs a motion clip of at least ${motion.minSec} seconds (this one is ${clip.durationSec}).` };
    if (clip.durationSec > motion.maxSec && !motion.trimsAbove) return { ok: false, status: 400, error: `${model.label} takes a motion clip of up to ${motion.maxSec} seconds (this one is ${clip.durationSec}).` };
    duration = Math.min(Math.ceil(clip.durationSec), motion.maxSec); // longer clips are cut to the first 30 s by the provider
    if (motion.kind === "kling" && start) {
      // Kling's limits for the subject picture: up to 10 MB, 300 to 65,536 px a side, an aspect ratio between 2:5 and 5:2. Checked here so a paid render is not refused later.
      const facts = start.type === "upload"
        ? await db.upload.findFirst({ where: { id: start.id, userId }, select: { width: true, height: true, sizeBytes: true } })
        : await db.generation.findFirst({ where: { id: start.id, userId, kind: "image" }, select: { width: true, height: true, sizeBytes: true } });
      if (facts?.sizeBytes && facts.sizeBytes > 10 * 1024 * 1024) return { ok: false, status: 400, error: "The subject picture is larger than 10 MB. Please use a smaller one." };
      if (facts?.width && facts.height) {
        const ratio = facts.width / facts.height;
        if (Math.min(facts.width, facts.height) < 300 || Math.max(facts.width, facts.height) > 65536) return { ok: false, status: 400, error: "The subject picture must be between 300 and 65,536 pixels on each side." };
        if (ratio < 0.4 || ratio > 2.5) return { ok: false, status: 400, error: "The subject picture is too narrow or too wide (its aspect ratio must be between 2:5 and 5:2)." };
      }
    }
  }

  // Check the request against the model BEFORE anything is held or limited (placeholder addresses stand in for the pictures).
  const probe = buildVideoBody(model, { prompt, duration, resolution, aspectRatio: aspectIn, audio, seed, negativePrompt, cfgScale: typeof input.cfgScale === "number" ? input.cfgScale : undefined, keepSound, orientation, startUrl: start ? "https://x.invalid/s" : undefined, endUrl: end ? "https://x.invalid/e" : undefined, refUrls: refs.length ? refs.map((_, i) => `https://x.invalid/r${i}`) : undefined, refVideoUrls: videoRefIds.length ? videoRefIds.map((_, i) => `https://x.invalid/v${i}`) : undefined, refAudioUrls: audioRefIds.length ? audioRefIds.map((_, i) => `https://x.invalid/a${i}`) : undefined, shots });
  if (!probe.ok) return { ok: false, status: 400, error: probe.error };

  const resolutionUsed = typeof probe.body.resolution === "string" ? probe.body.resolution : undefined;
  const audioCfg = caps.audio ? (audio ?? caps.audioDefault) : false;
  const audioUsed = motion ? motion.kind === "kling" && keepSound : audioCfg;
  // The price follows the route the render really uses (routes.ts: the direct routes have no adapter yet, so this is the Higgsfield price today).
  // Reference clips are the person's own finished videos; BytePlus bills them by length, so the direct price needs each clip's recorded length (unknown = Higgsfield).
  let inputVideoSec: number | null | undefined;
  if (videoRefIds.length) {
    const clips = await db.generation.findMany({ where: { id: { in: videoRefIds }, userId, kind: "video" }, select: { durationSec: true } });
    inputVideoSec = clips.length === videoRefIds.length && clips.every((c) => c.durationSec != null) ? clips.reduce((a, c) => a + Math.ceil(c.durationSec as number), 0) : null;
  }
  const routeNow = motion ? "higgsfield" : await videoRouteNow(model.id, resolutionUsed ?? caps.defaultQuality, inputVideoSec);
  // Seedance never moves to Higgsfield by itself (owner 2026-10-21): when BytePlus cannot take the video the person is told, nothing is held, and the owner decides.
  if (routeNow === "unavailable") return { ok: false, status: 503, error: `${model.label} is having trouble right now. Please try again in a few minutes. Nothing was charged.` };
  const route: Route = routeNow;
  // A model that exists only at BytePlus (Seedance 2.0 Fast/Mini) has no Higgsfield route: when the direct route cannot take the job right now it is refused, not moved.
  // A draft preview can run on either provider (Higgsfield has its own draft mode).
  const onlyDirect = live.directOnly === true;
  if (onlyDirect && route !== "direct") return { ok: false, status: 503, error: `${model.label} is not available right now. Please try again in a few minutes or choose another model.` };
  const cost = cfg.creditsOn ? videoPrice(model, resolutionUsed, duration, audioUsed, route, inputVideoSec ?? undefined) : null;
  const higgsfieldCost = cfg.creditsOn && !onlyDirect ? videoPrice(model, resolutionUsed, duration, audioUsed, "higgsfield") : null;
  if (cost != null) {
    const today = await db.generation.aggregate({ where: { userId, kind: "video", status: { not: "failed" }, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, _sum: { creditsHeld: true } });
    if ((today._sum.creditsHeld ?? 0) + cost > cfg.dailyCredits) return { ok: false, status: 429, error: `That would go over today's video limit of ${fmtCredits(cfg.dailyCredits)} credits.` };
    if (cost > cfg.confirmAbove && input.confirm !== true) return { ok: false, status: 409, needsConfirm: true, cost, error: `This video costs ${fmtCredits(cost)} credits. Confirm to continue.` };
  }

  // Limits per person: a short burst limit, a daily count, how many may run at once, and (with credits on) a daily spend.
  // Rows left "running" by a closed page are settled first (finished, failed or timed out), so they never block a new video.
  const open = await db.generation.findMany({ where: { userId, kind: "video", status: { in: ["pending", "saving"] } }, take: 6 });
  if (open.length) await Promise.race([Promise.allSettled(open.map((g) => finalizeVideo(g))), new Promise((r) => setTimeout(r, 6000))]);
  const running = await db.generation.count({ where: { userId, kind: "video", status: { in: ["pending", "saving"] } } });
  if (running >= cfg.maxRunning) return { ok: false, status: 429, error: `You already have ${running} videos running. Wait for one to finish.` };
  if (!(await claimUsage(userId, "video", cfg.perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting videos very quickly. Wait a moment and try again." };
  if (!(await claimUsage(userId, "video-day", cfg.perDay, 24 * 3600_000))) return { ok: false, status: 429, error: `You have reached today's limit of ${cfg.perDay} videos.` };

  // Pictures: turned into addresses the provider can fetch (Higgsfield's own upload, else a one-hour signed link).
  let startUrl: string | undefined;
  let endUrl: string | undefined;
  let refUrls: string[] | undefined;
  let refVideoUrls: string[] | undefined;
  let refAudioUrls: string[] | undefined;
  if (audioRefIds.length) {
    const sounds = await resolveAudioReferences(userId, audioRefIds);
    if (!sounds.ok) return { ok: false, status: 400, error: sounds.error };
    refAudioUrls = sounds.urls;
  }
  if (pictures.length) {
    const resolved = await resolveReferences(userId, pictures);
    if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
    const urls = await deliverReferences(resolved.items);
    if (refs.length) refUrls = urls; else { startUrl = urls[0]; endUrl = end ? urls[1] : undefined; }
  }
  if (videoRefIds.length) {
    const clips = await resolveVideoReferences(userId, videoRefIds);
    if (!clips.ok) return { ok: false, status: 400, error: clips.error };
    refVideoUrls = clips.urls;
  }
  const built = buildVideoBody(model, { prompt, duration, resolution, aspectRatio: aspectIn, audio, seed, negativePrompt, cfgScale: typeof input.cfgScale === "number" ? input.cfgScale : undefined, keepSound, orientation, startUrl, endUrl, refUrls, refVideoUrls, refAudioUrls, shots });
  if (!built.ok) return { ok: false, status: 400, error: built.error };
  if (draft) built.body.draft = true;

  // The row exists (and the price is held) BEFORE the provider is called, so parallel starts cannot all pass the balance check.
  const idemKey = randomUUID();
  const aspect = typeof built.body.aspect_ratio === "string" ? built.body.aspect_ratio : null;
  const made = await createGenerationHeld(userId, cost, {
    userId, projectId, kind: "video", prompt, status: "pending", statusUrl: null, requestId: null, provider: "higgsfield", model: model.id,
    aspectRatio: aspect, resolution: resolutionUsed ?? null, seed, seedLocked, durationSec: duration, hasAudio: motion ? (motion.kind === "kling" ? keepSound : null) : caps.audio ? audioUsed : null,
    creditsHeld: cost, idemKey, references: pictures.length ? pictures : undefined,
    params: { draft: draft || undefined, inputVideoSec: draft && inputVideoSec != null ? inputVideoSec : undefined, conform: conform ?? undefined, workflow: built.workflow, endpoint: built.endpoint, duration, resolution: resolutionUsed ?? null, videoRefs: videoRefIds.length ? videoRefIds : undefined, audioRefs: audioRefIds.length ? audioRefIds : undefined, shots, negativePrompt: negativePrompt || undefined, motion: motion ? { orientation, keepSound, clipId: videoRefIds[0] } : undefined },
  });
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, outOfCredits(model.label, cost as number, made.have, made.held, false, made.locked), made.locked > 0 && made.have < (cost as number))) };

  try {
    const row = await submitRouted({ row: made.row, route, modelId: model.id, workflow: built.workflow, endpoint: built.endpoint, body: built.body, idemKey, higgsfieldCost, confirm: input.confirm === true, noFallback: onlyDirect });
    return { ok: true, item: await toItem(row), seedNote };
  } catch (err) {
    await db.generation.delete({ where: { id: made.row.id } }).catch(() => {}); // nothing was started, so nothing stays held
    console.error("starting video failed", model.id, err instanceof HiggsfieldError ? err.message : err);
    // A 4xx is Higgsfield's own rejection (it never succeeds on retry): shown cleaned, so it can be fixed fast. Anything else is on a network hiccup.
    const rejected = err instanceof HiggsfieldError && err.status != null && err.status >= 400 && err.status < 500;
    // Eclipse's own words for people; the provider's reply goes to the logs, and to the owner here so a setting can be fixed fast.
    if (err instanceof PriceChanged) return { ok: false, status: 409, needsConfirm: true, cost: err.cost, error: `This video now costs ${fmtCredits(err.cost)} credits. Confirm to continue.` };
    if (err instanceof NeedsMoreCredits) return { ok: false, status: 402, error: err.message };
    const detail = err instanceof HiggsfieldError || err instanceof ArkError ? err.detail : "";
    const why = (await getAdmin().catch(() => null)) && detail ? ` (Owner only: ${detail})` : "";
    return { ok: false, status: 502, error: err instanceof ArkError ? `${startRefusalText(model.label, err)}${why}` : rejected ? `The video was not accepted.${why} Nothing was charged.` : `The video could not be started. Please try again.${why}` };
  }
}
