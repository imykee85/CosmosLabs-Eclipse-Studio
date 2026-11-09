import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { downloadObjectToFile, signedGetUrl, storageEnabled } from "@/lib/storage";
import { frameAt, probeVideo, readFrames, run, spacedTimes } from "@/lib/video-frames";
import { storeUpload } from "@/lib/uploads";
import { claimUsage } from "@/lib/usage";
import { accessFor } from "@/lib/access";

// Atlas's eyes for video (Atlas only; custom agents are not given these tools). The model cannot take a video file, so a clip is watched as a set of still
// frames spread across it, each labelled with its time. It sees no sound. Everything is owner-checked: the model names a clip by id, and only the signed-in
// person's own finished videos are ever opened.
export const VIDEO_TOOL_NAMES = ["list_videos", "watch_video", "capture_frame"] as const;
const isVideoTool = (n: string) => (VIDEO_TOOL_NAMES as readonly string[]).includes(n);
export const isServerTool = isVideoTool;

export const VIDEO_TOOLS: Anthropic.Tool[] = [
  { name: "list_videos", description: "List the user's most recent finished videos (id, prompt, length). Use it when they refer to a video without it being attached to the box.", input_schema: { type: "object", properties: {} } },
  { name: "watch_video", description: "Watch a whole video: returns evenly spaced still frames from the start to the end, each labelled with its time in seconds. You see no sound. Use from_sec and to_sec to look closer at one stretch.", input_schema: { type: "object", properties: { clip_id: { type: "string" }, frames: { type: "integer", minimum: 4, maximum: 24, description: "How many frames (default 16)." }, from_sec: { type: "number" }, to_sec: { type: "number" } }, required: ["clip_id"] } },
  { name: "capture_frame", description: "Capture one full-quality frame at a moment in a video and save it to the user's Assets so it can be used as a start frame or an ingredient. You also get to see it. Capture only moments worth keeping.", input_schema: { type: "object", properties: { clip_id: { type: "string" }, time_sec: { type: "number" }, name: { type: "string", description: "A short name for the saved picture." } }, required: ["clip_id", "time_sec"] } },
];

export type Frame = { uploadId: string; label: string; sec: number };
export type ToolRun = { content: Anthropic.ToolResultBlockParam["content"]; frames?: Frame[]; isError?: boolean };

const WATCH_FRAME_WIDTH = 768;
const DEFAULT_FRAMES = 16;
const MAX_CAPTURES_PER_TURN = 6;
const PROXY_LIMIT_MS = 150_000;

const fail = (text: string): ToolRun => ({ content: text, isError: true });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const slug = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 48) || "video";

async function ownClip(userId: string, id: unknown) {
  if (typeof id !== "string" || !id || id.length > 64) return null;
  return db.generation.findFirst({ where: { id, userId, kind: "video", status: "completed", deletedAt: null, storageKey: { not: null } }, select: { id: true, storageKey: true, durationSec: true, prompt: true } });
}

