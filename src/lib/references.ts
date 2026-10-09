import { db } from "./db";
import { signedGetUrl, storageEnabled } from "./storage";

// Reference pictures: what a render can be shown as its starting point. People pick their own uploads (Ingredients and
// Assets) and their own finished renders. The browser only ever sends ids, never addresses, so nothing outside the
// user's own files can be named. Each id is resolved here, checked against the owner, and turned into an https link the
// provider can fetch. The links are signed and last REFERENCE_LINK_SECONDS, long enough for a queued render to start.
export const REFERENCE_LINK_SECONDS = 60 * 60;
export const MAX_REFERENCES = 16;

export type ReferenceRef = { type: "upload" | "render"; id: string };
export type ResolvedReferences = { ok: true; urls: string[]; refs: ReferenceRef[] } | { ok: false; error: string };

export function parseReferenceRefs(input: unknown): ReferenceRef[] | null {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > MAX_REFERENCES) return null;
  const refs: ReferenceRef[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") return null;
    const { type, id } = r as { type?: unknown; id?: unknown };
    if ((type !== "upload" && type !== "render") || typeof id !== "string" || id.length === 0 || id.length > 64) return null;
    if (!refs.some((x) => x.type === type && x.id === id)) refs.push({ type, id });
  }
  return refs;
}

export async function resolveReferences(userId: string, refs: ReferenceRef[]): Promise<ResolvedReferences> {
  const urls: string[] = [];
  for (const r of refs) {
    if (r.type === "upload") {
      const u = await db.upload.findFirst({ where: { id: r.id, userId }, select: { storageKey: true } });
      if (!u || !storageEnabled) return { ok: false, error: "One of your reference pictures could not be found. It may have been deleted." };
      urls.push(await signedGetUrl(u.storageKey, REFERENCE_LINK_SECONDS));
    } else {
      const g = await db.generation.findFirst({ where: { id: r.id, userId, status: "completed", deletedAt: null }, select: { storageKey: true, imageUrl: true } });
      if (!g) return { ok: false, error: "One of your reference images could not be found. It may have been deleted." };
      // A render that never reached our storage can still be used through the provider's own (https) link.
      if (g.storageKey && storageEnabled) urls.push(await signedGetUrl(g.storageKey, REFERENCE_LINK_SECONDS));
      else if (g.imageUrl.startsWith("https://")) urls.push(g.imageUrl);
      else return { ok: false, error: "One of your reference images is not available to send. Try another." };
    }
  }
  return { ok: true, urls, refs };
}
