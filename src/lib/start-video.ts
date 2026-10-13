import { randomInt, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { HiggsfieldError } from "@/lib/higgsfield";
import { submitVideo } from "@/lib/higgsfield-video";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, resolveReferences, type ReferenceRef } from "@/lib/references";
import { createGenerationHeld } from "@/lib/reservations";
import { claimUsage } from "@/lib/usage";
import { buildVideoBody, capsFor, findVideoModel, videoPrice, workflowOf } from "@/lib/video-models";

// Settings (all Config values, none are secrets). Defaults are deliberately tight; raise them in Vercel when real costs are known (docs/video-pricing.md).
const num = (name: string, fallback: number) => (Number(process.env[name]) > 0 ? Math.floor(Number(process.env[name])) : fallback);
export const videoSettings = () => ({
  paused: process.env.VIDEO_KILL_SWITCH === "1",             // the global kill switch: set to 1 and every new video is refused (running ones finish)
  perMinute: num("VIDEO_RENDERS_PER_MINUTE", 6),
  perDay: num("VIDEO_RENDERS_PER_DAY", 30),
  maxRunning: num("VIDEO_MAX_RUNNING", 3),
  dailyCredits: num("VIDEO_DAILY_CREDITS", 2000),            // a person's credit spend on video per rolling day (only counted while credits are on)
  confirmAbove: num("VIDEO_CONFIRM_CREDITS", 300),           // above this price one render asks for a confirm first
  creditsOn: process.env.CREDITS_ENABLED === "1",
});

export type StartVideoInput = {
  userId: string; prompt: unknown; model: unknown; duration?: unknown; resolution?: unknown; aspectRatio?: unknown; audio?: unknown;
  seed?: unknown; lockSeed?: unknown; negativePrompt?: unknown; cfgScale?: unknown; start?: unknown; end?: unknown; refs?: unknown; rights?: unknown; confirm?: unknown; projectId?: unknown;
};
export type StartVideoResult = { ok: true; item: RenderItem; seedNote?: string } | { ok: false; status: number; error: string; needsConfirm?: boolean; cost?: number };

const oneRef = (v: unknown): ReferenceRef | null | undefined => {
  if (v == null) return undefined;
  const r = parseReferenceRefs([v]);
  return r && r.length === 1 ? r[0] : null; // null = not understood
};

