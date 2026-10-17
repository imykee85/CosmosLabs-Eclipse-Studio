import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, copyFileSync, existsSync } from "node:fs";
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
  if (path.includes("/") && existsSync(path)) {
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
    const p = spawn(binary(), args, { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
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

/** One JPEG frame at `sec`, no wider than `maxWidth`. */
export async function frameAt(file: string, sec: number, maxWidth: number, quality = 4): Promise<Buffer> {
  const t = Math.max(0, sec).toFixed(3);
  const r = await run(["-v", "error", "-ss", t, "-i", file, "-frames:v", "1", "-vf", `scale='min(${Math.floor(maxWidth)},iw)':-2`, "-q:v", String(quality), "-f", "image2pipe", "-vcodec", "mjpeg", "-"], 30_000);
  if (r.code !== 0 || r.out.byteLength < 200) throw new Error(`could not read a frame at ${t} s`);
  return r.out;
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
