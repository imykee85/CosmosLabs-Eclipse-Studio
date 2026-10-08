// A render is a job: it is created as "pending" the moment Higgsfield accepts it, and finished whenever someone next
// asks about it (the Create page, the Gallery, the Library, the canvas). Nothing depends on a browser staying open: the
// render runs at Higgsfield on its own, and the first request after it completes copies it into storage and charges credits.
import type { Generation } from "@prisma/client";
import { spendCredits } from "./credits";
import { db } from "./db";
import { higgsfield } from "./higgsfield";
import { getModelById } from "./models";
import { displayUrl, saveImageFromUrl, storageEnabled } from "./storage";

const GIVE_UP_AFTER_MS = 15 * 60 * 1000;
const SAVING_STALE_MS = 2 * 60 * 1000;

export type RenderItem = {
  id: string;
  prompt: string;
  model: string | null;
  projectId: string | null;
  aspectRatio: string | null;
  status: "pending" | "completed" | "failed";
  error: string | null;
  imageUrl: string | null;
  createdAt: Date;
};

const REASONS: Record<string, string> = {
  nsfw: "The model's content filter blocked this image. Try a different prompt.",
  canceled: "This render was canceled.",
  cancelled: "This render was canceled.",
};
const reasonText = (r: string) => REASONS[r] ?? "The model could not make this image. Please try again.";

async function fail(id: string, error: string): Promise<Generation | null> {
  await db.generation.updateMany({ where: { id, status: { in: ["pending", "saving"] } }, data: { status: "failed", error } });
  return db.generation.findUnique({ where: { id } });
}

// Asks the provider how a running render is going and, if it is done, stores it. Safe to call from many places at once:
// only one caller wins the claim, so a render is saved and charged exactly once.
export async function finalizeGeneration(g: Generation): Promise<Generation> {
  const staleSaving = g.status === "saving" && Date.now() - g.updatedAt.getTime() > SAVING_STALE_MS;
  if (g.status !== "pending" && !staleSaving) return g;
  if (!g.statusUrl) return (await fail(g.id, "This render could not be started.")) ?? g;

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
  if (s.state === "failed") return (await fail(g.id, reasonText(s.reason))) ?? g;

  const claim = await db.generation.updateMany({
    where: { id: g.id, OR: [{ status: "pending" }, { status: "saving", updatedAt: { lt: new Date(Date.now() - SAVING_STALE_MS) } }] },
    data: { status: "saving" },
  });
  if (claim.count === 0) return (await db.generation.findUnique({ where: { id: g.id } })) ?? g;

  // Keep our own copy in the private bucket. If the copy fails the render is not lost: it falls back to the provider's link.
  let storageKey: string | null = null;
  if (storageEnabled) {
    try { storageKey = await saveImageFromUrl(g.userId, s.imageUrl); } catch (err) { console.error("saving the render to storage failed", err); }
  }
  // Charge only once the render exists (a model with no credit price yet is free).
  const cost = getModelById(g.model)?.creditCost;
  if (cost != null) {
    try { await spendCredits(g.userId, cost); } catch (err) { console.error("charging credits failed", g.id, err); }
  }
  return db.generation.update({ where: { id: g.id }, data: { status: "completed", imageUrl: s.imageUrl, storageKey, error: null } });
}

export async function toItem(g: Generation): Promise<RenderItem> {
  const done = g.status === "completed";
  return {
    id: g.id,
    prompt: g.prompt,
    model: g.model,
    projectId: g.projectId,
    aspectRatio: g.aspectRatio,
    status: g.status === "failed" ? "failed" : done ? "completed" : "pending",
    error: g.status === "failed" ? g.error : null,
    imageUrl: done ? await displayUrl(g) : null,
    createdAt: g.createdAt,
  };
}