// Runs one of Atlas's video tools. `state.captures` counts frames saved so far in this turn.
export async function runVideoTool(userId: string, name: string, input: Record<string, unknown>, state: { captures: number }): Promise<ToolRun> {
  if (name === "list_videos") {
    const rows = await db.generation.findMany({ where: { userId, kind: "video", status: "completed", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, prompt: true, durationSec: true, createdAt: true } });
    if (!rows.length) return { content: "The user has no finished videos yet." };
    return { content: rows.map((r) => `id ${r.id}: "${r.prompt.slice(0, 80)}"${r.durationSec ? `, ${Math.round(r.durationSec)} s` : ""}, made ${r.createdAt.toISOString().slice(0, 10)}`).join("\n") };
  }
  if (!storageEnabled) return fail("Video storage is not set up, so videos cannot be opened.");
  const clip = await ownClip(userId, input.clip_id);
  if (!clip?.storageKey) return fail("That video could not be found. Use list_videos to see the user's videos.");
  // Watching is costly (many pictures), so it has its own daily limit: AGENT_VIDEO_DAILY, 20 by default.
  const limit = Number(process.env.AGENT_VIDEO_DAILY) > 0 ? Math.floor(Number(process.env.AGENT_VIDEO_DAILY)) : 20;
  // Scale and the owner have no daily limit on watching videos (owner 2026-11-07); other plans keep the daily count.
  const unlimited = (await accessFor(userId, userId)).plan === "scale";
  if (name === "watch_video" && !unlimited && !(await claimUsage(userId, "agent-video", limit, 24 * 3600 * 1000))) return fail(`The daily limit of ${limit} video watches is used up. It resets on a rolling 24 hours.`);
  if (name === "capture_frame" && state.captures >= MAX_CAPTURES_PER_TURN) return fail(`At most ${MAX_CAPTURES_PER_TURN} frames can be captured in one reply.`);

  const dir = await mkdtemp(join(tmpdir(), "eclipse-vid-"));
  try {
    // ffmpeg reads the clip straight from storage through a short-lived link (range requests), so even a 500 MB video is not copied here. If that does not
    // work in this environment, a copy of up to 300 MB is made in the temp folder instead.
    let file = await signedGetUrl(clip.storageKey, 900);
    let info = await probeVideo(file);
    // Compatibility copy: whatever the phone or camera made (MOV, HEVC 10-bit, 4K, MP4 with the index at the end...) is re-encoded to H.264 MP4 and read
    // from that. A phone-length 4K clip takes about 40 s to re-encode on a fast machine, so the limit is well above that.
    let proxied = false;
    const storageKey = clip.storageKey;
    const makeProxy = async (): Promise<boolean> => {
      if (proxied) return false;
      proxied = true;
      const source = join(dir, "source.bin");
      try { await downloadObjectToFile(storageKey, source); } catch { return false; }
      file = join(dir, "clip.mp4");
      const made = await run(["-y", "-i", source, "-vf", "scale='min(960,iw)':-2", "-map", "0:V:0", "-an", "-sn", "-dn", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], PROXY_LIMIT_MS).catch(() => null);
      return made?.code === 0;
    };
    if (!info && await makeProxy()) info = await probeVideo(file);
    const duration = info?.duration ?? clip.durationSec ?? null;
    if (!duration || duration <= 0) return fail("The video file could not be read.");

    if (name === "watch_video") {
      const from = Math.min(Math.max(num(input.from_sec) ?? 0, 0), duration);
      const to = Math.min(Math.max(num(input.to_sec) ?? duration, from), duration);
      const count = Math.min(24, Math.max(4, Math.floor(num(input.frames) ?? DEFAULT_FRAMES)));
      const times = spacedTimes(from, to === from ? Math.min(duration, from + 0.5) : to, count);
      // Quick jumps for videos with frequent keyframes, one pass through the file for phone-edited videos (see readFrames).
      let good = await readFrames(file, times, WATCH_FRAME_WIDTH);
      // The file opened but no picture could be read from it: try the H.264 copy once before giving up.
      if (!good.length && await makeProxy()) good = await readFrames(file, times, WATCH_FRAME_WIDTH);
      if (!good.length) return fail("No frames could be read from this video.");
      const content: Anthropic.ToolResultBlockParam["content"] = [{ type: "text", text: `Video of ${duration.toFixed(1)} s. ${good.length} frames from ${from.toFixed(1)} s to ${to.toFixed(1)} s follow, each labelled with its time. There is no sound.` }];
      for (const s of good) {
        content.push({ type: "text", text: `${s.t.toFixed(2)} s` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: s.b.toString("base64") } });
      }
      return { content };
    }

    // capture_frame
    const sec = Math.min(Math.max(num(input.time_sec) ?? 0, 0), Math.max(0, duration - 0.05));
    // One frame can mean decoding from far back when keyframes are sparse (phone-edited videos), so it may take longer than a normal jump.
    let jpeg = await frameAt(file, sec, 1920, 2, 120_000).catch(async () => (await makeProxy()) ? frameAt(file, sec, 1920, 2, 120_000) : Promise.reject(new Error("no frame")));
    if (jpeg.byteLength > 3.9 * 1024 * 1024) jpeg = await frameAt(file, sec, 1280, 5, 120_000);
    const stored = await storeUpload(userId, new Uint8Array(jpeg));
    if ("error" in stored) return fail(stored.error);
    const label = (typeof input.name === "string" && input.name.trim() ? slug(input.name) : `Frame at ${sec.toFixed(1)} s - ${slug(clip.prompt)}`).slice(0, 80);
    const row = await db.upload.create({ data: { userId, kind: "asset", name: label, projectId: null, storageKey: stored.key, contentType: stored.contentType, sizeBytes: stored.sizeBytes, width: stored.width, height: stored.height } });
    state.captures += 1;
    return {
      content: [
        { type: "text", text: `Saved to the user's Assets as "${label}" (${sec.toFixed(2)} s). This is the frame:` },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
      ],
      frames: [{ uploadId: row.id, label, sec }],
    };
  } catch (err) {
    console.error("agent video tool failed", name, err);
    return fail("Something went wrong while reading the video. Try again.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// A video someone attached to a chat, read the way Atlas watches a clip: evenly spaced frames, each labelled with its time. Returns the
// blocks to put in front of the message, or a plain reason it could not be read. Owner-checked (only the person's own finished clips).
export async function clipBlocks(userId: string, clipId: string): Promise<{ ok: true; blocks: Anthropic.ContentBlockParam[] } | { ok: false; error: string }> {
  const run = await runVideoTool(userId, "watch_video", { clip_id: clipId, frames: 12 }, { captures: 0 });
  if (run.isError || typeof run.content === "string") return { ok: false, error: typeof run.content === "string" ? run.content : "The video could not be read." };
  return { ok: true, blocks: run.content as Anthropic.ContentBlockParam[] };
}
