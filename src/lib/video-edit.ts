import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { HiggsfieldError } from "@/lib/higgsfield";
import { NeedsMoreCredits, PriceChanged, submitRouted, videoRouteNow } from "@/lib/video-submit";
import { ArkError } from "@/lib/providers/byteplus-video";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, resolveReferences, resolveVideoReferences } from "@/lib/references";
import { createGenerationHeld } from "@/lib/reservations";
import { videoSettings } from "@/lib/start-video";
import { claimUsage } from "@/lib/usage";
import { refusal } from "@/lib/subscribe-alert";
import { findVideoModel, videoPrice } from "@/lib/video-models";

import { fmtCredits } from "@/lib/credit-units";
// Seedance 2.5 Edit and Extend, on one of the person's own finished videos (docs/seedance-api.md): `bytedance/seedance-2.5/video-edit` changes what is
// in the clip as the prompt says (same length and framing, no duration sent); `.../video-extend` continues it by `duration` seconds (4 to 30). Both
// take `prompt` and `video_url` (a one-hour signed link to our stored copy), optional reference pictures (`image_urls`, up to 30), `resolution`
// (480p/720p/1080p) and `generate_audio`. Priced like Seedance 2.5 per second: the source's length for Edit, the extension for Extend. The finished
// clip arrives and is stored like any other video (video-jobs.ts). NOT verified against the live API: source length limits and whether Extend
// returns the whole clip or only the new part (the row records source + extension as its length until the stored file says otherwise).
export type EditMode = "edit" | "extend";
const ENDPOINT: Record<EditMode, string> = { edit: "bytedance/seedance-2.5/video-edit", extend: "bytedance/seedance-2.5/video-extend" };
const RES = ["480p", "720p", "1080p"];

export type EditInput = { userId: string; sourceId: unknown; mode: unknown; prompt: unknown; duration?: unknown; resolution?: unknown; audio?: unknown; refs?: unknown; projectId?: unknown; confirm?: unknown; model?: unknown };
export type EditResult = { ok: true; item: RenderItem } | { ok: false; status: number; error: string; needsConfirm?: boolean; cost?: number; code?: string };

