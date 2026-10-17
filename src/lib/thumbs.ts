import { deleteObject, getObjectBytes, headObjectInfo, openImage, putObject, storageEnabled } from "./storage";

// Small WebP copies of pictures for tiles (Library, Gallery, dashboard, pickers), so a grid never downloads full-size originals
// (up to 10 MB each). Made the first time a tile asks for one and kept in the private bucket next to the original
// (`thumbs/<original key>.webp`); served from our own stable address so the browser can cache it.
export const THUMB_PX = 480;
export const thumbKeyFor = (storageKey: string) => `thumbs/${storageKey}.webp`;

async function resize(bytes: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const out = await sharp(Buffer.from(bytes), { failOn: "none", limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return new Uint8Array(out);
}

/** The thumbnail bytes of a stored picture, made and saved on first use. */
export async function thumbForKey(storageKey: string): Promise<Uint8Array> {
  const key = thumbKeyFor(storageKey);
  if (await headObjectInfo(key).catch(() => null)) return getObjectBytes(key, 2 * 1024 * 1024);
  const small = await resize(await getObjectBytes(storageKey, 40 * 1024 * 1024));
  await putObject(key, small, "image/webp").catch((err) => console.error("saving thumbnail failed", key, err));
  return small;
}

/** A render's thumbnail: from storage when the picture is stored, else made from the provider's link (not saved). */
export async function thumbForRender(g: { imageUrl: string; storageKey: string | null }): Promise<Uint8Array> {
  if (g.storageKey && storageEnabled) return thumbForKey(g.storageKey);
  const res = await openImage(g);
  if (!res.ok) throw new Error(`image ${res.status}`);
  return resize(new Uint8Array(await res.arrayBuffer()));
}

/** Removes a picture's thumbnail (called when the original is deleted); never throws. */
export async function deleteThumb(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey || !storageEnabled) return;
  await deleteObject(thumbKeyFor(storageKey)).catch(() => {});
}

export const thumbHeaders = { "Content-Type": "image/webp", "Cache-Control": "private, max-age=604800, immutable" };
