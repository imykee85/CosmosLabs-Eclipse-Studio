import { waitUntil } from "@vercel/functions";
import type { Generation } from "@prisma/client";
import { db } from "@/lib/db";
import { toLedger } from "@/lib/credit-units";
import { creditsForUsd } from "@/lib/price-constants";
import { createGenerationHeld } from "@/lib/reservations";
import { failRender, toItem, type RenderItem } from "@/lib/generation-jobs";
import { getObjectBytes, signedGetUrl, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";
import { outOfCredits } from "@/lib/credit-message";
import { refusal } from "@/lib/subscribe-alert";
import type { ProviderStatus } from "@/lib/providers/types";
import type { VideoStatus } from "@/lib/higgsfield-video";
import { topaz, topazJson, topazMessage, TopazError } from "./client";
import { IMAGE_SPECS, MAX_VIDEO_BYTES, PRESETS, VIDEO_SPECS, VIDEO_TARGETS, imageFormFields, imageOutputSize, imageTopazCredits, topazConfigured, topazCreditUsd, videoFilter, videoOutputSize, videoTopazCredits, type Preset, type VideoTarget } from "./models";

// Upscale of a finished picture or video. The result is a NEW row (the original stays): a pending Generation whose statusUrl starts with "topaz:", so the
// ordinary finish code (finalizeGeneration for pictures, finalizeVideo for clips) polls it, copies the file into storage, charges once and completes it.
export const UPSCALE_MODEL = "upscale";
export type UpscaleInput = { sourceId?: unknown; preset?: unknown; scale?: unknown; target?: unknown; creativity?: unknown };
type Plan = { kind: "image" | "video"; source: Generation; preset: Preset; outW: number; outH: number; scale?: number; target?: VideoTarget; creativity?: number; topazCredits: number; usd: number; cost: number | null; fps?: number };
export type Quote = { ok: true; kind: "image" | "video"; outW: number; outH: number; credits: number | null; seconds?: number } | { ok: false; status: number; error: string };

const creditsOn = () => process.env.CREDITS_ENABLED === "1";

async function videoFps(url: string): Promise<number> {
  try {
    const { Input, UrlSource, ALL_FORMATS } = await import("mediabunny");
    const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
    const track = await Promise.race([input.getPrimaryVideoTrack(), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
    const stats = track ? await Promise.race([track.computePacketStats(60), new Promise<null>((r) => setTimeout(() => r(null), 8000))]) : null;
    const fps = stats?.averagePacketRate ?? 0;
    return fps >= 5 && fps <= 120 ? Math.round(fps * 100) / 100 : 24;
  } catch { return 24; }
}

async function plan(userId: string, input: UpscaleInput): Promise<Plan | { ok: false; status: number; error: string }> {
  if (!topazConfigured()) return { ok: false, status: 503, error: "Upscale is not available yet." };
  const sourceId = typeof input.sourceId === "string" ? input.sourceId : "";
  const preset = (PRESETS as string[]).includes(String(input.preset)) ? (input.preset as Preset) : "auto";
  const source = sourceId ? await db.generation.findFirst({ where: { id: sourceId, userId, status: "completed", deletedAt: null, storageKey: { not: null } } }) : null;
  if (!source) return { ok: false, status: 404, error: "That picture or video could not be found." };
  if (!storageEnabled) return { ok: false, status: 503, error: "Storage is not set up, so Upscale is not available." };
  const usdPer = topazCreditUsd();
  const costOf = (topazCredits: number) => (creditsOn() ? toLedger(creditsForUsd(topazCredits * usdPer)) : null);
  if (source.kind === "video") {
    const target = (VIDEO_TARGETS as string[]).includes(String(input.target)) ? (input.target as VideoTarget) : "1080p";
    const size = videoOutputSize(source.width ?? 0, source.height ?? 0, target);
    if (!size.ok) return { ok: false, status: 400, error: size.error };
    const seconds = source.durationSec ?? 0;
    if (!(seconds > 0)) return { ok: false, status: 400, error: "This video's length is not known, so it cannot be upscaled." };
    if ((source.sizeBytes ?? 0) > MAX_VIDEO_BYTES) return { ok: false, status: 400, error: "This video is too large to upscale." };
    const fps = await videoFps(await signedGetUrl(source.storageKey!, 600));
    const topazCredits = videoTopazCredits(preset, { inW: source.width!, inH: source.height!, outW: size.w, outH: size.h, seconds, fps });
    return { kind: "video", source, preset, outW: size.w, outH: size.h, target, creativity: typeof input.creativity === "number" ? input.creativity : undefined, topazCredits, usd: topazCredits * usdPer, cost: costOf(topazCredits), fps };
  }
  const scale = Number(input.scale) || 2;
  const size = imageOutputSize(source.width ?? 0, source.height ?? 0, scale);
  if (!size.ok) return { ok: false, status: 400, error: size.error };
  const topazCredits = imageTopazCredits(preset, size.w, size.h);
  return { kind: "image", source, preset, outW: size.w, outH: size.h, scale, creativity: typeof input.creativity === "number" ? input.creativity : undefined, topazCredits, usd: topazCredits * usdPer, cost: costOf(topazCredits) };
}

export async function quoteUpscale(userId: string, input: UpscaleInput): Promise<Quote> {
  const p = await plan(userId, input);
  if ("ok" in p) return p;
  return { ok: true, kind: p.kind, outW: p.outW, outH: p.outH, credits: p.cost, seconds: p.source.durationSec ?? undefined };
}

export type StartResult = { ok: true; item: RenderItem } | { ok: false; status: number; error: string; code?: string };

export async function startUpscale(userId: string, input: UpscaleInput): Promise<StartResult> {
  const p = await plan(userId, input);
  if ("ok" in p) return p;
  if (!(await claimUsage(userId, "upscale", 10, 60_000))) return { ok: false, status: 429, error: "You are starting upscales very quickly. Wait a moment and try again." };
  const running = await db.generation.count({ where: { userId, model: UPSCALE_MODEL, status: { in: ["pending", "saving"] } } });
  if (running >= 3) return { ok: false, status: 429, error: "You already have 3 upscales running. Wait for one to finish." };

  const src = p.source;
  const made = await createGenerationHeld(userId, p.cost, {
    userId, projectId: src.projectId, kind: p.kind, prompt: `Upscale: ${src.prompt}`.slice(0, 400), status: "pending", statusUrl: `topaz:${p.kind}:pending`, requestId: null, provider: "topaz", model: UPSCALE_MODEL,
    aspectRatio: src.aspectRatio, resolution: p.kind === "video" ? (p.target === "4k" ? "4K" : "1080p") : `${p.outW}x${p.outH}`, durationSec: src.durationSec, hasAudio: src.hasAudio,
    ...(p.cost != null ? { creditsHeld: p.cost } : {}),
    params: { upscaleOf: src.id, preset: p.preset, ...(p.scale ? { scale: p.scale } : {}), ...(p.target ? { target: p.target } : {}), outW: p.outW, outH: p.outH, topazCredits: p.topazCredits, ...(p.fps ? { fps: p.fps } : {}) },
  });
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, outOfCredits("Upscale", p.cost as number, made.have, made.held, false, made.locked), made.locked > 0 && made.have < (p.cost as number))) };
  const row = made.row;

  if (p.kind === "image") {
    try {
      const updated = await submitImage(row, p);
      return { ok: true, item: await toItem(updated) };
    } catch (err) {
      await db.generation.delete({ where: { id: row.id } }).catch(() => {}); // nothing was started, so nothing stays held
      console.error("starting an upscale failed", err);
      return { ok: false, status: err instanceof TopazError && err.status === 429 ? 429 : 502, error: topazMessage(err) };
    }
  }
  waitUntil(runVideo(row, p).catch((err) => console.error("video upscale failed", row.id, err)));
  return { ok: true, item: await toItem(row) };
}

