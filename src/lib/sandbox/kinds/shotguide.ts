import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { MODEL_FILES } from "@/lib/shot/assets";
import { db } from "@/lib/db";
import { headObjectInfo, signedMediaUrl, signedPutUrl, storageEnabled, storageHost } from "@/lib/storage";
import { RENDER_MJS } from "@/lib/shot/render-script";
import { SHOT_BUNDLE } from "@/lib/shot/render-bundle.generated";
import { sceneSchema } from "@/lib/shot/schema";
import { JobInputError, type KindDef } from "./types";

// media.shotguide: renders a ShotMap blockout (the person's scene: stand-in people and vehicles, props, a camera move) to a guide video in a sandbox with headless
// Chromium and ffmpeg. The scene is plain data, validated here with the scene schema; nothing from the request is ever put on a command line. The render stage has no
// network; the setup stage may reach npm only and the upload stage the storage host. The result is a new finished video in the Library that Video Studio can use as a
// reference clip. Rendering the same scene twice gives the same video.

const LINK_S = 30 * 60, MAX_SCENE = 300_000, MAX_SECONDS = 30;
export const ShotGuideRequest = z.object({ scene: z.unknown(), res: z.enum(["480", "720"]).optional(), projectId: z.string().max(64).optional() }).strict();
export const ShotGuideInput = z.object({ scene: z.unknown(), res: z.enum(["480", "720"]), outputKey: z.string().min(1).max(300), projectId: z.string().max(64).nullable(), seconds: z.number() }).strict();
export type ShotGuideInput = z.infer<typeof ShotGuideInput>;

const SETUP_SH = String.raw`#!/bin/bash
set -euo pipefail
cd guide
npm install playwright@1.63.0 --no-audit --no-fund --loglevel=error >/dev/null
`;
const RENDER_SH = String.raw`#!/bin/bash
set -euo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/opt/eclipse/browsers
if [ ! -s /opt/eclipse/chrome_path ]; then echo "The sandbox base has no browser. The owner must build the base again." >&2; exit 3; fi
cd guide
node render.mjs scene.json out.mp4 "$1" > ../render.log 2>&1 || { tail -c 1500 ../render.log >&2; exit 1; }
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of json out.mp4 > ../probe.json
`;
const UPLOAD_SH = String.raw`#!/bin/bash
set -euo pipefail
curl -fsS --max-time 300 -X PUT -H "Content-Type: video/mp4" --upload-file guide/out.mp4 "$1" -o /dev/null
`;

/** The model files for the render, read from the deployed public folder, else from this deployment's own address. A file that cannot be read is left out: the guide keeps the stand-in. */
async function modelFiles(): Promise<{ path: string; content: Buffer<ArrayBuffer>; mode?: undefined }[]> {
  const out: { path: string; content: Buffer<ArrayBuffer>; mode?: undefined }[] = [];
  for (const m of Object.values(MODEL_FILES)) {
    let buf: Buffer | null = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "shot-models", m.file)).catch(() => null);
    if (!buf && process.env.VERCEL_URL) { const r = await fetch(`https://${process.env.VERCEL_URL}/shot-models/${m.file}`).catch(() => null); if (r?.ok) buf = Buffer.from(await r.arrayBuffer()); }
    if (buf) out.push({ path: `guide/models/${m.file}`, content: Buffer.from(buf) });
  }
  return out;
}
export const shotGuideEnabled = () => Boolean(process.env.SANDBOX_PROVIDER) && storageEnabled;
/** Guide renders are free within fair use (the brief): a price can be set with SANDBOX_CREDITS_SHOTGUIDE. */
const credits = () => (process.env.SANDBOX_CREDITS_SHOTGUIDE && Number(process.env.SANDBOX_CREDITS_SHOTGUIDE) >= 0 ? Math.floor(Number(process.env.SANDBOX_CREDITS_SHOTGUIDE)) : 0);

