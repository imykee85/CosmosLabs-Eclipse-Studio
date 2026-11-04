import { z } from "zod";
import { db } from "@/lib/db";
import { headObjectInfo, signedGetUrl, signedMediaUrl, signedPutUrl, storageEnabled, storageHost } from "@/lib/storage";
import { kitFiles } from "../kit";
import { JobInputError, type KindDef } from "./types";

// media.kinetic: renders a kinetic-typography film (scenario-kinetic-film, core/skills/builtin) in a sandbox. The film is a JavaScript spec written by Core;
// it runs in a headless browser inside the sandbox, so it is checked here first (size, one import, no network or code-loading calls, a length cap) and the
// RENDER stage has no network at all. Only the setup stage (npm and PyPI) and the upload stage (storage) may reach out. The result is a new Library video.

const LINK_S = 45 * 60;
export const MAX_SECONDS = 20, MAX_SPEC = 60_000, FPS = 24;
const BAD = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon|eval|Function|require|process|localStorage|sessionStorage|indexedDB|Worker|SharedWorker)\b|import\s*\(|https?:\/\/|document\s*\.\s*cookie|<\s*script|<\s*iframe/i;

export const KineticRequest = z.object({ spec: z.string().min(50).max(MAX_SPEC), resolution: z.enum(["720", "1080"]).optional(), musicTakeId: z.string().min(1).max(60).optional(), projectId: z.string().max(64).optional() }).strict();
export type KineticRequest = z.infer<typeof KineticRequest>;
export const KineticInput = z.object({ spec: z.string().max(MAX_SPEC + 200), res: z.enum(["720", "1080"]), seconds: z.number(), musicKey: z.string().max(300).optional(), outputKey: z.string().min(1).max(300), projectId: z.string().max(64).nullable() }).strict();
export type KineticInput = z.infer<typeof KineticInput>;

/** Checks a spec and returns the version that is rendered (frame rate fixed) and its length in seconds. Throws a plain message the assistant can act on. */
export function checkSpec(src: string, res: "720" | "1080" = "720"): { spec: string; seconds: number } {
  if (src.length > MAX_SPEC) throw new JobInputError("That film spec is too long.");
  const imports = [...src.matchAll(/^\s*import\b[^\n]*$/gm)].map((m) => m[0].trim());
  if (!imports.length || imports.some((l) => !/^import\s*\{[\w\s,]+\}\s*from\s*['"]\.\/blocks\.js['"];?$/.test(l))) throw new JobInputError("The spec may only import blocks from './blocks.js'.");
  if (!/export\s+default\s*\{/.test(src)) throw new JobInputError("The spec must start with 'export default {'.");
  const bad = BAD.exec(src);
  if (bad) throw new JobInputError(`The spec uses something that is not allowed: ${bad[0].trim().slice(0, 20)}. Films are made from the blocks only.`);
  const bpm = Number(/\bbpm\s*:\s*(\d+(?:\.\d+)?)/.exec(src)?.[1]), beats = Number(/\bbeats\s*:\s*(\d+)/.exec(src)?.[1]);
  if (!(bpm >= 60 && bpm <= 220) || !(beats >= 4)) throw new JobInputError("Set bpm (60 to 220) and beats in the spec.");
  const seconds = (beats * 60) / bpm, cap = res === "1080" ? 10 : MAX_SECONDS;
  if (seconds > cap) throw new JobInputError(`That film is ${seconds.toFixed(1)} s. The most is ${cap} s at ${res}p: lower beats or raise bpm.`);
  if (!/\bfps\s*:\s*\d+/.test(src)) throw new JobInputError("Set fps in the spec (it is fixed to 24 when rendering).");
  return { spec: src.replace(/\bfps\s*:\s*\d+/, `fps: ${FPS}`), seconds };
}

const SETUP_SH = String.raw`#!/bin/bash
set -euo pipefail
cd film
npm install playwright@1.63.0 --no-audit --no-fund --loglevel=error >/dev/null
python3 -m pip install --user --quiet numpy opencv-python-headless
`;
const RENDER_SH = String.raw`#!/bin/bash
set -euo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/opt/eclipse/browsers
RES="$1"
if [ ! -s /opt/eclipse/chrome_path ]; then echo "The sandbox base has no browser. The owner must build the base again." >&2; exit 3; fi
cd film
python3 ../kit/scripts/render.py . --res "$RES" --workers 2 --out out/film.mp4 > ../render.log 2>&1 || { tail -c 1500 ../render.log >&2; exit 1; }
if [ -f ../music.audio ]; then
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/film.mp4)
  ffmpeg -v error -y -i out/film.mp4 -i ../music.audio -t "$D" -af "afade=t=out:st=$(python3 -c "print(max(0,$D-1.2))"):d=1.2" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/final.mp4
else cp out/film.mp4 out/final.mp4; fi
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of json out/final.mp4 > ../probe.json
`;
const UPLOAD_SH = String.raw`#!/bin/bash
set -euo pipefail
curl -fsS --max-time 300 -X PUT -H "Content-Type: video/mp4" --upload-file film/out/final.mp4 "$1" -o /dev/null
`;
const FETCH_MUSIC_SH = String.raw`#!/bin/bash
set -euo pipefail
curl -fsSL --max-time 300 "$1" -o music.audio
`;

export const kineticEnabled = () => Boolean(process.env.SANDBOX_PROVIDER) && storageEnabled;
const credits = () => (process.env.SANDBOX_CREDITS_KINETIC && Number(process.env.SANDBOX_CREDITS_KINETIC) >= 0 ? Math.floor(Number(process.env.SANDBOX_CREDITS_KINETIC)) : 10);

export async function kineticInputFor(userId: string, jobId: string, body: unknown): Promise<KineticInput> {
  const parsed = KineticRequest.safeParse(body);
  if (!parsed.success) throw new JobInputError(parsed.error.issues[0]?.message?.slice(0, 160) || "That film is not valid.");
  const req = parsed.data, res = req.resolution ?? "720";
  const { spec, seconds } = checkSpec(req.spec, res);
  let musicKey: string | undefined;
  if (req.musicTakeId) {
    const take = await db.audioJob.findFirst({ where: { id: req.musicTakeId, userId, status: "completed", deletedAt: null, storageKey: { not: null } }, select: { storageKey: true } });
    if (!take?.storageKey) throw new JobInputError("That music take was not found. Pick a finished take of your own.");
    musicKey = take.storageKey;
  }
  if (req.projectId && !(await db.project.findFirst({ where: { id: req.projectId, userId, deletedAt: null }, select: { id: true } }))) throw new JobInputError("That project was not found.");
  return { spec, res, seconds, ...(musicKey ? { musicKey } : {}), outputKey: `u/${userId}/kinetic/${jobId}.mp4`, projectId: req.projectId ?? null };
}

const REGISTRIES = ["registry.npmjs.org", "pypi.org", "files.pythonhosted.org"];
export const kinetic: KindDef<KineticInput> = {
  kind: "media.kinetic",
  schema: KineticInput,
  vcpus: 4,
  deadlineMs: 35 * 60_000,
  network: () => ({ kind: "allowlist", domains: REGISTRIES }),
  base: "snapshot",
  price: (i) => credits() * (i.res === "1080" ? 2 : 1),
  stageCount: () => 4,
  stage: async (_ctx, i, input) => {
    if (i === 0) {
      const film = [
        ...kitFiles("scenario-kinetic-film", "film", (r) => r.startsWith("engine/") && !r.endsWith("/index.html.bak")).map((f) => ({ ...f, path: f.path.replace("film/engine/", "film/") })),
        { path: "film/spec.js", content: Buffer.from(input.spec) },
        ...kitFiles("scenario-kinetic-film", "kit", (r) => r.startsWith("scripts/")),
        { path: "setup.sh", content: Buffer.from(SETUP_SH), mode: 0o755 }, { path: "render.sh", content: Buffer.from(RENDER_SH), mode: 0o755 }, { path: "upload.sh", content: Buffer.from(UPLOAD_SH), mode: 0o755 }, { path: "music.sh", content: Buffer.from(FETCH_MUSIC_SH), mode: 0o755 },
      ];
      return { name: "setup", files: film, network: { kind: "allowlist", domains: REGISTRIES }, cmd: "bash", args: ["setup.sh"] };
    }
    const host = storageHost();
    const storageNet = host ? { kind: "allowlist" as const, domains: [host] } : { kind: "none" as const };
    if (i === 1) { // the music, fetched before the render so the render itself can run with no network
      if (!input.musicKey) return { name: "music", network: { kind: "none" }, cmd: "true", args: [] };
      return { name: "music", network: storageNet, cmd: "bash", args: ["music.sh", await signedGetUrl(input.musicKey, LINK_S)], secretArgs: true };
    }
    if (i === 2) return { name: "render", network: { kind: "none" }, cmd: "bash", args: ["render.sh", input.res] };
    return { name: "upload", network: storageNet, cmd: "bash", args: ["upload.sh", await signedPutUrl(input.outputKey, "video/mp4", LINK_S)], secretArgs: true };
  },
  collect: async (ctx, input) => {
    const probe = await ctx.provider.readFile(ctx.name, "probe.json", 64_000).catch(() => null);
    let duration: number | null = null, width: number | null = null, height: number | null = null, hasAudio = false;
    try {
      const j = JSON.parse(probe?.toString("utf8") ?? "{}") as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number }[] };
      duration = Number(j.format?.duration) || null;
      const v = j.streams?.find((s) => s.codec_type === "video");
      width = v?.width ?? null; height = v?.height ?? null; hasAudio = !!j.streams?.some((s) => s.codec_type === "audio");
    } catch { /* facts only */ }
    const stored = await headObjectInfo(input.outputKey);
    if (!stored?.size) return { output: {}, failed: "The film was not saved. Nothing was charged." };
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const g = width && height ? gcd(width, height) : 0;
    const row = await db.generation.create({
      data: { userId: ctx.job.userId, projectId: input.projectId, prompt: "Kinetic film", status: "completed", kind: "video", imageUrl: "", storageKey: input.outputKey, contentType: "video/mp4", sizeBytes: stored.size, durationSec: duration ? Math.round(duration * 10) / 10 : null, hasAudio, aspectRatio: g ? `${width! / g}:${height! / g}` : null, width, height, params: { kinetic: true, kineticJob: ctx.job.id }, finishedAt: new Date() },
    });
    return { output: { generationId: row.id, key: input.outputKey, sizeBytes: stored.size, durationSec: duration, width, height } };
  },
  failMessage: "The film could not be made. Nothing was charged.",
  present: async (output) => {
    const key = typeof output.key === "string" ? output.key : null;
    return { ...output, key: undefined, url: key ? await signedMediaUrl(key, { ttlSeconds: 3600, download: "kinetic-film.mp4", contentType: "video/mp4" }) : null };
  },
};