// ---------- pictures ----------
async function submitImage(row: Generation, p: Plan): Promise<Generation> {
  const bytes = await getObjectBytes(p.source.storageKey!, 20 * 1024 * 1024);
  const form = new FormData();
  for (const [k, v] of Object.entries(imageFormFields(p.preset, p.outW, p.outH, { creativity: p.creativity }))) form.append(k, v);
  form.append("image", new Blob([bytes as BlobPart], { type: p.source.contentType || "image/jpeg" }), "image");
  const res = await topazJson<{ process_id?: string }>(IMAGE_SPECS[p.preset].path, { method: "POST", body: form, signal: AbortSignal.timeout(90_000) });
  if (!res.process_id) throw new Error("Topaz answered without a process id");
  return db.generation.update({ where: { id: row.id }, data: { statusUrl: `topaz:image:${res.process_id}`, requestId: res.process_id } });
}

export async function topazImageStatus(statusUrl: string): Promise<ProviderStatus> {
  const id = statusUrl.slice("topaz:image:".length);
  if (!id || id === "pending") return { state: "pending" };
  const j = await topazJson<{ status?: string; state?: string }>(`/image/v1/status/${encodeURIComponent(id)}`);
  const s = String(j.status ?? j.state ?? "").toLowerCase();
  if (s === "completed" || s === "complete") {
    const d = await topazJson<{ download_url?: string; url?: string }>(`/image/v1/download/${encodeURIComponent(id)}`);
    const url = d.download_url ?? d.url;
    return url ? { state: "completed", imageUrl: url } : { state: "failed", reason: "failed", detail: "completed with no download address" };
  }
  if (s === "failed" || s === "cancelled" || s === "canceled") return { state: "failed", reason: "failed", detail: s };
  return { state: "pending" };
}

