// A video render is a job that takes minutes. It is created as "pending" when Higgsfield accepts it (the price is HELD from that moment, see reservations.ts)
// and finished by whoever asks next through GET /api/generations/<id>/status: the browser asks every few seconds while the video is running, the daily job is
// only a safety net. Each ask checks the provider ONCE; when the video is done the row is claimed (status "saving", atomic, so a second ask cannot copy the
// file twice), the file is copied into private storage as a stream, credits are charged once, and the row is completed.
// A video that fails, is refused, is canceled or runs out of time is marked failed. Nothing was charged for it, so releasing the hold IS the refund.
import type { Generation } from "@prisma/client";
import { spendCredits } from "./credits";
import { db } from "./db";
import { cancelVideo, videoStatus } from "./higgsfield-video";
import { safeText } from "./safe-text";
import { saveVideoFromUrl, storageEnabled } from "./storage";
import { findVideoModel, videoTimeoutMs } from "./video-models";

const SAVING_STALE_MS = 10 * 60 * 1000;     // a copy that has not finished by now was abandoned (the function was cut off); another ask may take it over
const START_GRACE_MS = 2 * 60 * 1000;       // the row exists a moment before the provider is called
const MAX_COPY_TRIES = 4;                   // after this many failed copies the video is given up (never silently sent to users from the provider's address)

export const REFUSED = "The model refused this. Try a different prompt or picture.";
export const FAILED = "The video could not be made. No credits were used.";
export const CANCELED = "This video was canceled. No credits were used.";
export const TIMED_OUT = "This video took too long and was stopped. No credits were used.";

type Params = { workflow?: string; endpoint?: string; resolution?: string; duration?: number; copyTries?: number; cancelRequested?: boolean; rights?: boolean };
const paramsOf = (g: Generation): Params => (g.params && typeof g.params === "object" && !Array.isArray(g.params) ? (g.params as Params) : {});

async function failVideo(g: Generation, error: string): Promise<Generation> {
  await db.generation.updateMany({ where: { id: g.id, status: { in: ["pending", "saving"] } }, data: { status: "failed", error, finishedAt: new Date() } });
  return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
}

// Checks on a running video once and finishes it when it is done. Safe to call from many places at once.
export async function finalizeVideo(g: Generation): Promise<Generation> {
  if (g.kind !== "video") return g;
  const staleSaving = g.status === "saving" && Date.now() - g.updatedAt.getTime() > SAVING_STALE_MS;
  if (g.status !== "pending" && !staleSaving) return g;
  const p = paramsOf(g);
  const model = findVideoModel(g.model);
  const timeoutMs = model ? videoTimeoutMs(model, p.resolution, p.duration ?? g.durationSec ?? 5) : 20 * 60_000;
  const age = Date.now() - g.createdAt.getTime();

  if (!g.statusUrl) {
    // The provider call is still being made (the row exists first, to hold the price): leave it alone, and fail it if the request that made it died.
    if (age < START_GRACE_MS) return g;
    return failVideo(g, "This video could not be started. No credits were used.");
  }

  let s;
  try {
    s = await videoStatus(g.statusUrl);
  } catch (err) {
    console.error("video status check failed", g.id, err);
    if (age > timeoutMs) return failVideo(g, "This video could not be retrieved. No credits were used.");
    return g; // a hiccup: ask again next time
  }

  if (s.state === "queued" || s.state === "in_progress") {
    if (s.state === "in_progress" && !g.startedAt) await db.generation.updateMany({ where: { id: g.id, startedAt: null }, data: { startedAt: new Date() } });
    if (age > timeoutMs) {
      if (g.cancelUrl) await cancelVideo(g.cancelUrl).catch(() => {});
      return failVideo(g, TIMED_OUT);
    }
    return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  }
  if (s.state !== "completed") {
    if (s.state === "nsfw") { console.warn("video refused by the provider", g.id); return failVideo(g, REFUSED); }
    if (s.state === "canceled") return failVideo(g, CANCELED);
    console.error("video failed at the provider", g.id, s.state === "failed" && s.detail ? safeText(s.detail, 300) : "");
    return failVideo(g, FAILED);
  }

  // Done. Claim it (only one caller wins), copy the file, charge once.
  const claim = await db.generation.updateMany({ where: { id: g.id, OR: [{ status: "pending" }, { status: "saving", updatedAt: { lt: new Date(Date.now() - SAVING_STALE_MS) } }] }, data: { status: "saving" } });
  if (claim.count === 0) return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  if (!storageEnabled) return failVideo(g, "Video storage is not set up, so this video could not be saved. No credits were used.");

  let saved;
  try {
    saved = await saveVideoFromUrl(g.userId, g.id, s.videoUrl);
  } catch (err) {
    console.error("saving the video to storage failed", g.id, err);
    const tries = (p.copyTries ?? 0) + 1;
    if (tries >= MAX_COPY_TRIES) return failVideo(g, "This video was made but could not be saved. No credits were used.");
    // Not finished: back to pending so the next ask tries the copy again (the provider still has the file).
    await db.generation.updateMany({ where: { id: g.id, status: "saving" }, data: { status: "pending", params: { ...p, copyTries: tries } } });
    return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  }

  if (g.creditsHeld != null && g.creditsHeld > 0) {
    try { await spendCredits(g.userId, g.creditsHeld, `${model?.label ?? "Video"} video`); } catch (err) { console.error("charging credits failed", g.id, err); }
  }
  return db.generation.update({ where: { id: g.id }, data: { status: "completed", imageUrl: "", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, error: null, finishedAt: new Date() } });
}

// Cancel is best effort (what Higgsfield's cancel address really does is NOT VERIFIED): the provider is asked, then asked how it is going. Only a status of
// canceled ends the row (releasing the hold); otherwise it keeps running until it finishes or times out, so a video the provider did make is never lost.
export async function cancelVideoRender(g: Generation): Promise<Generation> {
  if (g.kind !== "video" || g.status !== "pending") return g;
  if (g.cancelUrl) await cancelVideo(g.cancelUrl);
  await db.generation.updateMany({ where: { id: g.id, status: "pending" }, data: { params: { ...paramsOf(g), cancelRequested: true } } });
  const fresh = await db.generation.findUnique({ where: { id: g.id } });
  return fresh ? finalizeVideo(fresh) : g;
}

// Safety net for the daily job: finish what is finishable, one at a time per row.
export const finalizeVideos = (rows: Generation[]) => Promise.allSettled(rows.filter((r) => r.kind === "video").map(finalizeVideo));
