import { z } from "zod";
import { db } from "@/lib/db";
import { headObjectInfo, signedGetUrl, signedMediaUrl, signedPutUrl, storageEnabled, storageHost } from "@/lib/storage";
import { kitFiles } from "../kit";
import { JobInputError, type KindDef } from "./types";

// media.edit: edits the person's OWN finished videos with ffmpeg-skill (MIT, kajisho5; core/skills/builtin/ffmpeg-skill) in a sandbox: cut, join, speed, reframe,
// remove pauses, captions, a title card, music with ducking, voice clean-up, loudness and platform exports. The browser or Core sends ids and plain numbers only; the
// server builds the project file itself from a fixed list of options (nothing from the request ever reaches a command line), the sandbox may reach only the storage host,
// fetches the clips through signed links and uploads the result itself. The result becomes a new finished video in the Library; the originals are never touched.

const LINK_S = 30 * 60;
export const PLATFORMS = ["reels", "tiktok", "shorts", "youtube", "youtube-shorts", "x", "linkedin", "facebook"] as const;
export const ASPECTS = ["9:16", "1:1", "4:5", "3:4", "16:9", "4:3"] as const;
export const TRANSITIONS = ["fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright", "fadeblack"] as const;
const num = (lo: number, hi: number) => z.number().finite().min(lo).max(hi);

export const EditRequest = z.object({
  clips: z.array(z.object({ videoId: z.string().min(1).max(60), start: num(0, 36000).optional(), end: num(0, 36000).optional(), speed: num(0.25, 4).optional() }).strict()).min(1).max(8),
  aspect: z.enum(ASPECTS).optional(),
  fit: z.enum(["crop", "pad", "blur"]).optional(),
  transition: z.object({ type: z.enum(TRANSITIONS), seconds: num(0.2, 2) }).strict().optional(),
  removeSilence: z.boolean().optional(),
  captions: z.object({ cues: z.array(z.object({ start: num(0, 36000), end: num(0, 36000), text: z.string().min(1).max(200) }).strict()).min(1).max(80), animate: z.enum(["pop", "none"]).optional(), position: z.enum(["top", "center", "bottom"]).optional() }).strict().optional(),
  title: z.object({ text: z.string().min(1).max(80), subtitle: z.string().max(120).optional(), seconds: num(1, 6) }).strict().optional(),
  musicTakeId: z.string().min(1).max(60).optional(),
  musicVolume: num(-30, -6).optional(),
  duck: z.boolean().optional(),
  cleanVoice: z.enum(["light", "medium", "strong"]).optional(),
  loudness: num(-23, -9).optional(),
  platform: z.enum(PLATFORMS).optional(),
  projectId: z.string().max(64).optional(),
}).strict().superRefine((v, ctx) => {
  v.clips.forEach((c, i) => { if (c.start != null && c.end != null && c.end <= c.start) ctx.addIssue({ code: "custom", message: `Clip ${i + 1}: the end must come after the start.` }); });
  v.captions?.cues.forEach((c, i) => { if (c.end <= c.start) ctx.addIssue({ code: "custom", message: `Caption ${i + 1}: the end must come after the start.` }); });
});
export type EditRequest = z.infer<typeof EditRequest>;

export const EditInput = z.object({ req: EditRequest, clipKeys: z.array(z.string().min(1).max(300)).min(1).max(8), musicKey: z.string().max(300).optional(), outputKey: z.string().min(1).max(300), projectId: z.string().max(64).nullable() }).strict();
export type EditInput = z.infer<typeof EditInput>;

