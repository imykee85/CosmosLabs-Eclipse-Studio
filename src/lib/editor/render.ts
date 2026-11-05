import { activeVisual, clipDur, fadeFactor, FPS, layout, sizeFor, totalDur, type Project } from "./model";

export type Media = HTMLVideoElement | HTMLImageElement;

/** Draw one frame of the project at time t. `media(id)` gives the loaded picture or video element of a clip. */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, t: number, media: (id: string) => Media | null) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
  const a = activeVisual(p, t);
  if (a) {
    const el = media(a.clip.id);
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el?.naturalWidth ?? 0;
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el?.naturalHeight ?? 0;
    if (el && sw && sh) {
      const s = Math.max(w / sw, h / sh); // cover
      ctx.globalAlpha = fadeFactor(a.clip, a.local);
      try { ctx.drawImage(el, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s); } catch { /* frame not ready */ }
      ctx.globalAlpha = 1;
    }
  }
  for (const x of p.texts) {
    if (t < x.start || t >= x.start + x.dur || !x.text.trim()) continue;
    const px = Math.round((h * x.size) / 100);
    ctx.font = `700 ${px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = x.color; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = px / 4;
    const lines = wrap(ctx, x.text, w * 0.86);
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h * x.y + (i - (lines.length - 1) / 2) * px * 1.15));
    ctx.shadowBlur = 0;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    v.onloadeddata = () => res(v);
    v.onerror = () => rej(new Error("A clip could not be opened."));
    v.src = src;
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("A picture could not be opened.")); i.src = src; });
}
function seek(v: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((res) => {
    if (Math.abs(v.currentTime - time) < 0.001 && v.readyState >= 2) return res();
    const done = () => { v.removeEventListener("seeked", done); res(); };
    v.addEventListener("seeked", done);
    v.currentTime = Math.min(time, Math.max(0, (v.duration || time) - 0.001));
    setTimeout(done, 4000);
  });
}

/** Mix every sound (sound clips and the sound of video clips) into one stereo buffer, with volume, speed and fades. */
export async function mixAudio(p: Project, dur: number): Promise<AudioBuffer | null> {
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * rate)), rate);
  let any = false;
  const cache = new Map<string, AudioBuffer | null>();
  for (const c of layout(p).clips) {
    if (c.kind === "image" || c.volume <= 0) continue;
    if (!cache.has(c.src)) {
      try { cache.set(c.src, await ctx.decodeAudioData(await (await fetch(c.src)).arrayBuffer())); } catch { cache.set(c.src, null); }
    }
    const buf = cache.get(c.src);
    if (!buf) continue;
    const d = clipDur(c);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = c.speed;
    const g = ctx.createGain();
    const fi = Math.min(c.fadeIn, d / 2), fo = Math.min(c.fadeOut, d / 2);
    g.gain.setValueAtTime(fi > 0 ? 0 : c.volume, c.start);
    if (fi > 0) g.gain.linearRampToValueAtTime(c.volume, c.start + fi);
    if (fo > 0) { g.gain.setValueAtTime(c.volume, c.start + d - fo); g.gain.linearRampToValueAtTime(0, c.start + d); }
    src.connect(g).connect(ctx.destination);
    src.start(c.start, c.in, c.out - c.in);
    src.stop(c.start + d);
    any = true;
  }
  return any ? ctx.startRendering() : null;
}

/** Render the project to an MP4 in the browser (the person's own device does the work). */
export async function exportProject(p: Project, onProgress: (fraction: number, label: string) => void, signal?: AbortSignal): Promise<Blob> {
  const mb = await import("mediabunny");
  const lp = layout(p);
  const dur = totalDur(lp);
  if (dur <= 0) throw new Error("There is nothing to export yet.");
  const { w, h } = sizeFor(p.aspect, 720);
  const vcodec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h });
  if (!vcodec) throw new Error("This browser cannot save video. Try Chrome, Edge or Safari.");

  onProgress(0, "Loading clips");
  const media = new Map<string, Media>();
  const bySrc = new Map<string, Media>();
  for (const c of lp.clips) {
    if (c.kind === "audio") continue;
    let el = bySrc.get(c.src);
    if (!el) { el = c.kind === "video" ? await loadVideo(c.src) : await loadImage(c.src); bySrc.set(c.src, el); }
    media.set(c.id, el);
  }

  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
  const vsrc = new mb.CanvasSource(canvas, { codec: vcodec, bitrate: mb.QUALITY_HIGH });
  output.addVideoTrack(vsrc, { frameRate: FPS });

  onProgress(0.02, "Mixing sound");
  const mixed = await mixAudio(lp, dur);
  let asrc: InstanceType<typeof mb.AudioBufferSource> | null = null;
  if (mixed) {
    const acodec = await mb.getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: 48000 });
    if (acodec) { asrc = new mb.AudioBufferSource({ codec: acodec, bitrate: mb.QUALITY_HIGH }); output.addAudioTrack(asrc); }
  }
  await output.start();
  if (asrc && mixed) await asrc.add(mixed);

  const frames = Math.ceil(dur * FPS);
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) { await output.cancel(); throw new Error("Cancelled."); }
    const t = i / FPS;
    const a = activeVisual(lp, t);
    if (a && a.clip.kind === "video") { const v = media.get(a.clip.id) as HTMLVideoElement; await seek(v, a.src); }
    drawFrame(ctx, w, h, lp, t, (id) => media.get(id) ?? null);
    await vsrc.add(t, 1 / FPS);
    if (i % 5 === 0) { onProgress(0.05 + 0.9 * (i / frames), "Rendering"); await wait(0); }
  }
  onProgress(0.97, "Finishing");
  await output.finalize();
  if (!target.buffer) throw new Error("The render produced no file.");
  return new Blob([target.buffer], { type: "video/mp4" });
}
