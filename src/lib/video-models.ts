// The video models Video Studio offers. Models marked `live` generate for real through Higgsfield (their endpoints, fields, ranges and rules are copied from the
// Higgsfield API pages, read 2026-10-12, see docs/video-brief-notes.md); the others are listed with the settings the catalog gives, greyed out and tagged Soon, until their
// request page is wired. The UI renders its controls from this registry only, and `buildVideoBody` is the one place a request body is made: it sends only the fields
// the model lists (several endpoints reject unknown fields), applies defaults, clamps nothing silently (a bad value is an error) and never switches to another model.
// Shared by the browser (controls, price estimate) and the server (validation, request body, price).

export type Workflow = "t2v" | "i2v" | "ref"; // text, start frame(s), or reference pictures

export type VideoLive = {
  endpoints: Partial<Record<Workflow, string>>;
  refs?: { max: number; videos?: { max: number } }; // reference pictures, and reference clips (the user's own finished videos)                           // reference pictures (reference-to-video); needs endpoints.ref     // path after the API base address
  promptMax: number;                                // longer prompts are refused here (some endpoints truncate silently)
  promptRequired: Record<"t2v" | "i2v", boolean> & { ref?: boolean };
  durations: Record<"t2v" | "i2v", { min: number; max: number; values?: number[] }> & { ref?: { min: number; max: number; values?: number[] } };  // `values` = only these lengths (e.g. 5 or 10)
  durationDefault: number;
  resolution?: { values: string[]; default: string };
  aspect?: { values: string[]; default: string };   // text-to-video only; with a start frame the shape follows the picture
  audio?: { field: "generate_audio" | "sound"; kind: "bool" | "onoff"; default: boolean };
  seed?: { min: number; max: number };
  negativePrompt?: { max: number };
  cfgScale?: boolean;
  endFrameField?: string;                           // name of the last-frame field on the image-to-video endpoint; absent = no end frame
  // PROVISIONAL credit price (the video docs publish no prices): credits per second by resolution ("default" when there is no resolution field),
  // multiplied by audioFactor when sound is on. Deliberately high until real costs are measured (docs/video-pricing.md).
  price: { perSecond: Record<string, number>; audioFactor?: number };
  timeoutMinutes: number;                           // give up and release the held price after this long without a result
  note?: string;
};

export type VideoModel = {
  id: string;                  // Eclipse's id, stored on every render
  label: string;
  maker: string;
  blurb: string;
  ratios: string[];            // "auto" lets the model pick
  durations: number[];         // allowed lengths in seconds (text-to-video)
  qualities: string[];         // resolution or mode names; empty = one fixed quality
  sound: "toggle" | "none";    // can sound be switched on or off
  startFrame: boolean;
  endFrame: boolean;
  refImages: number;           // reference pictures (0 = none); not connected yet for any model
  live?: VideoLive;            // present = connected to Higgsfield and generating
};

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const R3 = ["16:9", "9:16", "1:1"];
const RWIDE = ["auto", "16:9", "9:16", "4:3", "3:4", "1:1", "21:9"];
const SLOW = 20; // minutes

// --- Connected models (Phase 1) ---------------------------------------------------------------------------------------------------------------------------------
const kling3 = (tier: "std" | "pro" | "4k"): VideoLive => ({
  endpoints: { t2v: `kling-video/v3.0/${tier}/text-to-video`, i2v: `kling-video/v3.0/${tier}/image-to-video` },
  promptMax: 2500,
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 3, max: 15 }, i2v: { min: 3, max: 15 } },
  durationDefault: 5,
  aspect: { values: R3, default: "16:9" },
  audio: { field: "sound", kind: "onoff", default: true },
  cfgScale: true,
  endFrameField: "last_image_url",
  price: { perSecond: { default: tier === "4k" ? 40 : tier === "pro" ? 22 : 14 }, audioFactor: 1.5 },
  timeoutMinutes: SLOW,
});

// Kling 3.0 Turbo: no sound, cfg or end frame; resolution 720p or 1080p (the path is the tier, `v3.0-turbo`). Text prompt up to 3,072 characters, image prompt 2,500.
const kling3Turbo: VideoLive = {
  endpoints: { t2v: "kling-video/v3.0-turbo/text-to-video", i2v: "kling-video/v3.0-turbo/image-to-video" },
  promptMax: 2500,
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 3, max: 15 }, i2v: { min: 3, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "720p" },
  aspect: { values: R3, default: "16:9" },
  price: { perSecond: { "720p": 10, "1080p": 18 } },
  timeoutMinutes: SLOW,
};