// ---------- clips ----------
const containerOf = (type: string | null) => (type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4");

async function runVideo(row: Generation, p: Plan): Promise<void> {
  const fail = async (msg: string, detail?: unknown) => { if (detail) console.error("video upscale step failed", row.id, detail); await failRender(row.id, msg); };
  try {
    const src = p.source;
    const frames = Math.max(1, Math.ceil((src.durationSec ?? 1) * (p.fps ?? 24)));
    const created = await topazJson<Record<string, unknown>>("/video/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { resolution: { width: src.width, height: src.height }, container: containerOf(src.contentType), size: src.sizeBytes, duration: src.durationSec, frameRate: p.fps ?? 24, frameCount: frames },
        output: { resolution: { width: p.outW, height: p.outH }, frameRate: p.fps ?? 24, container: "mp4", videoEncoder: "H264", audioTransfer: "Copy", dynamicCompressionLevel: "High" },
        filters: [videoFilter(p.preset, { creativity: p.creativity })],
      }),
    });
    const requestId = typeof created.requestId === "string" ? created.requestId : "";
    if (!requestId) return fail("Upscale could not be started. Please try again.", created);
    await db.generation.update({ where: { id: row.id }, data: { statusUrl: `topaz:video:${requestId}`, requestId } });

    // The maker's own estimate must not be well above ours: otherwise nothing is accepted (and so nothing is spent there).
    const est = creditEstimate(created);
    if (est != null && est > p.topazCredits * 1.2 + 1) return fail("The price changed. Nothing was charged. Please try again.", { est, ours: p.topazCredits });

    const accepted = await topazJson<{ urls?: string[] }>(`/video/${requestId}/accept`, { method: "PATCH" });
    const urls = Array.isArray(accepted.urls) ? accepted.urls : [];
    if (!urls.length) return fail("Upscale could not be started. Please try again.", accepted);

    const bytes = await getObjectBytes(src.storageKey!, MAX_VIDEO_BYTES);
    const part = Math.ceil(bytes.length / urls.length);
    const results: { partNum: number; eTag: string }[] = [];
    for (let i = 0; i < urls.length; i++) {
      const chunk = bytes.subarray(i * part, Math.min(bytes.length, (i + 1) * part));
      const put = await fetch(urls[i], { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: chunk as BodyInit, signal: AbortSignal.timeout(240_000) });
      if (!put.ok) return fail("Upscale could not be started. Please try again.", `upload ${put.status}`);
      results.push({ partNum: i + 1, eTag: (put.headers.get("etag") ?? "").replace(/^"|"$/g, "") });
    }
    await topaz(`/video/${requestId}/complete-upload`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadResults: results }) });
  } catch (err) {
    await fail(topazMessage(err), err);
  }
}

function creditEstimate(o: Record<string, unknown>): number | null {
  const seek = (v: unknown, depth = 0): number | null => {
    if (!v || typeof v !== "object" || depth > 3) return null;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === "number" && /credit|cost/i.test(k)) return x;
      const inner = seek(x, depth + 1);
      if (inner != null) return inner;
    }
    return null;
  };
  return seek(o);
}

export async function topazVideoStatus(statusUrl: string): Promise<VideoStatus> {
  const id = statusUrl.slice("topaz:video:".length);
  if (!id || id === "pending") return { state: "in_progress", raw: "uploading" };
  const j = await topazJson<{ status?: string; state?: string; download?: { url?: string }; error?: unknown }>(`/video/${encodeURIComponent(id)}/status`);
  const raw = String(j.status ?? j.state ?? "");
  const s = raw.toLowerCase();
  if (/complete/.test(s)) return j.download?.url ? { state: "completed", videoUrl: j.download.url } : { state: "failed", detail: "completed with no download address" };
  if (/cancel/.test(s)) return { state: "canceled" };
  if (/fail/.test(s)) return { state: "failed", detail: typeof j.error === "string" ? j.error : undefined };
  if (/queue|pending|request|accept|upload/.test(s)) return { state: "queued", raw };
  return { state: "in_progress", raw };
}

export const isTopazUrl = (u: string | null | undefined) => typeof u === "string" && u.startsWith("topaz:");
export { VIDEO_SPECS };
