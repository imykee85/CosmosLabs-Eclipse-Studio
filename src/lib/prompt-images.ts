import { db } from "@/lib/db";
import { sniffImageType } from "@/lib/uploads";
import { getObjectBytes, openImage, storageEnabled } from "@/lib/storage";

// The pictures a person attaches on the Prompts page: ids only (never addresses), owner-checked, read from our own storage and handed to the
// model as images. At most 4 pictures of 3 MB each, PNG, JPEG or WebP.
export type ImageRef = { type: "upload" | "render"; id: string };
export type PromptImage = { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string; label: string };
const MAX_PICTURES = 4;
const MAX_BYTES = 3_000_000;

export function parseImageRefs(input: unknown): ImageRef[] | null {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > MAX_PICTURES) return null;
  const out: ImageRef[] = [];
  for (const r of input) {
    const { type, id } = (r ?? {}) as { type?: unknown; id?: unknown };
    if ((type !== "upload" && type !== "render") || typeof id !== "string" || !id || id.length > 64) return null;
    if (!out.some((x) => x.type === type && x.id === id)) out.push({ type, id });
  }
  return out;
}

export async function loadPromptImages(userId: string, refs: ImageRef[]): Promise<{ ok: true; images: PromptImage[] } | { ok: false; error: string }> {
  const images: PromptImage[] = [];
  for (const r of refs) {
    let bytes: Uint8Array;
    let label = "picture";
    try {
      if (r.type === "upload") {
        const u = await db.upload.findFirst({ where: { id: r.id, userId }, select: { storageKey: true, name: true } });
        if (!u || !storageEnabled) return { ok: false, error: "One of your pictures could not be found. It may have been deleted." };
        bytes = await getObjectBytes(u.storageKey);
        label = u.name;
      } else {
        const g = await db.generation.findFirst({ where: { id: r.id, userId, status: "completed", deletedAt: null }, select: { storageKey: true, imageUrl: true, prompt: true } });
        if (!g) return { ok: false, error: "One of your pictures could not be found. It may have been deleted." };
        const res = await openImage(g);
        if (!res.ok) return { ok: false, error: "One of your pictures could not be read." };
        bytes = new Uint8Array(await res.arrayBuffer());
        label = g.prompt.slice(0, 60);
      }
    } catch {
      return { ok: false, error: "One of your pictures could not be read." };
    }
    const type = sniffImageType(bytes);
    if (!type || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return { ok: false, error: "One of your pictures is too large or not a PNG, JPEG or WebP. Try a smaller one." };
    images.push({ mediaType: type, data: Buffer.from(bytes).toString("base64"), label });
  }
  return { ok: true, images };
}