// Kling 2.6 Pro: 5 or 10 s, sound, cfg; the image endpoint also lists an aspect ratio, which is not sent (the shape follows the picture).
const kling26: VideoLive = {
  endpoints: { t2v: "kling-video/v2.6/pro/text-to-video", i2v: "kling-video/v2.6/pro/image-to-video" },
  promptMax: 2500,
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 5, max: 10, values: [5, 10] }, i2v: { min: 5, max: 10, values: [5, 10] } },
  durationDefault: 5,
  aspect: { values: R3, default: "16:9" },
  audio: { field: "sound", kind: "onoff", default: true },
  cfgScale: true,
  price: { perSecond: { default: 22 }, audioFactor: 1.5 },
  timeoutMinutes: SLOW,
};

// Kling 2.5 Turbo (Pro: text and image; Standard: image only, folder `standard`): 5 or 10 s, no sound, aspect or resolution; cfg and negative prompt.
const kling25t = (tier: "pro" | "standard"): VideoLive => ({
  endpoints: { ...(tier === "pro" ? { t2v: "kling-video/v2.5-turbo/pro/text-to-video" } : {}), i2v: `kling-video/v2.5-turbo/${tier}/image-to-video` },
  promptMax: 2500, // the pages state no limit; kept at the app-wide cap
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 5, max: 10, values: [5, 10] }, i2v: { min: 5, max: 10, values: [5, 10] } },
  durationDefault: 5,
  negativePrompt: { max: 2500 },
  cfgScale: true,
  price: { perSecond: { default: tier === "pro" ? 14 : 8 } },
  timeoutMinutes: SLOW,
});