export async function startVideoEdit(input: EditInput): Promise<EditResult> {
  const { userId } = input;
  const cfg = videoSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Video generation is paused right now. Please try again later." };
  // Seedance 2.0 Edit and Extend exist only at BytePlus (no Higgsfield endpoint): same dialog, direct route only, clips up to 15 s (docs/video-providers/byteplus-seedance-25.md).
  const modelId = input.model === "seedance_2_0" ? "seedance_2_0" : "seedance_2_5";
  const v2 = modelId === "seedance_2_0";
  if (!v2 && !process.env.HIGGSFIELD_API_KEY) return { ok: false, status: 503, error: "Video generation is not set up yet." };
  const mode: EditMode | null = input.mode === "edit" || input.mode === "extend" ? input.mode : null;
  if (!mode) return { ok: false, status: 400, error: "Choose Edit or Extend." };
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return { ok: false, status: 400, error: mode === "edit" ? "Describe what to change." : "Describe what happens next." };
  if (prompt.length > 5000) return { ok: false, status: 400, error: "The prompt can be up to 5,000 characters." };
  const m = checkPrompt(prompt);
  if (!m.ok) return { ok: false, status: 422, error: m.reason };
  const sourceId = typeof input.sourceId === "string" && input.sourceId.length <= 64 ? input.sourceId : "";
  const source = sourceId ? await db.generation.findFirst({ where: { id: sourceId, userId, kind: "video", status: "completed", deletedAt: null }, select: { id: true, durationSec: true, aspectRatio: true, projectId: true } }) : null;
  if (!source) return { ok: false, status: 404, error: "That video could not be found. It may have been deleted." };
  const ext = mode === "extend" ? (typeof input.duration === "number" && Number.isInteger(input.duration) ? input.duration : NaN) : 0;
  const maxExt = v2 ? 15 : 30;
  if (mode === "extend" && !(ext >= 4 && ext <= maxExt)) return { ok: false, status: 400, error: `Extend by 4 to ${maxExt} seconds.` };
  if (v2 && (source.durationSec ?? 0) > 15) return { ok: false, status: 400, error: "Seedance 2.0 works on clips of up to 15 seconds. Use a shorter clip or Seedance 2.5." };
  const resolution = typeof input.resolution === "string" ? input.resolution : "720p";
  if (!RES.includes(resolution)) return { ok: false, status: 400, error: "Choose 480p, 720p or 1080p." };
  const audio = input.audio === false ? false : true;
  const refs = input.refs == null ? [] : parseReferenceRefs(input.refs, 30);
  if (refs === null) return { ok: false, status: 400, error: "The reference pictures were not understood." };

  const model = findVideoModel(modelId);
  if (!model?.live) return { ok: false, status: 503, error: `${v2 ? "Seedance 2.0" : "Seedance 2.5"} is not connected.` };
  const srcSec = Math.max(1, Math.ceil(source.durationSec ?? 5));
  const billedSec = mode === "edit" ? srcSec : ext;
  // The source clip goes in as the input video: BytePlus bills it by its length (Edit keeps the length, so the output is as long as the source).
  const routeNow = await videoRouteNow(model.id, resolution, source.durationSec == null ? null : srcSec);
  if (routeNow === "unavailable") return { ok: false, status: 503, error: `${model.label} is having trouble right now. Please try again in a few minutes. Nothing was charged.` };
  const route = routeNow;
  if (v2 && route !== "direct") return { ok: false, status: 503, error: "Seedance 2.0 editing is not available right now. Please try again in a few minutes or use Seedance 2.5." };
  const cost = cfg.creditsOn ? videoPrice(model, resolution, billedSec, audio, route, route === "direct" ? srcSec : undefined) : null;
  const higgsfieldCost = cfg.creditsOn && !v2 ? videoPrice(model, resolution, billedSec, audio, "higgsfield") : null;
  if (cost != null) {
    const today = await db.generation.aggregate({ where: { userId, kind: "video", status: { not: "failed" }, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, _sum: { creditsHeld: true } });
    if ((today._sum.creditsHeld ?? 0) + cost > cfg.dailyCredits) return { ok: false, status: 429, error: `That would go over today's video limit of ${fmtCredits(cfg.dailyCredits)} credits.` };
    if (cost > cfg.confirmAbove && input.confirm !== true) return { ok: false, status: 409, needsConfirm: true, cost, error: `This costs ${fmtCredits(cost)} credits. Confirm to continue.` };
  }
  const running = await db.generation.count({ where: { userId, kind: "video", status: { in: ["pending", "saving"] } } });
  if (running >= cfg.maxRunning) return { ok: false, status: 429, error: `You already have ${running} videos running. Wait for one to finish.` };
  if (!(await claimUsage(userId, "video", cfg.perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting videos very quickly. Wait a moment and try again." };
  if (!(await claimUsage(userId, "video-day", cfg.perDay, 24 * 3600_000))) return { ok: false, status: 429, error: `You have reached today's limit of ${cfg.perDay} videos.` };

  const clip = await resolveVideoReferences(userId, [source.id]);
  if (!clip.ok) return { ok: false, status: 400, error: clip.error };
  const body: Record<string, unknown> = { prompt, video_url: clip.urls[0], resolution, generate_audio: audio };
  if (mode === "extend") body.duration = ext;
  if (refs.length) {
    const resolved = await resolveReferences(userId, refs);
    if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
    body.image_urls = await deliverReferences(resolved.items);
  }

  const idemKey = randomUUID();
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : source.projectId;
  const made = await createGenerationHeld(userId, cost, {
    userId, projectId, kind: "video", prompt, status: "pending", statusUrl: null, requestId: null, provider: "higgsfield", model: model.id,
    aspectRatio: source.aspectRatio, resolution, durationSec: mode === "edit" ? srcSec : srcSec + ext, hasAudio: audio, creditsHeld: cost, idemKey,
    references: refs.length ? refs : undefined,
    params: { workflow: mode, endpoint: v2 ? "" : ENDPOINT[mode], sourceId: source.id, duration: mode === "extend" ? ext : undefined, resolution },
  });
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, `This needs ${fmtCredits(cost ?? 0)} credits. You have ${fmtCredits(Math.max(0, made.have))}${made.held ? `, and ${fmtCredits(made.held)} are held by renders still running` : ""}.`)) };
  try {
    const row = await submitRouted({ row: made.row, route, modelId: model.id, workflow: mode, endpoint: v2 ? "" : ENDPOINT[mode], body, idemKey, higgsfieldCost, confirm: input.confirm === true, noFallback: v2 });
    return { ok: true, item: await toItem(row) };
  } catch (err) {
    await db.generation.delete({ where: { id: made.row.id } }).catch(() => {});
    console.error("starting video edit failed", mode, err instanceof HiggsfieldError ? err.message : err);
    const rejected = err instanceof HiggsfieldError && err.status != null && err.status >= 400 && err.status < 500;
    // Eclipse's own words for people; the provider's reply goes to the logs, and to the owner here so a setting can be fixed fast.
    if (err instanceof PriceChanged) return { ok: false, status: 409, needsConfirm: true, cost: err.cost, error: `This video now costs ${fmtCredits(err.cost)} credits. Confirm to continue.` };
    if (err instanceof NeedsMoreCredits) return { ok: false, status: 402, error: err.message };
    const detail = err instanceof HiggsfieldError || err instanceof ArkError ? err.detail : "";
    const why = (await getAdmin().catch(() => null)) && detail ? ` (Owner only: ${detail})` : "";
    return { ok: false, status: 502, error: err instanceof ArkError ? `${model.label} is having trouble right now. Please try again in a few minutes. Nothing was charged.${why}` : rejected ? `The video was not accepted.${why} Nothing was charged.` : `The video could not be started. Please try again.${why}` };
  }
}
