// A render is a job: it is created as "pending" the moment Higgsfield accepts it, and finished whenever someone next
// asks about it (the Create page, the Gallery, the Library, the canvas). Nothing depends on a browser staying open: the
// render runs at Higgsfield on its own, and the first request after it completes copies it into storage and charges credits.
import type { Generation } from "@prisma/client";
import { spendCredits } from "./credits";
import { giveBackFreeRender } from "./free-renders";
import { db } from "./db";
import type { Prisma } from "@prisma/client";
import { higgsfield } from "./higgsfield";
import { targetOf, ratioString } from "./conform";
import { chargeFor, getModelById } from "./models";
import { findVideoModel } from "./video-models";
import { safeText } from "./safe-text";
import { displayUrl, saveImageFromUrl, storageEnabled, type SavedImage } from "./storage";

const GIVE_UP_AFTER_MS = 15 * 60 * 1000;
const SAVING_STALE_MS = 2 * 60 * 1000;
const START_GRACE_MS = 2 * 60 * 1000;             // how long a render may be without a provider address while the provider call is being made
// A failed render is not worth keeping. It stays this long after it failed so whoever is watching still reads why, then it is deleted.
const FAILED_KEEP_MS = 2 * 60 * 1000;
export const SYNC_MARK = "sync:";                 // statusUrl of a render that runs inside its own request
const SYNC_GIVE_UP_MS = 6 * 60 * 1000;            // such a request cannot outlive its function time limit; past this it is gone

export type RenderItem = {
  id: string;
  prompt: string;
  model: string | null;
  modelLabel: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  projectId: string | null;
  aspectRatio: string | null;
  seed: number | null;
  seedLocked: boolean;
  references: { type: string; id: string }[] | null;
  status: "pending" | "completed" | "failed";
  error: string | null;
  imageUrl: string | null;    // the picture, or for a video the signed address of the video file
  kind: "image" | "video";
  durationSec: number | null; // videos: the requested or finished length
  hasAudio: boolean | null;
  uploaded: boolean; // a video the person added from their device (not made by a model)
  credits: number | null;     // videos: the price held while running and charged when it completes
  startedAt: Date | null;     // videos: when the provider first reported it running
  createdAt: Date;
  deletedAt: Date | null;
};

const REASONS: Record<string, string> = {
  nsfw: "The model's content filter blocked this image. Try a different prompt.",
  canceled: "This render was canceled.",
  cancelled: "This render was canceled.",
};
const reasonText = (r: string) => REASONS[r] ?? "The model could not make this image. Please try again.";

// `error` is what the person sees (Eclipse's own words); `detail` is the provider's own text, kept on the row for the owner's job page only.
const isFree = (params: unknown) => Boolean(params && typeof params === "object" && !Array.isArray(params) && (params as { free?: boolean }).free);

async function fail(id: string, error: string, detail?: string): Promise<Generation | null> {
  let params: Prisma.InputJsonValue | undefined;
  if (detail) {
    const cur = await db.generation.findUnique({ where: { id }, select: { params: true } });
    const base = cur?.params && typeof cur.params === "object" && !Array.isArray(cur.params) ? (cur.params as Record<string, unknown>) : {};
    params = { ...base, providerError: safeText(detail, 400) } as Prisma.InputJsonValue;
  }
  const res = await db.generation.updateMany({ where: { id, status: { in: ["pending", "saving"] } }, data: { status: "failed", error, ...(params ? { params } : {}) } });
  const row = await db.generation.findUnique({ where: { id } });
  if (res.count > 0 && row && isFree(row.params)) await giveBackFreeRender(row.userId).catch(() => {}); // a free render that failed does not use up the offer
  return row;
}

// Asks the provider how a running render is going and, if it is done, stores it. Safe to call from many places at once:
// only one caller wins the claim, so a render is saved and charged exactly once.
export async function finalizeGeneration(g: Generation): Promise<Generation> {
  // A video is finished only by its own lazy route (src/lib/video-jobs.ts): the list and the by-id route must stay quick and never start a long copy.
  if (g.kind === "video") return g;
  const staleSaving = g.status === "saving" && Date.now() - g.updatedAt.getTime() > SAVING_STALE_MS;
  if (g.status !== "pending" && !staleSaving) return g;
  // A render from Google or OpenAI runs in the background of the request that started it (no job to ask about): leave it alone while it can still be running, and fail it if that function died.
  if (g.statusUrl?.startsWith(SYNC_MARK)) {
    if (g.status === "pending" && Date.now() - g.createdAt.getTime() > SYNC_GIVE_UP_MS) return (await fail(g.id, "This render took too long and was stopped. Please try again.")) ?? g;
    return g;
  }
  if (!g.statusUrl) {
    // The row is created before the provider is called (to hold the price), so for a moment it has no address yet: leave it alone.
    if (Date.now() - g.createdAt.getTime() < START_GRACE_MS) return g;
    return (await fail(g.id, "This render could not be started.")) ?? g;
  }

  let s;
  try {
    s = await higgsfield.status(g.statusUrl);
  } catch (err) {
    console.error("status check failed", g.id, err);
    // A hiccup: stay pending and ask again next time. But if it keeps failing long after the render started, the result is gone.
    if (Date.now() - g.createdAt.getTime() > GIVE_UP_AFTER_MS) return (await fail(g.id, "This render could not be retrieved. Please try again.")) ?? g;
    return g;
  }
  if (s.state === "pending") {
    if (Date.now() - g.createdAt.getTime() > GIVE_UP_AFTER_MS) {
      if (g.requestId) await higgsfield.cancel(g.requestId).catch(() => {});
      return (await fail(g.id, "This render took too long and was stopped. Please try again.")) ?? g;
    }
    return g;
  }
  if (s.state === "failed") return (await fail(g.id, reasonText(s.reason), s.detail)) ?? g;

  const claim = await db.generation.updateMany({
    where: { id: g.id, OR: [{ status: "pending" }, { status: "saving", updatedAt: { lt: new Date(Date.now() - SAVING_STALE_MS) } }] },
    data: { status: "saving" },
  });
  if (claim.count === 0) return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;

  // Keep our own copy in the private bucket. If the copy fails the render is not lost: it falls back to the provider's link.
  let saved: SavedImage | null = null;
  if (storageEnabled) {
    try { saved = await saveImageFromUrl(g.userId, s.imageUrl, targetOf(g.params)); } catch (err) { console.error("saving the render to storage failed", err); }
  }
  // Charge only once the render exists (a model with no credit price yet is free).
  const chargedModel = getModelById(g.model);
  const cost = isFree(g.params) ? null : chargeFor(chargedModel);
  if (cost != null) {
    try { await spendCredits(g.userId, cost, `${chargedModel?.label ?? "Image"} image`); } catch (err) { console.error("charging credits failed", g.id, err); }
  }
  return db.generation.update({ where: { id: g.id }, data: { status: "completed", imageUrl: s.imageUrl, storageKey: saved?.key ?? null, contentType: saved?.contentType ?? null, sizeBytes: saved?.sizeBytes ?? null, width: saved?.width ?? null, height: saved?.height ?? null, ...(saved?.conformed && targetOf(g.params) ? { aspectRatio: ratioString(targetOf(g.params)!) } : {}), error: null } });
}