/** The project file ffmpeg-skill renders. Built here from validated numbers and a fixed list of options only; file names inside are fixed (clip0.mp4, music.audio). */
export function buildProject(req: EditRequest): { project: Record<string, unknown>; cues: string | null } {
  const project: Record<string, unknown> = {
    output: "out.mp4",
    clips: req.clips.map((c, i) => ({ src: `clip${i}.mp4`, ...(c.start != null ? { in: c.start } : {}), ...(c.end != null ? { out: c.end } : {}), ...(c.speed != null && c.speed !== 1 ? { speed: c.speed } : {}) })),
  };
  if (req.aspect && !req.platform) project.frame = { aspect: req.aspect, fit: req.fit ?? "blur" };
  if (req.transition && req.clips.length > 1) project.transition = { type: req.transition.type, duration: req.transition.seconds };
  if (req.removeSilence) project.silence = { threshold: -38, min_silence: 0.8 };
  let cues: string | null = null;
  if (req.captions) {
    const t = (n: number) => n.toFixed(2);
    cues = req.captions.cues.map((c) => `${t(c.start)}-${t(c.end)} ${c.text.replace(/[\r\n]+/g, " | ").trim()}`).join("\n") + "\n";
    project.captions = { text: "cues.txt", animate: req.captions.animate ?? "none", position: req.captions.position ?? "bottom" };
  }
  if (req.title) project.graphics = [{ template: "title", title: req.title.text, ...(req.title.subtitle ? { subtitle: req.title.subtitle } : {}), start: 0, end: req.title.seconds }];
  const audio: Record<string, unknown> = {};
  if (req.cleanVoice) audio.voice = req.cleanVoice;
  if (req.musicTakeId) Object.assign(audio, { music: "music.audio", music_volume: req.musicVolume ?? -16, duck: req.duck ?? true, music_fade_out: 2 });
  if (Object.keys(audio).length) project.audio = audio;
  if (req.loudness != null) project.loudness = { lufs: req.loudness, tp: -1 };
  if (req.platform) project.export = { preset: req.platform, normalize: true };
  return { project, cues };
}

// Runs inside the sandbox. $1 = result upload link, then the clip links, then the music link ("-" when none). The programs are the vendored ffmpeg-skill.
export const EDIT_SH = String.raw`#!/bin/bash
set -euo pipefail
OUTPUT_URL="$1"; MUSIC_URL="$2"; shift 2
i=0
for url in "$@"; do curl -fsSL --max-time 300 "$url" -o "clip$i.mp4"; i=$((i+1)); done
if [ "$MUSIC_URL" != "-" ]; then curl -fsSL --max-time 300 "$MUSIC_URL" -o music.audio; fi
python3 ffskill/scripts/render.py project.json --json-brief --overwrite > render.json 2> render.err || { tail -c 1500 render.err >&2; tail -c 1500 render.json >&2; exit 1; }
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of json out.mp4 > probe.json
curl -fsS --max-time 300 -X PUT -H "Content-Type: video/mp4" --upload-file out.mp4 "$OUTPUT_URL" -o /dev/null
`;

export const editEnabled = () => Boolean(process.env.SANDBOX_PROVIDER) && storageEnabled;
const credits = () => (Number(process.env.SANDBOX_CREDITS_EDIT) >= 0 && process.env.SANDBOX_CREDITS_EDIT ? Math.floor(Number(process.env.SANDBOX_CREDITS_EDIT)) : 5);

/** Builds the job input from what Core or the browser sent, checking that every clip and the music are the person's own and finished. */
export async function editInputFor(userId: string, jobId: string, body: unknown): Promise<EditInput> {
  const parsed = EditRequest.safeParse(body);
  if (!parsed.success) throw new JobInputError(parsed.error.issues[0]?.message?.slice(0, 160) || "That edit is not valid.");
  const req = parsed.data;
  const ids = [...new Set(req.clips.map((c) => c.videoId))];
  const videos = await db.generation.findMany({ where: { id: { in: ids }, userId, kind: "video", status: "completed", deletedAt: null, storageKey: { not: null } }, select: { id: true, storageKey: true } });
  const keyOf = new Map(videos.map((v) => [v.id, v.storageKey as string]));
  const clipKeys = req.clips.map((c) => keyOf.get(c.videoId));
  if (clipKeys.some((k) => !k)) throw new JobInputError("One of those videos was not found in your Library. Pick finished videos of your own.");
  let musicKey: string | undefined;
  if (req.musicTakeId) {
    const take = await db.audioJob.findFirst({ where: { id: req.musicTakeId, userId, status: "completed", deletedAt: null, storageKey: { not: null } }, select: { storageKey: true } });
    if (!take?.storageKey) throw new JobInputError("That music take was not found. Pick a finished take of your own.");
    musicKey = take.storageKey;
  }
  if (req.projectId && !(await db.project.findFirst({ where: { id: req.projectId, userId, deletedAt: null }, select: { id: true } }))) throw new JobInputError("That project was not found.");
  return { req, clipKeys: clipKeys as string[], ...(musicKey ? { musicKey } : {}), outputKey: `u/${userId}/edit/${jobId}.mp4`, projectId: req.projectId ?? null };
}

