"use client";
// Browser side of Design Studio Motion: talks to the runtime frame (load, seek, render a frame at full size) and turns a version into an MP4
// with its sound, frame by frame, so the same motion always gives the same video. Nothing here sends the code anywhere but the frame.
import { logicalSize, pixelSize, type BrandKitItem, type MotionAspect, type MotionAudio, type MotionVersionItem } from "./spec";

export const FRAME_URL = "/api/design/motion/frame";
export const DEFAULT_PALETTE = { bg: "#0b0b0d", fg: "#ffffff", accent: "#c00707", colors: ["#0b0b0d", "#ffffff", "#c00707"] };

export function paletteOf(kit: BrandKitItem | null) {
  if (!kit || !kit.colors.length) return DEFAULT_PALETTE;
  const c = kit.colors;
  return { bg: c[0], fg: c[1] ?? "#ffffff", accent: c[2] ?? c[1] ?? "#c00707", colors: c };
}

let fontBytes: Promise<ArrayBuffer | null> | null = null;
const font = () => (fontBytes ??= fetch("/motion/Inter.woff2").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));

const imageCache = new Map<string, Promise<ImageBitmap | null>>();
export function loadImage(ref: { type: "upload" | "render"; id: string }): Promise<ImageBitmap | null> {
  const key = `${ref.type}:${ref.id}`;
  if (!imageCache.has(key)) imageCache.set(key, fetch(ref.type === "upload" ? `/api/uploads/${ref.id}/file` : `/api/generations/${ref.id}/file`)
    .then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? createImageBitmap(b) : null)).catch(() => null));
  return imageCache.get(key)!;
}

export type LoadSpec = { code: string; aspect: MotionAspect; duration: number; loop: boolean; palette: typeof DEFAULT_PALETTE; images: { type: "upload" | "render"; id: string; label?: string }[] };
type Listener = (m: { type: string; message?: string; where?: string; line?: string | null }) => void;

/** One runtime frame on the page. */
export class MotionHost {
  private iframe: HTMLIFrameElement; private ready = false; private queue: (() => void)[] = []; private waits = new Map<number, (b: ImageBitmap | null) => void>(); private next = 1;
  private onMsg = (e: MessageEvent) => {
    if (e.source !== this.iframe.contentWindow) return;
    const m = e.data ?? {};
    if (m.type === "hello") { this.ready = true; void font().then((bytes) => { if (bytes) this.post({ type: "font", bytes: bytes.slice(0) }); }); this.queue.splice(0).forEach((f) => f()); return; }
    if (m.type === "frame") { const w = this.waits.get(m.id); this.waits.delete(m.id); w?.(m.bitmap ?? null); return; }
    this.listener?.(m);
  };
  listener: Listener | null = null;
  constructor(iframe: HTMLIFrameElement) { this.iframe = iframe; window.addEventListener("message", this.onMsg); }
  dispose() { window.removeEventListener("message", this.onMsg); this.waits.forEach((w) => w(null)); this.waits.clear(); }
  private post(m: unknown, transfer: Transferable[] = []) { const go = () => this.iframe.contentWindow?.postMessage(m, "*", transfer); if (this.ready) go(); else this.queue.push(go); }
  async load(s: LoadSpec, t = 0) {
    const bitmaps = (await Promise.all(s.images.map(loadImage))).filter((b): b is ImageBitmap => !!b);
    const { W, H } = logicalSize(s.aspect);
    // ImageBitmaps are copied (not transferred) so the cache keeps them for the next load.
    this.post({ type: "load", code: s.code, W, H, duration: s.duration, fps: 30, loop: s.loop, palette: s.palette, images: bitmaps, names: s.images.map((i) => i.label ?? "picture"), t });
  }
  seek(t: number) { this.post({ type: "seek", t }); }
  frame(t: number, w: number, h: number, blur: number, fps: number): Promise<ImageBitmap | null> {
    const id = this.next++;
    return new Promise((res) => { this.waits.set(id, res); this.post({ type: "frame", id, t, w, h, blur, fps }); setTimeout(() => { if (this.waits.has(id)) { this.waits.delete(id); res(null); } }, 20_000); });
  }
}

export type ExportOpts = { short: 1080 | 2160; fps: 24 | 30 | 60; blur: boolean; signal?: AbortSignal; onProgress?: (done: number, total: number) => void };

/** Sound files of a finished version (voice, music, sound effects) mixed into one stereo track as long as the motion. */
async function mixSound(audio: MotionAudio | null, seconds: number): Promise<AudioBuffer | null> {
  const ids = (["music", "voice", "sfx"] as const).flatMap((k) => (audio?.[k]?.jobId && audio[k]!.status === "done" ? [{ id: audio[k]!.jobId!, gain: k === "music" ? 0.55 : 1 }] : []));
  if (!ids.length) return null;
  const rate = 48000, ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * rate)), rate);
  let any = false;
  for (const s of ids) {
    try {
      const buf = await ctx.decodeAudioData(await (await fetch(`/api/audio/${s.id}/file`)).arrayBuffer());
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; g.gain.value = s.gain;
      g.gain.setValueAtTime(s.gain, Math.max(0, seconds - 0.4)); g.gain.linearRampToValueAtTime(0, seconds);
      src.connect(g).connect(ctx.destination); src.start(0); any = true;
    } catch { /* a sound that cannot be read is left out */ }
  }
  return any ? ctx.startRendering() : null;
}

export async function exportMotion(host: MotionHost, v: MotionVersionItem, o: ExportOpts): Promise<Blob> {
  const mb = await import("mediabunny");
  const { w, h } = pixelSize(v.aspect, o.short);
  const codec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h });
  if (!codec) throw new Error(o.short === 2160 ? "This browser cannot save 4K video. Try 1080p." : "This browser cannot save video. Try Chrome, Edge or Safari.");
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d")!;
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
  const src = new mb.CanvasSource(canvas, { codec, bitrate: mb.QUALITY_HIGH });
  output.addVideoTrack(src, { frameRate: o.fps });
  const sound = await mixSound(v.audio, v.duration);
  let asrc: InstanceType<typeof mb.AudioBufferSource> | null = null;
  if (sound) {
    const acodec = await mb.getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: 48000 });
    if (acodec) { asrc = new mb.AudioBufferSource({ codec: acodec, bitrate: mb.QUALITY_HIGH }); output.addAudioTrack(asrc); }
  }
  await output.start();
  const total = Math.max(1, Math.round(v.duration * o.fps));
  for (let i = 0; i < total; i++) {
    if (o.signal?.aborted) { await output.cancel(); throw new Error("Cancelled."); }
    const t = i / o.fps;
    const bmp = await host.frame(t, w, h, o.blur ? 4 : 0, o.fps);
    if (!bmp) { await output.cancel(); throw new Error("A frame could not be drawn. Check the preview for an error."); }
    g.drawImage(bmp, 0, 0); bmp.close();
    await src.add(t, 1 / o.fps);
    if (i % 3 === 0) o.onProgress?.(i, total);
  }
  if (asrc && sound) await asrc.add(sound);
  o.onProgress?.(total, total);
  await output.finalize();
  if (!target.buffer) throw new Error("The video produced no file.");
  return new Blob([target.buffer], { type: "video/mp4" });
}

export const fileName = (title: string, v: { n: number }) => `${(title || "motion").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "motion"}-v${v.n}.mp4`;
