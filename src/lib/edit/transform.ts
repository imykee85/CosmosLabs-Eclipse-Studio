import { db } from "@/lib/db";
import { getObjectBytes, saveImageBytes, storageEnabled } from "@/lib/storage";

// The free, local picture edits of the Canvas "Edit image" node: Crop to an aspect ratio and Adjust (light, colour). No model and no credits: the picture is changed
// with sharp and saved as a new picture; the original stays. Pure `applyCrop` / `applyAdjust` are separate so they can be tested without a database.
import { CROP_RATIOS as RATIOS } from "./crop-options";
export const CROP_RATIOS = RATIOS;
export type Adjust = { brightness: number; contrast: number; saturation: number; warmth: number; sharpness: number }; // each -100..100 (sharpness 0..100)
export const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, sharpness: 0 };
const clamp = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
export function cleanAdjust(v: unknown): Adjust {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { brightness: clamp(o.brightness, -100, 100), contrast: clamp(o.contrast, -100, 100), saturation: clamp(o.saturation, -100, 100), warmth: clamp(o.warmth, -100, 100), sharpness: clamp(o.sharpness, 0, 100) };
}
export const isUnchanged = (a: Adjust) => a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && a.warmth === 0 && a.sharpness === 0;

/** The centred (or focused) crop box of the biggest area with the given ratio. focus is 0..1 from the left/top. */
export function cropBox(w: number, h: number, ratio: string, focus: { x: number; y: number } = { x: 0.5, y: 0.5 }) {
  const [rw, rh] = ratio.split(":").map(Number);
  if (!rw || !rh) return null;
  const target = rw / rh;
  let cw = w, ch = h;
  if (w / h > target) cw = Math.round(h * target); else ch = Math.round(w / target);
  cw = Math.max(1, Math.min(w, cw)); ch = Math.max(1, Math.min(h, ch));
  const left = Math.round(Math.min(w - cw, Math.max(0, focus.x * w - cw / 2)));
  const top = Math.round(Math.min(h - ch, Math.max(0, focus.y * h - ch / 2)));
  return { left, top, width: cw, height: ch };
}

export async function applyCrop(bytes: Uint8Array, ratio: string, focus?: { x: number; y: number }): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height) throw new Error("unreadable picture");
  const box = cropBox(meta.width, meta.height, ratio, focus);
  if (!box) throw new Error("bad ratio");
  const out = await sharp(bytes).extract(box).png().toBuffer();
  return { bytes: new Uint8Array(out), width: box.width, height: box.height };
}

export async function applyAdjust(bytes: Uint8Array, a: Adjust): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  let img = sharp(bytes);
  img = img.modulate({ brightness: 1 + a.brightness / 100, saturation: 1 + a.saturation / 100 });
  const k = 1 + a.contrast / 100; // contrast pivots around mid-grey
  if (a.contrast !== 0) img = img.linear(k, 128 * (1 - k));
  if (a.warmth !== 0) { const w = a.warmth / 100; img = img.recomb([[1 + 0.18 * w, 0, 0], [0, 1, 0], [0, 0, 1 - 0.18 * w]]); }
  if (a.sharpness > 0) img = img.sharpen({ sigma: 0.6 + (a.sharpness / 100) * 1.8 });
  return new Uint8Array(await img.png().toBuffer());
}

export type TransformResult = { ok: true; id: string } | { ok: false; status: number; error: string };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Crop or adjust one of the person's finished pictures and save the result as a new picture. */
export async function transformPicture(userId: string, body: unknown): Promise<TransformResult> {
  const b = obj(body);
  const op = b.op === "crop" || b.op === "adjust" ? b.op : null;
  const sourceId = typeof b.sourceId === "string" && b.sourceId.length < 64 ? b.sourceId : "";
  if (!op || !sourceId) return { ok: false, status: 400, error: "Choose a picture and what to do with it." };
  if (!storageEnabled) return { ok: false, status: 503, error: "Editing needs file storage, which is not set up yet." };
  const src = await db.generation.findFirst({ where: { id: sourceId, userId, kind: "image", status: "completed", deletedAt: null } });
  if (!src || !src.storageKey) return { ok: false, status: 404, error: "That picture is not available." };
  const bytes = await getObjectBytes(src.storageKey, 40 * 1024 * 1024);
  let out: Uint8Array; let params: Record<string, unknown>;
  if (op === "crop") {
    const ratio = typeof b.ratio === "string" && (CROP_RATIOS as readonly string[]).includes(b.ratio) ? b.ratio : "";
    if (!ratio) return { ok: false, status: 400, error: "Choose an aspect ratio to crop to." };
    out = (await applyCrop(bytes, ratio)).bytes; params = { editOf: sourceId, op: "crop", ratio };
  } else {
    const a = cleanAdjust(b.adjust);
    if (isUnchanged(a)) return { ok: false, status: 400, error: "Move at least one slider first." };
    out = await applyAdjust(bytes, a); params = { editOf: sourceId, op: "adjust", adjust: a };
  }
  const saved = await saveImageBytes(userId, out, "image/png");
  const made = await db.generation.create({
    data: { userId, prompt: src.prompt, imageUrl: "", status: "completed", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, width: saved.width, height: saved.height, projectId: src.projectId, model: src.model, provider: src.provider, resolution: src.resolution, aspectRatio: op === "crop" ? String(params.ratio) : src.aspectRatio, seed: src.seed, kind: "image", params: params as never },
  });
  return { ok: true, id: made.id };
}