export const edit: KindDef<EditInput> = {
  kind: "media.edit",
  schema: EditInput,
  vcpus: 2,
  deadlineMs: 12 * 60_000,
  network: () => { const h = storageHost(); return h ? { kind: "allowlist", domains: [h] } : { kind: "none" }; },
  base: "snapshot",
  price: () => credits(),
  stageCount: () => 1,
  stage: async (_ctx, _i, input) => {
    const { project, cues } = buildProject(input.req);
    const files = [
      ...kitFiles("ffmpeg-skill", "ffskill", (r) => r.startsWith("scripts/") || r.startsWith("templates/")),
      { path: "edit.sh", content: Buffer.from(EDIT_SH), mode: 0o755 },
      { path: "project.json", content: Buffer.from(JSON.stringify(project)) },
      ...(cues ? [{ path: "cues.txt", content: Buffer.from(cues) }] : []),
    ];
    const clipUrls = await Promise.all(input.clipKeys.map((k) => signedGetUrl(k, LINK_S)));
    return {
      name: "edit", files, cmd: "bash",
      args: ["edit.sh", await signedPutUrl(input.outputKey, "video/mp4", LINK_S), input.musicKey ? await signedGetUrl(input.musicKey, LINK_S) : "-", ...clipUrls],
      secretArgs: true,
    };
  },
  collect: async (ctx, input) => {
    const probe = await ctx.provider.readFile(ctx.name, "probe.json", 64_000).catch(() => null);
    let duration: number | null = null, width: number | null = null, height: number | null = null, hasAudio = false;
    try {
      const j = JSON.parse(probe?.toString("utf8") ?? "{}") as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number }[] };
      duration = Number(j.format?.duration) || null;
      const v = j.streams?.find((s) => s.codec_type === "video");
      width = v?.width ?? null; height = v?.height ?? null; hasAudio = !!j.streams?.some((s) => s.codec_type === "audio");
    } catch { /* the facts are only shown */ }
    const stored = await headObjectInfo(input.outputKey);
    if (!stored?.size) return { output: {}, failed: "The edited video was not saved. Nothing was charged." };
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const g = width && height ? gcd(width, height) : 0;
    const row = await db.generation.create({
      data: { userId: ctx.job.userId, projectId: input.projectId, prompt: "Edited video", status: "completed", kind: "video", imageUrl: "", storageKey: input.outputKey, contentType: "video/mp4", sizeBytes: stored.size, durationSec: duration ? Math.round(duration * 10) / 10 : null, hasAudio, aspectRatio: g ? `${width! / g}:${height! / g}` : null, width, height, params: { edited: true, editJob: ctx.job.id }, finishedAt: new Date() },
    });
    return { output: { generationId: row.id, key: input.outputKey, sizeBytes: stored.size, durationSec: duration, width, height } };
  },
  failMessage: "The video could not be edited. Nothing was charged.",
  present: async (output) => {
    const key = typeof output.key === "string" ? output.key : null;
    return { ...output, key: undefined, url: key ? await signedMediaUrl(key, { ttlSeconds: 3600, download: "edited-video.mp4", contentType: "video/mp4" }) : null };
  },
};
