// Records the active shot of a World to an MP4, in the browser: exactly what its camera sees (no grid labels, gizmos or camera icons),
// frame by frame at a fixed rate, so the same scene always gives the same clip. Used by "Use video" and "Export".
import { ASPECT_RATIO, shotOf, type World } from "./world";
import type { Assets } from "./render-page";

export const RECORD_FPS = 24;
export type RecordQuality = "480p" | "720p";
/** Frame size for a shot: the short side is 480 or 720 pixels, both sides even. */
export function recordSize(aspect: World["aspect"], q: RecordQuality): { w: number; h: number } {
  const ar = ASPECT_RATIO[aspect], short = q === "480p" ? 480 : 720, even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return ar >= 1 ? { w: even(short * ar), h: short } : { w: short, h: even(short / ar) };
}
export const frameCount = (w: World) => Math.max(1, Math.round(shotOf(w).durationS * RECORD_FPS));

export async function recordWorld(world: World, opts: { quality: RecordQuality; assets?: Assets; models?: Map<string, ArrayBuffer>; signal?: AbortSignal; onProgress?: (done: number, total: number) => void }): Promise<Blob> {
  const mb = await import("mediabunny");
  const { createView } = await import("./world-view");
  const { w, h } = recordSize(world.aspect, opts.quality);
  const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h });
  if (!codec) throw new Error("This browser cannot save video. Try Chrome, Edge or Safari.");
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const view = createView(canvas, { helpers: false, assets: opts.assets, models: opts.models });
  try {
    view.resize(w, h); view.setWorld(world); view.setMode("compose");
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
    const src = new mb.CanvasSource(canvas, { codec, bitrate: mb.QUALITY_HIGH });
    output.addVideoTrack(src, { frameRate: RECORD_FPS });
    await output.start();
    const total = frameCount(world);
    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) { await output.cancel(); throw new Error("Cancelled."); }
      const t = i / RECORD_FPS;
      view.setTime(t); view.drawNow();
      await src.add(t, 1 / RECORD_FPS);
      if (i % 4 === 0) { opts.onProgress?.(i, total); await new Promise((r) => setTimeout(r, 0)); }
    }
    opts.onProgress?.(total, total);
    await output.finalize();
    if (!target.buffer) throw new Error("The recording produced no file.");
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally { view.dispose(); }
}
