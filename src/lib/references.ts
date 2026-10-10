import { db } from "./db";
import { uploadFile } from "./higgsfield";
import { getObjectBytes, signedGetUrl, storageEnabled } from "./storage";

// Reference pictures: what a render can be shown as its starting point. People pick their own uploads (Ingredients and
// Assets) and their own finished renders. The browser only ever sends ids, never addresses, so nothing outside the
// user's own files can be named. Each id is resolved here, checked against the owner, and turned into an https link the
// provider can fetch. The links are signed and last REFERENCE_LINK_SECONDS, long enough for a queued render to start.
const REFERENCE_LINK_SECONDS = 60 * 60;
const MAX_REFERENCES = 16;

export type ReferenceRef = { type: "upload" | "render"; id: string };
// One picture ready to hand over: our signed link (always), plus the stored file's key and type when it lives in our bucket.
export type ReferenceItem = { signedUrl: string; storageKey?: string; contentType?: string };
export type ResolvedReferences = { ok: true; items: ReferenceItem[]; refs: ReferenceRef[] } | { ok: false; error: string };

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
  const items: ReferenceItem[] = [];
  for (const r of refs) {
    if (r.type === "upload") {
      const u = await db.upload.findFirst({ where: { id: r.id, userId }, select: { storageKey: true, contentType: true } });
      if (!u || !storageEnabled) return { ok: false, error: "One of your reference pictures could not be found. It may have been deleted." };
      items.push({ signedUrl: await signedGetUrl(u.storageKey, REFERENCE_LINK_SECONDS), storageKey: u.storageKey, contentType: u.contentType });
    } else {
      const g = await db.generation.findFirst({ where: { id: r.id, userId, status: "completed", deletedAt: null }, select: { storageKey: true, imageUrl: true, contentType: true } });
      if (!g) return { ok: false, error: "One of your reference images could not be found. It may have been deleted." };
      // A render that never reached our storage can still be used through the provider's own (https) link.
      if (g.storageKey && storageEnabled) items.push({ signedUrl: await signedGetUrl(g.storageKey, REFERENCE_LINK_SECONDS), storageKey: g.storageKey, contentType: g.contentType ?? "image/png" });
      else if (g.imageUrl.startsWith("https://")) items.push({ signedUrl: g.imageUrl });
      else return { ok: false, error: "One of your reference images is not available to send. Try another." };
    }
  }
  return { ok: true, items, refs };
}

// The addresses the provider will read. By default (HIGGSFIELD_REFERENCE_DELIVERY=upload) each stored picture is copied into
// Higgsfield's own file storage, so no link into our bucket ever leaves the app. If that step fails the picture is still
// delivered, through a one-hour signed link (never dropped). Set HIGGSFIELD_REFERENCE_DELIVERY=signed to always use signed links.
export async function deliverReferences(items: ReferenceItem[]): Promise<string[]> {
  const mode = process.env.HIGGSFIELD_REFERENCE_DELIVERY === "signed" ? "signed" : "upload";
  return Promise.all(items.map(async (it) => {
    if (mode === "signed" || !it.storageKey) return it.signedUrl;
    try {
      return await uploadFile(await getObjectBytes(it.storageKey), it.contentType ?? "image/png");
    } catch (err) {
      console.error("handing a reference to Higgsfield failed, using a signed link instead", err);
      return it.signedUrl;
    }
  }));
}
