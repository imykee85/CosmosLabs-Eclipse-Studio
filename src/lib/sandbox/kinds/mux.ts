import { z } from "zod";
import { db } from "@/lib/db";
import { variantsOf } from "@/lib/audio/jobs";
import { headObjectInfo, signedGetUrl, signedMediaUrl, signedPutUrl, storageHost } from "@/lib/storage";
import { JobInputError, type KindDef } from "./types";

// media.mux: puts a Mirelo "sound for video" take into the video it was made for, with ffmpeg in a sandbox. The sandbox may reach only the
// storage host: it fetches both files and uploads the result itself through signed links (passed as arguments, never as environment, never
// logged, valid 30 minutes), so no large file passes through one of our functions. The video picture is copied as is; only the sound is
// encoded (AAC 192k). "replace" swaps the sound; "mix" lays it over the clip's own sound and falls back to replace when the clip has none.

const LINK_S = 30 * 60;

export const MUX_SH = String.raw`#!/bin/bash
set -euo pipefail
VIDEO_URL="$1"; AUDIO_URL="$2"; OUTPUT_URL="$3"; MODE="$4"; VOL="$5""dB"
curl -fsSL --max-time 300 "$VIDEO_URL" -o in.mp4
curl -fsSL --max-time 300 "$AUDIO_URL" -o in.audio
if [ "$MODE" = "mix" ] && [ -z "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 in.mp4)" ]; then
  MODE=replace; echo "the video has no sound of its own: replacing instead of mixing"
fi
if [ "$MODE" = "mix" ]; then
  ffmpeg -nostdin -hide_banner -y -i in.mp4 -i in.audio -filter_complex "[1:a]volume=$VOL[n];[0:a][n]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart out.mp4
else
  ffmpeg -nostdin -hide_banner -y -i in.mp4 -i in.audio -map 0:v:0 -map 1:a:0 -af "volume=$VOL" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out.mp4
fi
ffprobe -v error -show_entries format=duration -of json out.mp4 > probe.json
curl -fsS --max-time 300 -X PUT -H "Content-Type: video/mp4" --upload-file out.mp4 "$OUTPUT_URL" -o /dev/null
printf '{"mode":"%s"}' "$MODE" > result.json
`;

export const MuxInput = z.object({
  videoKey: z.string().min(1).max(300),
  audioKey: z.string().min(1).max(300),
  outputKey: z.string().min(1).max(300),
  mode: z.enum(["replace", "mix"]),
  audioGainDb: z.number().min(-20).max(6),
  audioJobId: z.string().max(60),
  variant: z.number().int().min(1).max(4),
  videoId: z.string().max(60),
}).strict();
export type MuxInput = z.infer<typeof MuxInput>;

const MuxRequest = z.object({ audioJobId: z.string().min(1).max(60), variant: z.number().int().min(1).max(4).default(1), mode: z.enum(["replace", "mix"]).default("replace"), audioGainDb: z.number().min(-20).max(6).default(0) });

/** Builds the job input from what the browser sent (ids only), checking that the take and its video are the person's own and finished. */
export async function muxInputFor(userId: string, jobId: string, body: unknown): Promise<MuxInput> {
  const req = MuxRequest.safeParse(body);
  if (!req.success) throw new JobInputError("That request is not valid.");
  const take = await db.audioJob.findFirst({ where: { id: req.data.audioJobId, userId, status: "completed" } });
  if (!take || take.kind !== "vsfx") throw new JobInputError("That sound take was not found.");
  const variants = variantsOf(take);
  const audioKey = variants[req.data.variant - 1]?.key ?? (req.data.variant === 1 ? take.storageKey : null);
  if (!audioKey) throw new JobInputError("That variant was not found.");
  const videoId = String(((take.params ?? {}) as Record<string, unknown>).videoId ?? "");
  const video = await db.generation.findFirst({ where: { id: videoId, userId, kind: "video", status: "completed", deletedAt: null, storageKey: { not: null } }, select: { id: true, storageKey: true } });
  if (!video?.storageKey) throw new JobInputError("The video this sound was made for is no longer in your Library.");
  return { videoKey: video.storageKey, audioKey, outputKey: `u/${userId}/mux/${jobId}.mp4`, mode: req.data.mode, audioGainDb: req.data.audioGainDb, audioJobId: take.id, variant: req.data.variant, videoId: video.id };
}

export { muxEnabled } from "../flags";
const credits = () => (Number(process.env.SANDBOX_CREDITS_MUX) >= 0 && process.env.SANDBOX_CREDITS_MUX ? Math.floor(Number(process.env.SANDBOX_CREDITS_MUX)) : 5);

export const mux: KindDef<MuxInput> = {
  kind: "media.mux",
  schema: MuxInput,
  vcpus: 2,
  deadlineMs: 10 * 60_000,
  network: () => { const h = storageHost(); return h ? { kind: "allowlist", domains: [h] } : { kind: "none" }; },
  base: "snapshot",
  price: () => credits(),
  stageCount: () => 1,
  stage: async (_ctx, _i, input) => ({
    name: "mux",
    files: [{ path: "mux.sh", content: Buffer.from(MUX_SH), mode: 0o755 }],
    cmd: "bash",
    args: ["mux.sh", await signedGetUrl(input.videoKey, LINK_S), await signedGetUrl(input.audioKey, LINK_S), await signedPutUrl(input.outputKey, "video/mp4", LINK_S), input.mode, String(input.audioGainDb)],
    secretArgs: true,
  }),
  collect: async (ctx, input) => {
    const probe = await ctx.provider.readFile(ctx.name, "probe.json", 64_000).catch(() => null);
    const result = await ctx.provider.readFile(ctx.name, "result.json", 4_000).catch(() => null);
    let durationSec: number | null = null, mode = input.mode;
    try { durationSec = Number(JSON.parse(probe?.toString("utf8") ?? "{}")?.format?.duration) || null; } catch { /* the duration is only shown */ }
    try { mode = JSON.parse(result?.toString("utf8") ?? "{}")?.mode === "mix" ? "mix" : "replace"; } catch { /* keep the asked mode */ }
    const stored = await headObjectInfo(input.outputKey);
    if (!stored?.size) return { output: {}, failed: "The video with sound was not saved. Nothing was charged." };
    return { output: { key: input.outputKey, sizeBytes: stored.size, durationSec, mode, audioJobId: input.audioJobId, variant: input.variant } };
  },
  failMessage: "The sound could not be added to the video. Nothing was charged.",
  present: async (output) => {
    const key = typeof output.key === "string" ? output.key : null;
    return { ...output, key: undefined, url: key ? await signedMediaUrl(key, { ttlSeconds: 3600, download: "video-with-sound.mp4", contentType: "video/mp4" }) : null };
  },
};
