import { readImageSize } from "./image-info";
import { probeVideo, run } from "./video-frames";

// "Auto" aspect ratio with a reference picture means the result must come out in the REFERENCE's aspect ratio. Models only offer a fixed list of ratios, so three layers:
//   1. ask for the nearest ratio the model offers (auto-ratio.ts), or for the exact one when the model takes any size (OpenAI gpt-image-2, Seedream);
//   2. when the file arrives in a slightly different ratio, trim it to the exact one with a centred crop (only the small difference is cut away);
//   3. the row's aspect ratio is then the reference's, so the preview, Gallery and downloads all agree.
// The target is saved on the row (`params.conform`, the reference's own width and height) when the job starts and applied when the file is stored.
export type ConformTarget = { w: number; h: number };

const TOLERANCE = 0.004; // 0.4 percent: pixel rounding by the model is not worth a re-encode

export function targetOf(params: unknown): ConformTarget | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const c = (params as { conform?: { w?: unknown; h?: unknown } }).conform;
  return c && typeof c.w === "number" && typeof c.h === "number" && c.w > 0 && c.h > 0 ? { w: c.w, h: c.h } : null;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** "w:h" reduced, such as 3:2 (the form every aspect ratio is stored in). */
export function ratioString(t: ConformTarget): string {
  const w = Math.round(t.w), h = Math.round(t.h), d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}

/** The centred crop that gives `srcW` x `srcH` the target's ratio, or null when it already has it. `even` keeps video-friendly even sizes. */
export function cropBox(srcW: number, srcH: number, t: ConformTarget, even = false): { w: number; h: number; x: number; y: number } | null {
  if (!(srcW > 0) || !(srcH > 0)) return null;
  const target = t.w / t.h;
  if (Math.abs(srcW / srcH / target - 1) < TOLERANCE) return null;
  const e = (n: number) => (even ? Math.max(2, Math.floor(n / 2) * 2) : Math.max(1, Math.round(n)));
  let w = srcW, h = srcH;
  if (srcW / srcH > target) w = Math.min(srcW, e(srcH * target));
  else h = Math.min(srcH, e(srcW / target));
  return { w, h, x: Math.floor((srcW - w) / 2 / 2) * 2, y: Math.floor((srcH - h) / 2 / 2) * 2 };
}

/** "ok" when the picture already has the ratio, the cropped bytes when it was trimmed, null when it could not be done (the original is then kept). */
export async function conformImage(bytes: Uint8Array, type: string, t: ConformTarget): Promise<{ bytes: Uint8Array; type: string } | "ok" | null> {
  const size = readImageSize(bytes);
  if (!size) return null;
  const box = cropBox(size.width, size.height, t);
  if (!box) return "ok";
  const jpeg = type === "image/jpeg";
  const codec = jpeg ? ["-vcodec", "mjpeg", "-q:v", "1"] : ["-vcodec", "png"]; // png and webp come back as png (lossless)
  try {
    const r = await run(["-v", "error", "-i", "pipe:0", "-vf", `crop=${box.w}:${box.h}:${box.x}:${box.y}`, "-frames:v", "1", "-f", "image2pipe", ...codec, "-"], 60_000, bytes);
    if (r.code !== 0 || r.out.byteLength < 200) return null;
    return { bytes: r.out, type: jpeg ? "image/jpeg" : "image/png" };
  } catch { return null; }
}

/** Crops a video file to the target ratio (re-encoded as H.264 with its sound kept). Returns "ok" when it already matches, true when `dest` was written, false when it failed. */
export async function conformVideoFile(src: string, dest: string, t: ConformTarget, timeoutMs = 200_000): Promise<"ok" | boolean> {
  const info = await probeVideo(src);
  if (!info) return false;
  const box = cropBox(info.width, info.height, t, true);
  if (!box) return "ok";
  const base = ["-y", "-v", "error", "-i", src, "-vf", `crop=${box.w}:${box.h}:${box.x}:${box.y}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  try {
    let r = await run([...base, "-c:a", "copy", dest], timeoutMs);
    if (r.code !== 0) r = await run([...base, "-c:a", "aac", "-b:a", "192k", dest], timeoutMs);
    return r.code === 0;
  } catch { return false; }
}