// The one place a video is validated and started (POST /api/video). Same rules as images, plus the video-only ones: kill switch, running and daily limits,
// price confirm, rights confirm. Nothing falls back to another model.
export async function startVideoRender(input: StartVideoInput): Promise<StartVideoResult> {
  const { userId } = input;
  const cfg = videoSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Video generation is paused right now. Please try again later." };
  if (!process.env.HIGGSFIELD_API_KEY) return { ok: false, status: 503, error: "Video generation is not set up yet." };

  const model = findVideoModel(input.model);
  if (!model) return { ok: false, status: 400, error: "That model is not available." };
  if (!model.live) return { ok: false, status: 400, error: `${model.label} is not connected yet.` };
  const live = model.live;

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const negativePrompt = typeof input.negativePrompt === "string" ? input.negativePrompt.trim() : "";
  for (const text of [prompt, negativePrompt]) {
    if (!text) continue;
    const m = checkPrompt(text);
    if (!m.ok) { console.warn("prompt refused", m.category); return { ok: false, status: 422, error: m.reason }; }
  }

  const duration = typeof input.duration === "number" ? input.duration : NaN;
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  // Start and end frames: ids of the person's own pictures, never addresses.
  const start = oneRef(input.start);
  const end = oneRef(input.end);
  if (start === null || end === null) return { ok: false, status: 400, error: "The pictures were not understood." };
  if (end && !start) return { ok: false, status: 400, error: "An end frame needs a start frame too." };
  // Reference pictures (reference-to-video): ids only, never together with a start or end frame.
  const refs = input.refs == null ? [] : parseReferenceRefs(input.refs, 64); // the model's own limit (up to 30) is checked next
  if (refs === null) return { ok: false, status: 400, error: "The reference pictures were not understood." };
  if (refs.length && (start || end)) return { ok: false, status: 400, error: "Use either a start frame or reference pictures, not both." };
  const wf = workflowOf(!!start, refs.length > 0);
  const caps = capsFor(model, wf);
  if (refs.length && !caps.refMax) return { ok: false, status: 400, error: `${model.label} takes no reference pictures yet.` };
  if (refs.length > caps.refMax) return { ok: false, status: 400, error: `${model.label} takes up to ${caps.refMax} reference pictures (you chose ${refs.length}).` };
  if (end && !caps.endFrame) return { ok: false, status: 400, error: `${model.label} has no end frame.` };
  const pictures = refs.length ? refs : [start, end].filter((r): r is ReferenceRef => !!r);
  // The rights confirm is enforced here, not only in the browser, and stored with the render.
  if (pictures.length && input.rights !== true) return { ok: false, status: 400, error: "Please confirm you have the right to use these pictures." };

  const resolution = typeof input.resolution === "string" ? input.resolution : undefined;
  const audio = typeof input.audio === "boolean" ? input.audio : undefined;

  // Seed: only for a model that has one; always sent to it (the user's, a locked one, or a fresh random one) so a result can be re-run.
  let seed: number | null = null;
  let seedLocked = false;
  let seedNote: string | undefined;
  if (!live.seed) {
    if (input.seed != null || input.lockSeed === true) seedNote = `${model.label} does not support seeds, so none was used.`;
  } else {
    if (input.seed != null && (typeof input.seed !== "number" || !Number.isInteger(input.seed) || input.seed < live.seed.min || input.seed > live.seed.max)) {
      return { ok: false, status: 400, error: `The seed must be a whole number from ${live.seed.min.toLocaleString("en-US")} to ${live.seed.max.toLocaleString("en-US")} for ${model.label}.` };
    }
    if (input.seed != null || input.lockSeed === true) {
      seedLocked = true;
      seed = (input.seed as number | null | undefined) ?? (await db.generation.findFirst({ where: { userId, model: model.id, kind: "video", seed: { not: null } }, orderBy: { createdAt: "desc" }, select: { seed: true } }))?.seed ?? randomInt(live.seed.min, live.seed.max + 1);
    } else seed = randomInt(live.seed.min, live.seed.max + 1);
  }

  // Check the request against the model BEFORE anything is held or limited (placeholder addresses stand in for the pictures).
  const probe = buildVideoBody(model, { prompt, duration, resolution, aspectRatio: typeof input.aspectRatio === "string" ? input.aspectRatio : undefined, audio, seed, negativePrompt, cfgScale: typeof input.cfgScale === "number" ? input.cfgScale : undefined, startUrl: start ? "https://x.invalid/s" : undefined, endUrl: end ? "https://x.invalid/e" : undefined, refUrls: refs.length ? refs.map((_, i) => `https://x.invalid/r${i}`) : undefined });
  if (!probe.ok) return { ok: false, status: 400, error: probe.error };

  const resolutionUsed = typeof probe.body.resolution === "string" ? probe.body.resolution : undefined;
  const audioUsed = live.audio ? (audio ?? live.audio.default) : false;
  const cost = cfg.creditsOn ? videoPrice(model, resolutionUsed, duration, audioUsed) : null;
  if (cost != null) {
    const today = await db.generation.aggregate({ where: { userId, kind: "video", status: { not: "failed" }, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, _sum: { creditsHeld: true } });
    if ((today._sum.creditsHeld ?? 0) + cost > cfg.dailyCredits) return { ok: false, status: 429, error: `That would go over today's video limit of ${cfg.dailyCredits} credits.` };
    if (cost > cfg.confirmAbove && input.confirm !== true) return { ok: false, status: 409, needsConfirm: true, cost, error: `This video costs ${cost} credits. Confirm to continue.` };
  }

  // Limits per person: a short burst limit, a daily count, how many may run at once, and (with credits on) a daily spend.
  const running = await db.generation.count({ where: { userId, kind: "video", status: { in: ["pending", "saving"] } } });
  if (running >= cfg.maxRunning) return { ok: false, status: 429, error: `You already have ${running} videos running. Wait for one to finish.` };
  if (!(await claimUsage(userId, "video", cfg.perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting videos very quickly. Wait a moment and try again." };
  if (!(await claimUsage(userId, "video-day", cfg.perDay, 24 * 3600_000))) return { ok: false, status: 429, error: `You have reached today's limit of ${cfg.perDay} videos.` };

  // Pictures: turned into addresses the provider can fetch (Higgsfield's own upload, else a one-hour signed link).
  let startUrl: string | undefined;
  let endUrl: string | undefined;
  let refUrls: string[] | undefined;
  if (pictures.length) {
    const resolved = await resolveReferences(userId, pictures);
    if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
    const urls = await deliverReferences(resolved.items);
    if (refs.length) refUrls = urls; else { startUrl = urls[0]; endUrl = end ? urls[1] : undefined; }
  }
  const built = buildVideoBody(model, { prompt, duration, resolution, aspectRatio: typeof input.aspectRatio === "string" ? input.aspectRatio : undefined, audio, seed, negativePrompt, cfgScale: typeof input.cfgScale === "number" ? input.cfgScale : undefined, startUrl, endUrl, refUrls });
  if (!built.ok) return { ok: false, status: 400, error: built.error };

  // The row exists (and the price is held) BEFORE the provider is called, so parallel starts cannot all pass the balance check.
  const idemKey = randomUUID();
  const aspect = typeof built.body.aspect_ratio === "string" ? built.body.aspect_ratio : null;
  const made = await createGenerationHeld(userId, cost, {
    userId, projectId, kind: "video", prompt, status: "pending", statusUrl: null, requestId: null, provider: "higgsfield", model: model.id,
    aspectRatio: aspect, resolution: resolutionUsed ?? null, seed, seedLocked, durationSec: duration, hasAudio: live.audio ? audioUsed : null,
    creditsHeld: cost, idemKey, references: pictures.length ? pictures : undefined,
    params: { workflow: built.workflow, endpoint: built.endpoint, duration, resolution: resolutionUsed ?? null, rights: pictures.length ? true : undefined, negativePrompt: negativePrompt || undefined },
  });
  if (!("row" in made)) return { ok: false, status: 402, error: `${model.label} needs ${cost} credits. You have ${made.have}${made.held ? `, and ${made.held} are held by renders still running` : ""}. Ask the owner to add more credits.` };

  try {
    const sub = await submitVideo(built.endpoint, built.body, idemKey);
    const row = await db.generation.update({ where: { id: made.row.id }, data: { statusUrl: sub.statusUrl, requestId: sub.requestId || null, cancelUrl: sub.cancelUrl } });
    return { ok: true, item: await toItem(row), seedNote };
  } catch (err) {
    await db.generation.delete({ where: { id: made.row.id } }).catch(() => {}); // nothing was started, so nothing stays held
    console.error("starting video failed", model.id, err instanceof HiggsfieldError ? err.message : err);
    // A 4xx is Higgsfield's own rejection (it never succeeds on retry): shown cleaned, so it can be fixed fast. Anything else is on a network hiccup.
    const rejected = err instanceof HiggsfieldError && err.status != null && err.status >= 400 && err.status < 500;
    const why = err instanceof HiggsfieldError && err.detail ? ` ${model.label}: ${err.detail}` : "";
    return { ok: false, status: 502, error: rejected ? `The video was not accepted.${why} Nothing was charged.` : `The video could not be started. Please try again.${why}` };
  }
}
