import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, copyFileSync, existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Reads still pictures out of a video file with ffmpeg (the binary comes from @ffmpeg-installer/ffmpeg, or FFMPEG_PATH for tests). No shell is involved:
// every argument is passed as its own value, and times are numbers formatted here.
let cached: string | null = null;

function binary(): string {
  if (cached) return cached;
  let path = process.env.FFMPEG_PATH || "";
  if (!path) {
    try { path = (require("@ffmpeg-installer/ffmpeg") as { path: string }).path; } catch { path = "ffmpeg"; }
  }
  // A packaged copy can lose its "run" permission: use a copy in the temp folder that has it.
  if (path.includes("/") && existsSync(/*turbopackIgnore: true*/ path)) {
    try { accessSync(path, constants.X_OK); } catch {
      const copy = join(tmpdir(), "eclipse-ffmpeg");
      if (!existsSync(copy)) { copyFileSync(path, copy); chmodSync(copy, 0o755); }
      path = copy;
    }
  }
  return (cached = path);
}

export function run(args: string[], timeoutMs: number, input?: Uint8Array): Promise<{ code: number; out: Buffer; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(/*turbopackIgnore: true*/ binary(), ["-protocol_whitelist", "file,pipe,crypto,tls,tcp,https", ...args], { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    if (input) { p.stdin!.on("error", () => {}); p.stdin!.end(input); }
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg took too long")); }, timeoutMs);
    p.stdout!.on("data", (d: Buffer) => out.push(d));
    p.stderr!.on("data", (d: Buffer) => { if (err.length < 20_000) err += d.toString(); });
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? -1, out: Buffer.concat(out), err }); });
  });
}

