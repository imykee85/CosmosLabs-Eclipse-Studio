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
import { ratioString, targetOf } from "./conform";
import { saveVideoFromUrl, storageEnabled } from "./storage";
import { findVideoModel, videoTimeoutMs } from "./video-models";

const SAVING_STALE_MS = 10 * 60 * 1000;     // a copy that has not finished by now was abandoned (the function was cut off); another ask may take it over
const START_GRACE_MS = 2 * 60 * 1000;       // the row exists a moment before the provider is called
const MAX_COPY_TRIES = 4;                   // after this many failed copies the video is given up (never silently sent to users from the provider's address)

export const REFUSED = "The model refused this. Try a different prompt or picture.";
export const FAILED = "The video could not be made. No credits were used.";
export const CANCELED = "This video was canceled. No credits were used.";
export const TIMED_OUT = "This video is taking longer than usual. If it still finishes, it will appear here by itself, and only then are credits used.";
export const LATE_WATCH_MS = 6 * 60 * 60 * 1000; // after a timeout the row is kept this long and re-checked, so a video that finishes late is not lost

type Params = { workflow?: string; endpoint?: string; resolution?: string; duration?: number; copyTries?: number; cancelRequested?: boolean; lateUntil?: number };
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
      // Keep what the provider last said, so the owner can tell "still waiting in its queue" from "running" from "an answer we misread".
      const base = g.params && typeof g.params === "object" && !Array.isArray(g.params) ? (g.params as Record<string, unknown>) : {};
      // We only stop WAITING. The provider is not told to cancel: a job that is really running keeps its credits and may still finish, so cancelling it
      // could cost the person both the credits and the video. Only the person's own Cancel button asks the provider to stop.
      await db.generation.updateMany({ where: { id: g.id, status: { in: ["pending", "saving"] } }, data: { params: { ...base, providerStatusAtTimeout: s.raw ?? s.state, startedAtProvider: Boolean(g.startedAt), lateUntil: Date.now() + LATE_WATCH_MS } as object } });
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

  if (s.usage) await db.generation.updateMany({ where: { id: g.id }, data: { providerUsage: s.usage as object } }); // BytePlus reports the tokens it billed: kept to check the real cost
  return saveAndComplete(g, p, model?.label, s.videoUrl, "pending");
}

// Copies the finished file into storage, charges once and completes the row. `back` is the status the row returns to if the copy fails (the claim moved it to "saving").
async function saveAndComplete(g: Generation, p: Params, label: string | undefined, videoUrl: string, back: "pending" | "failed"): Promise<Generation> {
  let saved;
  try {
    saved = await saveVideoFromUrl(g.userId, g.id, videoUrl, targetOf(g.params));
  } catch (err) {
    console.error("saving the video to storage failed", g.id, err);
    const tries = (p.copyTries ?? 0) + 1;
    if (tries >= MAX_COPY_TRIES) return failVideo(g, "This video was made but could not be saved. No credits were used.");
    // Not finished: back to where it was so the next ask tries the copy again (the provider still has the file).
    await db.generation.updateMany({ where: { id: g.id, status: "saving" }, data: { status: back, params: { ...p, copyTries: tries } } });
    return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  }

  if (g.creditsHeld != null && g.creditsHeld > 0) {
    try { await spendCredits(g.userId, g.creditsHeld, `${label ?? "Video"} video`); } catch (err) { console.error("charging credits failed", g.id, err); }
  }
  return db.generation.update({ where: { id: g.id }, data: { status: "completed", imageUrl: "", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, ...(saved.conformed && targetOf(g.params) ? { aspectRatio: ratioString(targetOf(g.params)!) } : {}), error: null, finishedAt: new Date() } });
}

// A video we stopped waiting for (timed out) is kept for LATE_WATCH_MS and asked about again here: if the provider finished it after all, it is saved and
// charged like any other and the row turns into the video. A provider answer of failed/refused/canceled, or the end of the window, lets the row go.
export const isLateWatch = (g: Generation) => g.kind === "video" && g.status === "failed" && Boolean(g.statusUrl) && (paramsOf(g).lateUntil ?? 0) > Date.now();

export async function rescueLateVideo(g: Generation): Promise<Generation> {
  if (!isLateWatch(g)) return g;
  const p = paramsOf(g);
  let s;
  try { s = await videoStatus(g.statusUrl!); } catch { return g; }
  if (s.state === "queued" || s.state === "in_progress") return g;
  if (s.state !== "completed") {
    await db.generation.updateMany({ where: { id: g.id, status: "failed" }, data: { params: { ...p, lateUntil: 0 } as object } });
    return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  }
  if (!storageEnabled) return g;
  const claim = await db.generation.updateMany({ where: { id: g.id, status: "failed" }, data: { status: "saving" } });
  if (claim.count === 0) return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;
  return saveAndComplete(g, p, findVideoModel(g.model)?.label, s.videoUrl, "failed");
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
