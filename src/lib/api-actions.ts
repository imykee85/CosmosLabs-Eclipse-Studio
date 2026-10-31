import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { finalizeGeneration, toItem, type RenderItem } from "@/lib/generation-jobs";
import { enabledModels, toPublic } from "@/lib/models";
import { startRender } from "@/lib/start-render";
import { startVideoRender } from "@/lib/start-video";
import { capsFor, VIDEO_MODELS, isLive } from "@/lib/video-models";
import { finalizeVideo, rescueLateVideo } from "@/lib/video-jobs";

// What the public API and the MCP endpoint can do, as the key's owner, through the SAME code as the app's own buttons (prices, credit holds,
// moderation, limits and ownership checks all apply). Every function returns plain JSON-able data or { error, status }.
export type ApiResult = { ok: true; data: unknown } | { ok: false; status: number; error: string; extra?: Record<string, unknown> };

// A render as the API shows it: no internal fields; `url` is a short-lived signed link (fetch the render again for a fresh one).
export function publicRender(r: RenderItem) {
  return { id: r.id, kind: r.kind, status: r.status, prompt: r.prompt, model: r.model, model_label: r.modelLabel, aspect_ratio: r.aspectRatio, resolution: r.resolution,
    width: r.width, height: r.height, duration_sec: r.durationSec, has_audio: r.hasAudio, seed: r.seed, credits: r.credits != null ? r.credits / 10 : null, error: r.error,
    url: r.status === "completed" ? r.imageUrl : null, project_id: r.projectId, created_at: r.createdAt };
}

export function listModels(): ApiResult {
  const images = enabledModels().map(toPublic).map((m) => ({ id: m.id, label: m.label, aspect_ratios: m.ratios, resolutions: m.resolutions, max_prompt: m.maxPrompt, max_references: m.maxReferences, needs_reference: m.requiresReference, seed: m.seed.supported ? { min: m.seed.min, max: m.seed.max } : null, credits: m.prices ? Object.fromEntries(Object.entries(m.prices).map(([k, v]) => [k, v / 10])) : null }));
  const videos = VIDEO_MODELS.filter((m) => isLive(m) && !m.hidden).map((m) => { const t = capsFor(m, "t2v"); const i = capsFor(m, "i2v"); return { id: m.id, label: m.label, durations: t.durations, start_frame_durations: i.durations, resolutions: t.qualities, aspect_ratios: t.ratios, sound: t.audio, start_frame: m.startFrame, end_frame: m.endFrame, max_reference_images: t.refMax, max_reference_videos: t.refVideoMax }; });
  return { ok: true, data: { image_models: images, video_models: videos } };
}

const refList = (v: unknown) => (Array.isArray(v) ? v.slice(0, 32).map((r) => ({ type: (r as { type?: unknown })?.type, id: (r as { id?: unknown })?.id })) : undefined);

export async function createImage(userId: string, b: Record<string, unknown>): Promise<ApiResult> {
  const r = await startRender({ userId, prompt: b.prompt, model: b.model, aspectRatio: b.aspect_ratio, resolution: b.resolution, projectId: b.project_id, references: refList(b.references), seed: b.seed, lockSeed: b.seed != null ? true : undefined });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, data: { ...publicRender(r.item), ...(r.seedNote ? { note: r.seedNote } : {}) } };
}

export async function createVideo(userId: string, b: Record<string, unknown>): Promise<ApiResult> {
  const one = (v: unknown) => (v && typeof v === "object" ? { type: (v as { type?: unknown }).type, id: (v as { id?: unknown }).id } : undefined);
  const r = await startVideoRender({ userId, personId: userId, prompt: b.prompt, model: b.model, duration: b.duration, resolution: b.resolution, aspectRatio: b.aspect_ratio, audio: b.sound, seed: b.seed, lockSeed: b.seed != null ? true : undefined,
    negativePrompt: b.negative_prompt, start: one(b.start_frame), end: one(b.end_frame), refs: refList(b.reference_images), videoRefs: Array.isArray(b.reference_videos) ? b.reference_videos.map((id) => ({ id })) : undefined, confirm: b.confirm === true, projectId: b.project_id });
  if (!r.ok) return { ok: false, status: r.status, error: r.error, extra: r.needsConfirm ? { needs_confirm: true, cost: r.cost } : r.code ? { code: r.code, need: r.need } : undefined };
  return { ok: true, data: publicRender(r.item) };
}

export async function getRender(userId: string, id: unknown): Promise<ApiResult> {
  if (typeof id !== "string" || !id || id.length > 64) return { ok: false, status: 400, error: "Give a render id." };
  const row = await db.generation.findFirst({ where: { id, userId } });
  if (!row) return { ok: false, status: 404, error: "Not found." };
  const done = row.kind === "video" ? await rescueLateVideo(await finalizeVideo(row)) : await finalizeGeneration(row);
  return { ok: true, data: publicRender(await toItem(done)) };
}

export async function listRenders(userId: string, opts: { limit?: unknown; kind?: unknown; project_id?: unknown }): Promise<ApiResult> {
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const kind = opts.kind === "image" || opts.kind === "video" ? opts.kind : undefined;
  const rows = await db.generation.findMany({ where: { userId, deletedAt: null, ...(kind ? { kind } : {}), ...(typeof opts.project_id === "string" ? { projectId: opts.project_id } : {}) }, orderBy: { createdAt: "desc" }, take: limit });
  return { ok: true, data: { renders: await Promise.all(rows.map(async (g) => publicRender(await toItem(g)))) } };
}

export async function credits(userId: string): Promise<ApiResult> {
  return { ok: true, data: { balance: (await getBalance(userId)) / 10, charging: process.env.CREDITS_ENABLED === "1" } };
}