/** The length of the video in seconds, read from ffmpeg's own report of the file. */
export async function probeDuration(file: string): Promise<number | null> {
  const r = await run(["-hide_banner", "-i", file], 20_000).catch(() => null);
  const m = r?.err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** One JPEG frame at `sec`, no wider than `maxWidth`. `0:V:0` is the first real video stream (a cover picture some editors embed is skipped). */
export async function frameAt(file: string, sec: number, maxWidth: number, quality = 4, timeoutMs = 30_000): Promise<Buffer> {
  const t = Math.max(0, sec).toFixed(3);
  const r = await run(["-v", "error", "-ss", t, "-i", file, "-map", "0:V:0", "-an", "-sn", "-dn", "-frames:v", "1", "-vf", `scale='min(${Math.floor(maxWidth)},iw)':-2`, "-q:v", String(quality), "-f", "image2pipe", "-vcodec", "mjpeg", "-"], timeoutMs);
  if (r.code !== 0 || r.out.byteLength < 200) throw new Error(`could not read a frame at ${t} s`);
  return r.out;
}

/**
 * All the frames at `times` in ONE pass through the video: the file is read and decoded once, start to end of the window, and the first frame at or after
 * each time is kept. This is what makes videos from phone editors (CapCut, InShot, the phone's own editor...) readable: their encoders often put keyframes
 * far apart (sometimes one for the whole clip), so jumping to each moment separately means decoding (and, from storage, downloading) most of the file again
 * for every frame. Frames come back in order, labelled with their target time; fewer may come back than were asked for if the video ends early.
 */
export async function framesInOnePass(src: string, times: number[], maxWidth: number, quality = 4, timeoutMs = 150_000): Promise<{ t: number; b: Buffer }[]> {
  const sorted = [...times].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const started = Date.now();
  const first = await onePass(src, sorted, maxWidth, quality, timeoutMs, true).catch((e: Error) => e);
  if (!(first instanceof Error) && first.length) return first;
  // Files without an index (MPEG transport streams, some broken exports) cannot be jumped into: read them from the very start instead.
  if (sorted[0] > 0.05) {
    const again = await onePass(src, sorted, maxWidth, quality, Math.max(10_000, timeoutMs - (Date.now() - started)), false).catch((e: Error) => e);
    if (!(again instanceof Error) && again.length) return again;
  }
  throw first instanceof Error ? first : new Error("no frames in this window");
}

async function onePass(src: string, sorted: number[], maxWidth: number, quality: number, timeoutMs: number, jump: boolean): Promise<{ t: number; b: Buffer }[]> {
  const from = jump ? Math.max(0, sorted[0] - 0.05) : 0;
  const span = sorted[sorted.length - 1] - from + 1;
  // the first frame at or after each moment. After a jump ffmpeg counts time from `from`; read from the start, setpts makes the first frame time 0
  // (transport streams start at 1.4 s or so).
  const pick = sorted.map((t) => { const r = Math.max(0, t - from - 0.0005).toFixed(4); // half a millisecond early: a moment exactly on a frame keeps that frame
    return `gte(t\\,${r})*(isnan(prev_selected_t)+lt(prev_selected_t\\,${r}))`; }).join("+");
  const dir = await mkdtemp(join(tmpdir(), "eclipse-frames-"));
  try {
    const r = await run(["-v", "error", ...(jump ? ["-ss", from.toFixed(3)] : []), "-i", src, "-map", "0:V:0", "-an", "-sn", "-dn", "-t", span.toFixed(3),
      "-vf", `${jump ? "" : "setpts=PTS-STARTPTS,"}select='${pick}',scale='min(${Math.floor(maxWidth)},iw)':-2`, "-vsync", "vfr", "-q:v", String(quality), "-f", "image2", join(dir, "f%03d.jpg")], timeoutMs);
    const names = (await readdir(dir)).filter((n) => n.endsWith(".jpg")).sort();
    const out: { t: number; b: Buffer }[] = [];
    for (let i = 0; i < names.length && i < sorted.length; i++) {
      const b = await readFile(join(dir, names[i]));
      if (b.byteLength >= 200) out.push({ t: sorted[i], b });
    }
    if (!out.length) throw new Error(r.code === 0 ? "no frames in this window" : `ffmpeg could not read the video (${r.err.trim().split("\n").pop()?.slice(0, 160) ?? ""})`);
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Frames at `times`, whatever the video: quick separate jumps when the file allows it (frequent keyframes: most online videos), otherwise one pass
 * through the file (phone-edited videos with keyframes far apart). Two jumps decide: one near the start (cheap for every file) and one to the last moment.
 * With frequent keyframes both cost about the same; with sparse keyframes the last one must decode most of the clip and is far slower, so it is stopped
 * and the file is read in one pass instead.
 */
export async function readFrames(src: string, times: number[], maxWidth: number, quality = 4): Promise<{ t: number; b: Buffer }[]> {
  const sorted = [...times].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const firstAt = sorted[0], last = sorted[sorted.length - 1];
  let started = Date.now();
  const first = await frameAt(src, firstAt, maxWidth, quality, 20_000).catch(() => null);
  const costFirst = Date.now() - started;
  if (first && sorted.length === 1) return [{ t: firstAt, b: first }];
  if (first) {
    started = Date.now();
    const end = await frameAt(src, last, maxWidth, quality, Math.max(3_000, costFirst * 3 + 1_000)).catch(() => null);
    if (end) {
      const middle = await Promise.all(sorted.slice(1, -1).map((t) => frameAt(src, t, maxWidth, quality, 30_000).then((b) => ({ t, b })).catch(() => null)));
      const got = [{ t: firstAt, b: first }, ...middle.filter((x): x is { t: number; b: Buffer } => !!x), { t: last, b: end }];
      if (got.length === sorted.length) return got;
    }
  }
  try { return await framesInOnePass(src, sorted, maxWidth, quality); } catch {}
  return first ? [{ t: firstAt, b: first }] : [];
}

/** Evenly spaced moments across [from, to]: the middle of each of `count` equal slices, so the first and last frames are not black fades. */
export function spacedTimes(from: number, to: number, count: number): number[] {
  const span = Math.max(0, to - from);
  return Array.from({ length: count }, (_, i) => Math.round((from + ((i + 0.5) * span) / count) * 100) / 100);
}

/** A picture redrawn as a JPEG no wider than `maxWidth` (for pictures too large to hand to the model as they are). Null when it cannot be done. */
export async function shrinkPicture(bytes: Uint8Array, maxWidth = 1568, quality = 3): Promise<Buffer | null> {
  // sharp first (it ships with every route that needs it, unlike the ffmpeg binary); ffmpeg only if sharp cannot read the picture.
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(bytes), { failOn: "none", limitInputPixels: 200_000_000 }).rotate()
      .resize({ width: Math.floor(maxWidth), withoutEnlargement: true }).jpeg({ quality: Math.max(50, Math.min(95, 100 - quality * 4)), mozjpeg: true }).toBuffer();
    if (out.byteLength > 200) return out;
  } catch {}
  try {
    const r = await run(["-v", "error", "-i", "pipe:0", "-frames:v", "1", "-vf", `scale='min(${Math.floor(maxWidth)},iw)':-2`, "-q:v", String(quality), "-f", "image2pipe", "-vcodec", "mjpeg", "-"], 45_000, bytes);
    return r.code === 0 && r.out.byteLength > 200 ? r.out : null;
  } catch { return null; }
}

/** Length, picture size and whether it has sound, read from ffmpeg's report. `src` is a file path or an https link (ffmpeg reads links with range requests). */
export async function probeVideo(src: string): Promise<{ duration: number; width: number; height: number; hasAudio: boolean } | null> {
  const r = await run(["-hide_banner", "-i", src], 45_000).catch(() => null);
  if (!r) return null;
  const d = r.err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = r.err.match(/Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  if (!d || !v) return null;
  return { duration: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]), width: Number(v[1]), height: Number(v[2]), hasAudio: /Audio:/.test(r.err) };
}