// Deletes failed renders (one user's, or everyone's when no user is given) once they have been shown for a moment. A render fails before
// anything is stored, so there is no file to remove and no credit was charged.
// The render exists as a picture now: charge once (a model with no credit price is free) and mark it completed. Used by the Google and OpenAI path.
export async function completeFromBytes(g: Generation, saved: SavedImage, usage: unknown): Promise<Generation> {
  const model = getModelById(g.model);
  const cost = isFree(g.params) ? null : chargeFor(model);
  if (cost != null) {
    try { await spendCredits(g.userId, cost, `${model?.label ?? "Image"} image`); } catch (err) { console.error("charging credits failed", g.id, err); }
  }
  return db.generation.update({ where: { id: g.id }, data: { status: "completed", imageUrl: "", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, width: saved.width, height: saved.height, ...(saved.conformed && targetOf(g.params) ? { aspectRatio: ratioString(targetOf(g.params)!) } : {}), providerUsage: usage == null ? undefined : (usage as object) } });
}

export async function failRender(id: string, error: string, detail?: string): Promise<void> { await fail(id, error, detail); }

export async function purgeFailed(userId?: string): Promise<number> {
  const rows = await db.generation.findMany({ where: { status: "failed", updatedAt: { lt: new Date(Date.now() - FAILED_KEEP_MS) }, ...(userId ? { userId } : {}) }, select: { id: true, kind: true, params: true } });
  // A video we stopped waiting for is kept while it may still finish at the provider (see rescueLateVideo).
  const drop = rows.filter((r) => !(r.kind === "video" && r.params && typeof r.params === "object" && !Array.isArray(r.params) && Number((r.params as { lateUntil?: number }).lateUntil ?? 0) > Date.now())).map((r) => r.id);
  if (!drop.length) return 0;
  return (await db.generation.deleteMany({ where: { id: { in: drop } } })).count;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

// A readable, unique file name such as soul-2-20261008-153012-a1b2c3.png
export function fileNameFor(g: Generation): string {
  const label = (g.kind === "video" ? findVideoModel(g.model)?.label : getModelById(g.model)?.label) ?? g.model ?? (g.kind === "video" ? "video" : "image");
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || (g.kind === "video" ? "video" : "image");
  const t = g.createdAt.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `${slug}-${t}-${g.id.slice(-6)}.${EXT[g.contentType ?? ""] ?? (g.kind === "video" ? "mp4" : "png")}`;
}

export async function toItem(g: Generation): Promise<RenderItem> {
  const done = g.status === "completed";
  return {
    id: g.id,
    prompt: g.prompt,
    model: g.model,
    modelLabel: (g.kind === "video" ? findVideoModel(g.model)?.label : getModelById(g.model)?.label) ?? g.model,
    fileName: done ? fileNameFor(g) : null,
    contentType: g.contentType,
    sizeBytes: g.sizeBytes,
    width: g.width,
    height: g.height,
    resolution: g.resolution,
    projectId: g.projectId,
    aspectRatio: g.aspectRatio,
    seed: g.seed,
    seedLocked: g.seedLocked,
    references: Array.isArray(g.references) ? (g.references as { type: string; id: string }[]) : null,
    status: g.status === "failed" ? "failed" : done ? "completed" : "pending",
    error: g.status === "failed" ? g.error : null,
    imageUrl: done ? await displayUrl(g) : null,
    kind: g.kind === "video" ? "video" : "image",
    durationSec: g.durationSec,
    hasAudio: g.hasAudio,
    uploaded: !!(g.params && typeof g.params === "object" && (g.params as Record<string, unknown>).uploaded === true),
    credits: g.creditsHeld,
    startedAt: g.startedAt,
    createdAt: g.createdAt,
    deletedAt: g.deletedAt,
  };
}
