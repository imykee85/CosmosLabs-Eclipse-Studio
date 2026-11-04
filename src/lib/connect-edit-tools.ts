import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { editEnabled, editInputFor, ASPECTS, PLATFORMS, TRANSITIONS } from "@/lib/sandbox/kinds/edit";
import { JobInputError } from "@/lib/sandbox/kinds/types";
import { jobView } from "@/lib/sandbox/view";

// Core's video editor: two tools. edit_video starts an edit of the person's OWN finished videos (ffmpeg-skill in a cloud computer, see kinds/edit.ts) and
// check_edit reports it. The edited video appears in the Library as a new video; the originals are never changed.
export const editToolNames = new Set(["edit_video", "check_edit"]);

export const editDefs: Anthropic.Beta.Messages.BetaTool[] = [
  {
    name: "edit_video",
    description: "Edit the user's own finished videos (find ids with search_library: kind video): cut a part (start/end seconds), join up to 8 clips (with an optional transition), change speed (0.25 to 4), make it vertical/square/landscape (aspect_ratio with fit crop, pad or blur), remove pauses, burn in captions (you write the cue text and times; never invent what was said), add a title card, put one of their finished music takes under it with ducking (music_take_id), clean up the voice, set loudness, or export for a platform (reels, tiktok, shorts, youtube, youtube-shorts, x, linkedin, facebook). The result is a NEW video in their Library. Costs a few credits; say what you are about to do first and wait for their go-ahead when it is more than a simple cut. It runs for 1 to 5 minutes: tell the user, then use check_edit.",
    input_schema: {
      type: "object",
      properties: {
        clips: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", properties: { video_id: { type: "string" }, start: { type: "number", description: "Seconds into the clip to start from." }, end: { type: "number", description: "Seconds into the clip to stop at." }, speed: { type: "number", description: "0.25 to 4, 1 is normal." } }, required: ["video_id"] }, description: "The clips in order." },
        aspect_ratio: { type: "string", enum: [...ASPECTS], description: "Ignored when platform is set (the platform decides the frame)." },
        fit: { type: "string", enum: ["crop", "pad", "blur"], description: "How to fill a new aspect ratio: crop the sides, add bars, or a blurred copy (default blur)." },
        transition: { type: "object", properties: { type: { type: "string", enum: [...TRANSITIONS] }, seconds: { type: "number" } }, required: ["type", "seconds"] },
        remove_silence: { type: "boolean" },
        captions: { type: "array", maxItems: 80, items: { type: "object", properties: { start: { type: "number" }, end: { type: "number" }, text: { type: "string" } }, required: ["start", "end", "text"] }, description: "Cue text with start and end seconds on the FINAL video's timeline." },
        caption_animation: { type: "string", enum: ["pop", "none"] },
        caption_position: { type: "string", enum: ["top", "center", "bottom"] },
        title: { type: "object", properties: { text: { type: "string" }, subtitle: { type: "string" }, seconds: { type: "number" } }, required: ["text", "seconds"] },
        music_take_id: { type: "string", description: "A finished music take of the user's (the Audio Studio)." },
        music_volume_db: { type: "number", description: "-30 to -6, default -16." },
        duck: { type: "boolean", description: "Lower the music while someone speaks (default true)." },
        clean_voice: { type: "string", enum: ["light", "medium", "strong"] },
        loudness_lufs: { type: "number", description: "-23 to -9, for example -14 for social." },
        platform: { type: "string", enum: [...PLATFORMS] },
        project_id: { type: "string" },
      },
      required: ["clips"],
    },
  },
  {
    name: "check_edit",
    description: "Look up an edit started with edit_video: its status (queued, running, succeeded, failed, canceled) and, when it succeeded, the new video's id (generation_id).",
    input_schema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] },
  },
];

const n = (v: unknown) => (typeof v === "number" ? v : undefined);
const s = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);
const drop = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Core's snake_case arguments become the edit request (the server checks every value again). */
export function editBodyFromArgs(a: Record<string, unknown>): Record<string, unknown> {
  const clips = Array.isArray(a.clips) ? a.clips.slice(0, 8).map((c) => { const o = (c ?? {}) as Record<string, unknown>; return drop({ videoId: s(o.video_id, 60) ?? "", start: n(o.start), end: n(o.end), speed: n(o.speed) }); }) : [];
  const tr = a.transition && typeof a.transition === "object" ? (a.transition as Record<string, unknown>) : null;
  const ti = a.title && typeof a.title === "object" ? (a.title as Record<string, unknown>) : null;
  return drop({
    clips, aspect: s(a.aspect_ratio, 8), fit: s(a.fit, 8), transition: tr ? { type: s(tr.type, 20), seconds: n(tr.seconds) } : undefined, removeSilence: a.remove_silence === true ? true : undefined,
    captions: Array.isArray(a.captions) && a.captions.length ? drop({ cues: a.captions.slice(0, 80).map((c) => { const o = (c ?? {}) as Record<string, unknown>; return { start: n(o.start), end: n(o.end), text: s(o.text, 200) }; }), animate: s(a.caption_animation, 8), position: s(a.caption_position, 8) }) : undefined,
    title: ti ? drop({ text: s(ti.text, 80), subtitle: s(ti.subtitle, 120), seconds: n(ti.seconds) }) : undefined,
    musicTakeId: s(a.music_take_id, 60), musicVolume: n(a.music_volume_db), duck: typeof a.duck === "boolean" ? a.duck : undefined, cleanVoice: s(a.clean_voice, 8), loudness: n(a.loudness_lufs), platform: s(a.platform, 16), projectId: s(a.project_id, 64),
  });
}

export async function runEditTool(name: string, a: Record<string, unknown>, userId: string, openProject: string | null): Promise<{ text: string; isError?: boolean }> {
  if (name === "check_edit") {
    const job = await db.sandboxJob.findFirst({ where: { id: s(a.job_id, 60) ?? "", userId, kind: "media.edit" } });
    if (!job) return { text: "No edit with that id.", isError: true };
    const v = await jobView(job);
    return { text: JSON.stringify({ job_id: v.id, status: v.status, message: v.message, ...(v.status === "succeeded" ? { generation_id: v.output?.generationId, seconds: v.output?.durationSec, note: "The edited video is in the user's Library." } : {}), ...(v.error ? { problem: v.error.message } : {}) }) };
  }
  if (!editEnabled()) return { text: "Editing videos is not available yet.", isError: true };
  const id = `sbx${randomUUID().replace(/-/g, "").slice(0, 21)}`;
  let input;
  try { input = await editInputFor(userId, id, { ...editBodyFromArgs(a), ...(a.project_id ? {} : openProject ? { projectId: openProject } : {}) }); }
  catch (err) { if (err instanceof JobInputError) return { text: err.message, isError: true }; throw err; }
  const q = await enqueue("media.edit", userId, input, { id });
  if (!q.ok) return { text: q.error, isError: true };
  waitUntil(drive(q.job.id, 45_000).catch((e) => console.error("sandbox drive failed", q.job.id, e)));
  return { text: JSON.stringify({ job_id: q.job.id, status: "queued", note: "Editing now, usually 1 to 5 minutes. Use check_edit with this job_id; the new video lands in the user's Library." }) };
}