export async function shotGuideInputFor(userId: string, jobId: string, body: unknown): Promise<ShotGuideInput> {
  const parsed = ShotGuideRequest.safeParse(body);
  if (!parsed.success) throw new JobInputError("That shot is not valid.");
  const req = parsed.data;
  if (JSON.stringify(req.scene ?? null).length > MAX_SCENE) throw new JobInputError("That scene is too large.");
  const scene = sceneSchema.safeParse(req.scene);
  if (!scene.success) throw new JobInputError(scene.error.issues[0]?.message?.slice(0, 160) || "That scene is not valid.");
  const shots = scene.data.shots, seconds = shots[shots.length - 1].endS - shots[0].startS;
  if (seconds > MAX_SECONDS) throw new JobInputError(`A guide can be up to ${MAX_SECONDS} seconds.`);
  if (req.projectId && !(await db.project.findFirst({ where: { id: req.projectId, userId, deletedAt: null }, select: { id: true } }))) throw new JobInputError("That project was not found.");
  return { scene: scene.data, res: req.res ?? "480", seconds, outputKey: `u/${userId}/shotguide/${jobId}.mp4`, projectId: req.projectId ?? null };
}

export const shotguide: KindDef<ShotGuideInput> = {
  kind: "media.shotguide",
  schema: ShotGuideInput,
  vcpus: 4,
  deadlineMs: 25 * 60_000,
  network: () => ({ kind: "allowlist", domains: ["registry.npmjs.org"] }),
  base: "snapshot",
  price: () => credits(),
  stageCount: () => 3,
  stage: async (_ctx, i, input) => {
    if (i === 0) {
      const files = [
        { path: "guide/bundle.js", content: Buffer.from(SHOT_BUNDLE) }, { path: "guide/scene.json", content: Buffer.from(JSON.stringify(input.scene)) }, { path: "guide/render.mjs", content: Buffer.from(RENDER_MJS) },
        { path: "setup.sh", content: Buffer.from(SETUP_SH), mode: 0o755 }, { path: "render.sh", content: Buffer.from(RENDER_SH), mode: 0o755 }, { path: "upload.sh", content: Buffer.from(UPLOAD_SH), mode: 0o755 },
      ];
      files.push(...(await modelFiles()));
      return { name: "setup", files, network: { kind: "allowlist", domains: ["registry.npmjs.org"] }, cmd: "bash", args: ["setup.sh"] };
    }
    if (i === 1) return { name: "render", network: { kind: "none" }, cmd: "bash", args: ["render.sh", input.res] };
    const host = storageHost();
    return { name: "upload", network: host ? { kind: "allowlist", domains: [host] } : { kind: "none" }, cmd: "bash", args: ["upload.sh", await signedPutUrl(input.outputKey, "video/mp4", LINK_S)], secretArgs: true };
  },
  collect: async (ctx, input) => {
    const probe = await ctx.provider.readFile(ctx.name, "probe.json", 64_000).catch(() => null);
    let duration: number | null = null, width: number | null = null, height: number | null = null;
    try {
      const j = JSON.parse(probe?.toString("utf8") ?? "{}") as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number }[] };
      duration = Number(j.format?.duration) || null;
      const v = j.streams?.find((s) => s.codec_type === "video"); width = v?.width ?? null; height = v?.height ?? null;
    } catch { /* facts only */ }
    const stored = await headObjectInfo(input.outputKey);
    if (!stored?.size) return { output: {}, failed: "The guide video was not saved." };
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a), g = width && height ? gcd(width, height) : 0;
    const row = await db.generation.create({
      data: { userId: ctx.job.userId, projectId: input.projectId, prompt: "ShotMap guide", status: "completed", kind: "video", imageUrl: "", storageKey: input.outputKey, contentType: "video/mp4", sizeBytes: stored.size, durationSec: duration ? Math.round(duration * 10) / 10 : null, hasAudio: false, aspectRatio: g ? `${width! / g}:${height! / g}` : null, width, height, params: { shotGuide: true, shotGuideJob: ctx.job.id }, finishedAt: new Date() },
    });
    return { output: { generationId: row.id, key: input.outputKey, sizeBytes: stored.size, durationSec: duration, width, height } };
  },
  failMessage: "The guide video could not be made.",
  present: async (output) => {
    const key = typeof output.key === "string" ? output.key : null;
    return { ...output, key: undefined, url: key ? await signedMediaUrl(key, { ttlSeconds: 3600, contentType: "video/mp4" }) : null };
  },
};
