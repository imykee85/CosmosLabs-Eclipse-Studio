import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { HiggsfieldError } from "@/lib/higgsfield";
import { submitVideo } from "@/lib/higgsfield-video";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, resolveReferences, resolveVideoReferences } from "@/lib/references";
import { createGenerationHeld } from "@/lib/reservations";
import { videoSettings } from "@/lib/start-video";
import { claimUsage } from "@/lib/usage";
import { findVideoModel, videoPrice } from "@/lib/video-models";

// Seedance 2.5 Edit and Extend, on one of the person's own finished videos (docs/seedance-api.md): `bytedance/seedance-2.5/video-edit` changes what is
// in the clip as the prompt says (same length and framing, no duration sent); `.../video-extend` continues it by `duration` seconds (4 to 30). Both
// take `prompt` and `video_url` (a one-hour signed link to our stored copy), optional reference pictures (`image_urls`, up to 30), `resolution`
// (480p/720p/1080p) and `generate_audio`. Priced like Seedance 2.5 per second: the source's length for Edit, the extension for Extend. The finished
// clip arrives and is stored like any other video (video-jobs.ts). NOT verified against the live API: source length limits and whether Extend
// returns the whole clip or only the new part (the row records source + extension as its length until the stored file says otherwise).
export type EditMode = "edit" | "extend";
const ENDPOINT: Record<EditMode, string> = { edit: "bytedance/seedance-2.5/video-edit", extend: "bytedance/seedance-2.5/video-extend" };
const RES = ["480p", "720p", "1080p"];

export type EditInput = { userId: string; sourceId: unknown; mode: unknown; prompt: unknown; duration?: unknown; resolution?: unknown; audio?: unknown; refs?: unknown; projectId?: unknown; confirm?: unknown };
export type EditResult = { ok: true; item: RenderItem } | { ok: false; status: number; error: string; needsConfirm?: boolean; cost?: number };

export async function startVideoEdit(input: EditInput): Promise<EditResult> {
  const { userId } = input;
  const cfg = videoSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Video generation is paused right now. Please try again later." };
  if (!process.env.HIGGSFIELD_API_KEY) return { ok: false, status: 503, error: "Video generation is not set up yet." };
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
  if (mode === "extend" && !(ext >= 4 && ext <= 30)) return { ok: false, status: 400, error: "Extend by 4 to 30 seconds." };
  const resolution = typeof input.resolution === "string" ? input.resolution : "720p";
  if (!RES.includes(resolution)) return { ok: false, status: 400, error: "Choose 480p, 720p or 1080p." };
  const audio = input.audio === false ? false : true;
  const refs = input.refs == null ? [] : parseReferenceRefs(input.refs, 30);
  if (refs === null) return { ok: false, status: 400, error: "The reference pictures were not understood." };

  const model = findVideoModel("seedance_2_5");
  if (!model?.live) return { ok: false, status: 503, error: "Seedance 2.5 is not connected." };
  const srcSec = Math.max(1, Math.ceil(source.durationSec ?? 5));
  const billedSec = mode === "edit" ? srcSec : ext;
  const cost = cfg.creditsOn ? videoPrice(model, resolution, billedSec, audio) : null;
  if (cost != null) {
    const today = await db.generation.aggregate({ where: { userId, kind: "video", status: { not: "failed" }, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, _sum: { creditsHeld: true } });
    if ((today._sum.creditsHeld ?? 0) + cost > cfg.dailyCredits) return { ok: false, status: 429, error: `That would go over today's video limit of ${cfg.dailyCredits} credits.` };
    if (cost > cfg.confirmAbove && input.confirm !== true) return { ok: false, status: 409, needsConfirm: true, cost, error: `This costs ${cost} credits. Confirm to continue.` };
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
    params: { workflow: mode, endpoint: ENDPOINT[mode], sourceId: source.id, duration: mode === "extend" ? ext : undefined, resolution },
  });
  if (!("row" in made)) return { ok: false, status: 402, error: `This needs ${cost} credits. You have ${made.have}${made.held ? `, and ${made.held} are held by renders still running` : ""}.` };
  try {
    const sub = await submitVideo(ENDPOINT[mode], body, idemKey);
    const row = await db.generation.update({ where: { id: made.row.id }, data: { statusUrl: sub.statusUrl, requestId: sub.requestId || null, cancelUrl: sub.cancelUrl } });
    return { ok: true, item: await toItem(row) };
  } catch (err) {
    await db.generation.delete({ where: { id: made.row.id } }).catch(() => {});
    console.error("starting video edit failed", mode, err instanceof HiggsfieldError ? err.message : err);
    const rejected = err instanceof HiggsfieldError && err.status != null && err.status >= 400 && err.status < 500;
    // Eclipse's own words for people; the provider's reply goes to the logs, and to the owner here so a setting can be fixed fast.
    const why = (await getAdmin().catch(() => null)) && err instanceof HiggsfieldError && err.detail ? ` (Owner only: ${err.detail})` : "";
    return { ok: false, status: 502, error: rejected ? `The video was not accepted.${why} Nothing was charged.` : `The video could not be started. Please try again.${why}` };
  }
}