const SEEDANCE_RES = ["480p", "720p", "1080p", "4k"];
const seedance2: VideoLive = {
  endpoints: { t2v: "bytedance/seedance-2.0/text-to-video", i2v: "bytedance/seedance-2.0/image-to-video", ref: "bytedance/seedance-2.0/reference-to-video" },
  refs: { max: 9, videos: { max: 3 } },
  promptMax: 5000, // the pages state no limit; kept at the app-wide cap
  promptRequired: { t2v: true, i2v: false, ref: false },
  durations: { t2v: { min: 4, max: 15 }, i2v: { min: 4, max: 15 }, ref: { min: 4, max: 15 } },
  durationDefault: 5,
  resolution: { values: SEEDANCE_RES, default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  endFrameField: "end_image_url",
  price: { perSecond: { "480p": 10, "720p": 20, "1080p": 40, "4k": 90 }, audioFactor: 1.25 },
  timeoutMinutes: SLOW,
  note: "4k can take twice as long.",
};

// Seedance 2.5 (text-to-video and image-to-video; the reference, edit and extend endpoints are not built yet, see docs/seedance-api.md). Longer clips (4 to 30 s),
// no 4k, no seed, negative prompt or cfg. `bitrate_mode` (default "high") and `output_format` (default "mp4", text-to-video only) are left to their defaults.
const seedance25: VideoLive = {
  endpoints: { t2v: "bytedance/seedance-2.5/text-to-video", i2v: "bytedance/seedance-2.5/image-to-video", ref: "bytedance/seedance-2.5/reference-to-video" },
  refs: { max: 30, videos: { max: 10 } },
  promptMax: 5000, // the pages state no limit; kept at the app-wide cap
  promptRequired: { t2v: true, i2v: false, ref: false },
  durations: { t2v: { min: 4, max: 30 }, i2v: { min: 4, max: 30 }, ref: { min: 4, max: 30 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  endFrameField: "end_image_url",
  price: { perSecond: { "480p": 10, "720p": 20, "1080p": 40 }, audioFactor: 1.25 },
  timeoutMinutes: SLOW,
  note: "Clips over 20 seconds can take twice as long.",
};

const happyHorse11: VideoLive = {
  endpoints: { t2v: "alibaba/happy-horse/v1.1/text-to-video", i2v: "alibaba/happy-horse/v1.1/image-to-video" },
  promptMax: 5000, // not stated on the page
  promptRequired: { t2v: true, i2v: false },
  durations: { t2v: { min: 3, max: 15 }, i2v: { min: 2, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "1080p" },
  aspect: { values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" },
  seed: { min: 1, max: 2147483646 },
  price: { perSecond: { "720p": 14, "1080p": 26 } },
  timeoutMinutes: SLOW,
};

const pixverse6: VideoLive = {
  endpoints: { t2v: "pixverse/v6/text-to-video", i2v: "pixverse/v6/image-to-video" },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: false },
  durations: { t2v: { min: 1, max: 15 }, i2v: { min: 1, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["360p", "540p", "720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  seed: { min: 0, max: 2147483647 },
  negativePrompt: { max: 2048 },
  endFrameField: "end_image_url",
  price: { perSecond: { "360p": 6, "540p": 9, "720p": 14, "1080p": 26 }, audioFactor: 1.3 },
  timeoutMinutes: SLOW,
};

// --- The list ---------------------------------------------------------------------------------------------------------------------------------------------------
export const VIDEO_MODELS: VideoModel[] = [
  { id: "kling_3_pro", label: "Kling 3.0 Pro", maker: "Kling", blurb: "Multi-shot, sound and the best general motion. Pro tier.", ratios: R3, durations: range(3, 15), qualities: [], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: kling3("pro") },
  { id: "kling_3_std", label: "Kling 3.0 Standard", maker: "Kling", blurb: "The same model at the lower, cheaper tier.", ratios: R3, durations: range(3, 15), qualities: [], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: kling3("std") },
  { id: "kling_3_4k", label: "Kling 3.0 4K", maker: "Kling", blurb: "The 3.0 model at 4K, with sound.", ratios: R3, durations: range(3, 15), qualities: [], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: kling3("4k") },
  { id: "kling3_0_turbo", label: "Kling 3.0 Turbo", maker: "Kling", blurb: "Fast text-to-video and start-frame animation, 720p or 1080p.", ratios: R3, durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: kling3Turbo },
  { id: "kling2_6", label: "Kling 2.6 Pro", maker: "Kling", blurb: "Cinematic motion and physics, with sound.", ratios: R3, durations: [5, 10], qualities: [], sound: "toggle", startFrame: true, endFrame: false, refImages: 0, live: kling26 },
  { id: "kling_2_5_turbo_pro", label: "Kling 2.5 Turbo Pro", maker: "Kling", blurb: "Fast text and start-frame video, 5 or 10 seconds, no sound.", ratios: [], durations: [5, 10], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: kling25t("pro") },
  { id: "kling_2_5_turbo_std", label: "Kling 2.5 Turbo Standard", maker: "Kling", blurb: "Start-frame animation only (needs a start frame), 5 or 10 seconds.", ratios: [], durations: [5, 10], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: kling25t("standard") },
  { id: "seedance_2_0", label: "Seedance 2.0", maker: "Bytedance", blurb: "Text and start-frame video with sound, up to 4K.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], durations: range(4, 15), qualities: SEEDANCE_RES, sound: "toggle", startFrame: true, endFrame: true, refImages: 9, live: seedance2 },
  { id: "seedance_2_5", label: "Seedance 2.5", maker: "Bytedance", blurb: "Text and start-frame video with sound, up to 30 seconds.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], durations: range(4, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 30, live: seedance25 },
  { id: "happy_horse_1_1", label: "Happy Horse 1.1", maker: "Happy Horse", blurb: "Text-to-video and start-frame animation, with a seed.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: happyHorse11 },
  { id: "pixverse_v6", label: "PixVerse V6", maker: "PixVerse", blurb: "Fast clips from 1 to 15 seconds, with sound and a seed.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(1, 15), qualities: ["360p", "540p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: pixverse6 },

  // Listed with the settings the catalog gives; not connected yet (greyed out, Soon).
  { id: "kling_o3_image_reference", label: "Kling 3.0 Omni", maker: "Kling", blurb: "Video from text and several reference pictures.", ratios: R3, durations: range(3, 15), qualities: ["Standard", "Pro", "4K"], sound: "toggle", startFrame: false, endFrame: false, refImages: 7 },
  { id: "seedance_2_0_mini", label: "Seedance 2.0 Mini", maker: "Bytedance", blurb: "Fast, budget Seedance 2.0.", ratios: RWIDE, durations: range(4, 15), qualities: ["480p", "720p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4 },
  { id: "seedance1_5", label: "Seedance 1.5 Pro", maker: "Bytedance", blurb: "Reliable motion, improved quality.", ratios: RWIDE, durations: [4, 8, 12], qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0 },
  { id: "cinematic_studio_3_0", label: "Cinema Studio Video 3.0", maker: "Higgsfield", blurb: "Cinema-grade video, the most advanced.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(4, 15), qualities: ["480p", "720p", "1080p", "4K"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0 },
  { id: "cinematic_studio_video_4_0", label: "Cinema Studio 4.0", maker: "Higgsfield", blurb: "Automatic direction with camera, lighting and genre.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], durations: range(4, 30), qualities: ["480p", "720p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4 },
  { id: "grok_video_v15", label: "Grok Video 1.5", maker: "xAI", blurb: "Text, a start picture, or picture and audio references.", ratios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], durations: range(1, 15), qualities: ["480p", "720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 7 },
  { id: "minimax_h3", label: "MiniMax H3", maker: "MiniMax", blurb: "Keyframes or references, 2K.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 15), qualities: ["2K"], sound: "none", startFrame: true, endFrame: true, refImages: 4 },
  { id: "minimax_hailuo", label: "Hailuo 2.3", maker: "MiniMax", blurb: "Natural physics and facial emotion.", ratios: ["auto"], durations: [6, 10], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0 },
  { id: "wan3_0", label: "Wan 3.0", maker: "Wan", blurb: "Long clips and reference media, with sound.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(2, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 10 },
  { id: "wan2_7", label: "Wan 2.7", maker: "Wan", blurb: "Text, start and end frame, with a seed.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(2, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: true, refImages: 5 },
  { id: "wan2_6", label: "Wan 2.6", maker: "Wan", blurb: "Stylised, experimental and creative.", ratios: R3, durations: [5, 10, 15], qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 3 },
  { id: "happy_horse_video", label: "Happy Horse 1.0", maker: "Happy Horse", blurb: "Text-to-video and start-frame animation.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 9 },
  { id: "ltx_2_5", label: "LTX-2.5", maker: "Lightricks", blurb: "Fast and Pro, up to 4K, with camera moves.", ratios: ["16:9", "9:16"], durations: [6, 8, 10], qualities: ["720p", "1080p", "2k", "4k"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0 },
  { id: "flux_3_video", label: "FLUX 3 Video", maker: "Black Forest Labs", blurb: "Text, multi-frame and continuation, with sound.", ratios: ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 20), qualities: ["720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4 },
];

export const DEFAULT_VIDEO_MODEL = "kling_3_pro";
// Models that can copy the movement of a reference clip onto the video (motion transfer). From the catalog: only Kling 3.0 so far.
export const MOTION_MODEL_IDS = new Set(["kling_3_pro", "kling_3_std"]);
export const hasMotion = (m: VideoModel) => MOTION_MODEL_IDS.has(m.id);

// The longest model name: the model button is always as wide as this, so it keeps one size whichever model is chosen.
export const LONGEST_MODEL_LABEL = VIDEO_MODELS.reduce((a, m) => (m.label.length > a.length ? m.label : a), "");

export const videoModelById = (id: string | null | undefined): VideoModel => VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
export const findVideoModel = (id: unknown): VideoModel | undefined => (typeof id === "string" ? VIDEO_MODELS.find((m) => m.id === id) : undefined);
export const isLive = (m: VideoModel): m is VideoModel & { live: VideoLive } => !!m.live;

// --- What a model offers for the way it is used ----------------------------------------------------------------------------------------------------------------
// A start frame makes it image-to-video; reference pictures (with no start frame) make it reference-to-video; otherwise text-to-video.
export const workflowOf = (hasStartFrame: boolean, hasRefs = false): Workflow => (hasStartFrame ? "i2v" : hasRefs ? "ref" : "t2v");

export type Caps = {
  durations: number[];
  defaultDuration: number;
  qualities: string[];       // empty = no resolution field
  defaultQuality: string;
  ratios: string[];          // empty = no shape choice (the shape follows the start frame)
  defaultRatio: string;
  audio: boolean;
  audioDefault: boolean;
  seed: { min: number; max: number } | null;
  negativePrompt: number | null; // max length, or null when the model has none
  cfgScale: boolean;
  endFrame: boolean;
  refMax: number;            // reference pictures the model takes (0 = none, or not connected)
  refVideoMax: number;       // reference clips the model takes (0 = none)
  promptRequired: boolean;
  promptMax: number;
};

// The settings that apply to this model in this workflow. For a model that is not connected yet this is its catalog data, shown greyed.
export function capsFor(m: VideoModel, wf: Workflow): Caps {
  const l = m.live;
  if (!l) {
    return { durations: m.durations, defaultDuration: m.durations.includes(5) ? 5 : m.durations[0], qualities: m.qualities, defaultQuality: m.qualities.length ? m.qualities[Math.min(1, m.qualities.length - 1)] : "", ratios: m.ratios, defaultRatio: m.ratios.includes("16:9") ? "16:9" : m.ratios[0], audio: m.sound === "toggle", audioDefault: true, seed: null, negativePrompt: null, cfgScale: false, endFrame: m.endFrame, refMax: 0, refVideoMax: 0, promptRequired: true, promptMax: 5000 };
  }
  const d = (wf === "ref" ? l.durations.ref : undefined) ?? l.durations[wf === "i2v" ? "i2v" : "t2v"];
  const hasAspect = !!l.aspect && wf !== "i2v"; // with a start frame the shape follows the picture
  return {
    durations: d.values ?? range(d.min, d.max),
    defaultDuration: d.values ? (d.values.includes(l.durationDefault) ? l.durationDefault : d.values[0]) : Math.min(Math.max(l.durationDefault, d.min), d.max),
    qualities: l.resolution?.values ?? [],
    defaultQuality: l.resolution?.default ?? "",
    ratios: hasAspect ? l.aspect!.values : [],
    defaultRatio: hasAspect ? l.aspect!.default : "",
    audio: !!l.audio,
    audioDefault: l.audio?.default ?? false,
    seed: l.seed ?? null,
    negativePrompt: l.negativePrompt?.max ?? null,
    cfgScale: !!l.cfgScale,
    endFrame: wf === "i2v" && !!l.endFrameField,
    refMax: l.endpoints.ref ? l.refs?.max ?? 0 : 0,
    refVideoMax: l.endpoints.ref ? l.refs?.videos?.max ?? 0 : 0,
    promptRequired: (wf === "ref" ? l.promptRequired.ref : l.promptRequired[wf === "i2v" ? "i2v" : "t2v"]) ?? false,
    promptMax: l.promptMax,
  };
}

// --- Price ------------------------------------------------------------------------------------------------------------------------------------------------------
// The PROVISIONAL credit price of one render (always a whole number of credits, at least 1), or null for a model that is not connected.
export function videoPrice(m: VideoModel, resolution: string | undefined, duration: number, audio: boolean): number | null {
  const l = m.live;
  if (!l) return null;
  const per = l.price.perSecond[resolution ?? "default"] ?? l.price.perSecond.default ?? Math.max(...Object.values(l.price.perSecond));
  const factor = audio && l.audio && l.price.audioFactor ? l.price.audioFactor : 1;
  return Math.max(1, Math.ceil(per * factor * duration));
}

// How long a render may run before it is given up (the held price is released): longer for 4K and long clips.
export function videoTimeoutMs(m: VideoModel, resolution: string | undefined, duration: number): number {
  const base = m.live?.timeoutMinutes ?? 20;
  return (resolution === "4k" || resolution === "4K" || duration > 20 ? base * 2 : base) * 60_000;
}

// --- The request body ------------------------------------------------------------------------------------------------------------------------------------------
export type VideoInput = {
  prompt: string;
  duration: number;
  resolution?: string;
  aspectRatio?: string;
  audio?: boolean;
  seed?: number | null;
  negativePrompt?: string;
  cfgScale?: number;
  startUrl?: string;   // public https address of the start frame (makes it image-to-video)
  endUrl?: string;     // last frame
  refUrls?: string[];  // reference pictures, in order (makes it reference-to-video; not together with a start frame)
  refVideoUrls?: string[]; // reference clips, in order (also reference-to-video)
};
export type BuildResult = { ok: true; workflow: Workflow; endpoint: string; body: Record<string, unknown> } | { ok: false; error: string };

// Builds the exact JSON body for the model's endpoint. Fields a model does not list are never sent; a value the model cannot take is an error, not a silent change.
export function buildVideoBody(m: VideoModel, input: VideoInput): BuildResult {
  const l = m.live;
  if (!l) return { ok: false, error: `${m.label} is not connected yet.` };
  const refs = input.refUrls ?? [];
  const refVideos = input.refVideoUrls ?? [];
  if ((refs.length || refVideos.length) && (input.startUrl || input.endUrl)) return { ok: false, error: "Use either a start frame or reference pictures, not both." };
  const wf = workflowOf(!!input.startUrl, refs.length > 0 || refVideos.length > 0);
  const endpoint = l.endpoints[wf];
  if (!endpoint) return { ok: false, error: wf === "ref" ? `${m.label} takes no reference pictures yet.` : `${m.label} has no ${wf === "i2v" ? "start-frame" : "text-to-video"} mode connected.` };
  if (wf === "ref" && refVideos.length > (l.refs?.videos?.max ?? 0)) return { ok: false, error: l.refs?.videos ? `${m.label} takes up to ${l.refs.videos.max} reference clips (you chose ${refVideos.length}).` : `${m.label} takes no reference clips.` };
  if (wf === "ref" && refs.length > (l.refs?.max ?? 0)) return { ok: false, error: `${m.label} takes up to ${l.refs?.max ?? 0} reference pictures (you chose ${refs.length}).` };
  const caps = capsFor(m, wf);
  const prompt = input.prompt.trim();
  if (caps.promptRequired && !prompt) return { ok: false, error: `${m.label} needs a prompt${wf === "i2v" ? " (even with a start frame)" : ""}.` };
  if (prompt.length > caps.promptMax) return { ok: false, error: `${m.label} accepts prompts up to ${caps.promptMax} characters (yours is ${prompt.length}).` };
  if (!Number.isInteger(input.duration) || !caps.durations.includes(input.duration)) return { ok: false, error: caps.durations.length === 2 && caps.durations[1] - caps.durations[0] > 1 ? `${m.label} makes clips of ${caps.durations[0]} or ${caps.durations[1]} seconds.` : `${m.label} makes clips of ${caps.durations[0]} to ${caps.durations[caps.durations.length - 1]} seconds.` };

  const body: Record<string, unknown> = {};
  if (prompt || caps.promptRequired) body.prompt = prompt;
  body.duration = input.duration;
  if (caps.qualities.length) {
    const res = input.resolution ?? caps.defaultQuality;
    if (!caps.qualities.includes(res)) return { ok: false, error: `${m.label} does not support the ${res} quality.` };
    body.resolution = res;
  }
  if (caps.ratios.length) {
    const ratio = input.aspectRatio ?? caps.defaultRatio;
    if (!caps.ratios.includes(ratio)) return { ok: false, error: `${m.label} does not support the ${ratio} shape.` };
    body.aspect_ratio = ratio;
  }
  if (l.audio) {
    const on = input.audio ?? l.audio.default;
    body[l.audio.field] = l.audio.kind === "onoff" ? (on ? "on" : "off") : on;
  }
  if (l.seed && input.seed != null) {
    if (!Number.isInteger(input.seed) || input.seed < l.seed.min || input.seed > l.seed.max) return { ok: false, error: `The seed must be a whole number from ${l.seed.min.toLocaleString("en-US")} to ${l.seed.max.toLocaleString("en-US")} for ${m.label}.` };
    body.seed = input.seed;
  }
  if (caps.negativePrompt != null && input.negativePrompt?.trim()) {
    if (input.negativePrompt.length > caps.negativePrompt) return { ok: false, error: `The negative prompt can be up to ${caps.negativePrompt} characters.` };
    body.negative_prompt = input.negativePrompt.trim();
  }
  if (caps.cfgScale && input.cfgScale != null) {
    if (typeof input.cfgScale !== "number" || input.cfgScale < 0 || input.cfgScale > 1) return { ok: false, error: "The creativity setting must be between 0 and 1." };
    body.cfg_scale = Math.round(input.cfgScale * 100) / 100;
  }
  if (wf === "ref") {
    if (refs.length) body.image_urls = refs;
    if (refVideos.length) body.video_urls = refVideos;
  } else if (wf === "i2v") {
    body.image_url = input.startUrl;
    if (input.endUrl) {
      if (!l.endFrameField) return { ok: false, error: `${m.label} has no end frame.` };
      body[l.endFrameField] = input.endUrl;
    }
  } else if (input.endUrl) {
    return { ok: false, error: "An end frame needs a start frame too." };
  }
  return { ok: true, workflow: wf, endpoint, body };
}
