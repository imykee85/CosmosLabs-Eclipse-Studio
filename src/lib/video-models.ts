// The video models Video Studio offers. Models marked `live` generate for real through Higgsfield (their endpoints, fields, ranges and rules are copied from the
// Higgsfield API pages, read 2026-10-12, see docs/video-brief-notes.md); the others are listed with the settings the catalog gives, greyed out and tagged Soon, until their
// request page is wired. The UI renders its controls from this registry only, and `buildVideoBody` is the one place a request body is made: it sends only the fields
// the model lists (several endpoints reject unknown fields), applies defaults, clamps nothing silently (a bad value is an error) and never switches to another model.
// Shared by the browser (controls, price estimate) and the server (validation, request body, price).

import { toLedger } from "./credit-units";
import { videoCreditsForUsd } from "./price-constants";
import type { Route } from "./routes";

export type Workflow = "t2v" | "i2v" | "ref" | "motion"; // text, start frame(s), reference pictures/clips, or motion transfer (Motion chip)

type ResSpec = { values: string[]; default: string };
type AspectSpec = { values: string[]; default: string };
type AudioSpec = { field: "generate_audio" | "sound"; kind: "bool" | "onoff"; default: boolean };
// What one workflow does differently from the model's base settings (null = the field does not exist in that workflow).
type WfOverride = { resolution?: ResSpec | null; aspect?: AspectSpec | null; seed?: { min: number; max: number } | null; negativePrompt?: { max: number } | null; audio?: AudioSpec | null };

export type VideoLive = {
  endpoints: Partial<Record<Workflow, string>>;     // path after the API base address
  refs?: { max: number; videos?: { max: number }; audio?: { max: number; alone?: boolean }; total?: number }; // reference pictures, clips (the user's own finished videos), sounds (their Audio Studio takes; `alone`: a sound with no picture or clip is allowed), and the most in all
  promptMax: number;                                // longer prompts are refused here (some endpoints truncate silently)
  promptRequired: Record<"t2v" | "i2v", boolean> & { ref?: boolean };
  durations: Record<"t2v" | "i2v", { min: number; max: number; values?: number[] }> & { ref?: { min: number; max: number; values?: number[] } };  // `values` = only these lengths (e.g. 5 or 10)
  durationDefault: number;
  resolution?: ResSpec;
  aspect?: AspectSpec;                              // text and reference; with a start frame the shape follows the picture unless aspectOnI2v
  aspectOnI2v?: boolean;
  audio?: AudioSpec;
  seed?: { min: number; max: number };
  negativePrompt?: { max: number };
  cfgScale?: boolean;
  byWf?: Partial<Record<"t2v" | "i2v" | "ref", WfOverride>>;
  fixed?: Record<string, unknown>;                  // always sent as is (e.g. a watermark switch the API wants off)
  endFrameField?: string;                           // name of the last-frame field on the image-to-video endpoint; absent = no end frame
  // Multi-shot (Kling 3.0 Std/Pro/4K): `multi_shots: true` and `multi_prompt` [{ prompt, duration }] (1 to `max` shots, each prompt up to `promptMax`, each 1 to 15 s);
  // the summed shot length replaces `duration` and is what is billed. Field names from the owner's Kling reference; the item shape is NOT verified live.
  multiShot?: { max: number; promptMax: number; minSec: number; maxSec: number };
  // Motion transfer (the Motion chip): the subject picture is the start frame, the motion clip is the one reference clip; the length follows the clip.
  motion?: { kind: "kling" | "genjutsu"; minSec: number; maxSec: number; trimsAbove?: boolean };
  // PRICE (owner decision 2026-10-20, docs/video-pricing.md): the provider's LIST cost in USD per second of the clip by resolution ("default" when there is no
  // resolution field), `usdAudio` where sound on costs more, `directUsd` for the cheaper direct route (routes.ts). A clip costs ceil(seconds x cost / $0.04) whole
  // credits, rounded ONCE for the whole clip. `estimate` lists the rows that are estimates in the owner's workbook ("audio" = the sound-on row, "direct" = the direct route).
  price: { usd: Record<string, number>; usdAudio?: Record<string, number>; directUsd?: Record<string, number>; estimate?: string[] };
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
  hidden?: boolean;            // not in the model picker (the Motion chip's engines)
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
  multiShot: { max: 6, promptMax: 512, minSec: 1, maxSec: 15 },
  price: { usd: { default: tier === "4k" ? 0.42 : tier === "pro" ? 0.112 : 0.084 }, usdAudio: { default: tier === "4k" ? 0.63 : tier === "pro" ? 0.168 : 0.126 }, estimate: tier === "pro" ? [] : tier === "4k" ? ["default", "audio"] : ["audio"] },
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
  price: { usd: { "720p": 0.112, "1080p": 0.14 } },
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
  price: { usd: { default: 0.07 }, usdAudio: { default: 0.14 } },
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
  price: { usd: { default: tier === "pro" ? 0.07 : 0.042 } },
  timeoutMinutes: SLOW,
});

const SEEDANCE_RES = ["480p", "720p", "1080p", "4k"];
const seedance2: VideoLive = {
  endpoints: { t2v: "bytedance/seedance-2.0/text-to-video", i2v: "bytedance/seedance-2.0/image-to-video", ref: "bytedance/seedance-2.0/reference-to-video" },
  refs: { max: 9, videos: { max: 3 }, audio: { max: 3 } },
  promptMax: 5000, // the pages state no limit; kept at the app-wide cap
  promptRequired: { t2v: true, i2v: false, ref: false },
  durations: { t2v: { min: 4, max: 15 }, i2v: { min: 4, max: 15 }, ref: { min: 4, max: 15 } },
  durationDefault: 5,
  resolution: { values: SEEDANCE_RES, default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  endFrameField: "end_image_url",
  price: { usd: { "480p": 0.1407, "720p": 0.3024, "1080p": 0.6804, "4k": 1.5552 }, directUsd: { "480p": 0.07, "720p": 0.15, "1080p": 0.37, "4k": 0.78 } },
  timeoutMinutes: SLOW,
  note: "4k can take twice as long.",
};

// Seedance 2.5 (text-to-video and image-to-video; the reference, edit and extend endpoints are not built yet, see docs/seedance-api.md). Longer clips (4 to 30 s),
// no 4k, no seed, negative prompt or cfg. `bitrate_mode` (default "high") and `output_format` (default "mp4", text-to-video only) are left to their defaults.
const seedance25: VideoLive = {
  endpoints: { t2v: "bytedance/seedance-2.5/text-to-video", i2v: "bytedance/seedance-2.5/image-to-video", ref: "bytedance/seedance-2.5/reference-to-video" },
  refs: { max: 30, videos: { max: 10 }, audio: { max: 10, alone: true }, total: 50 },
  promptMax: 5000, // the pages state no limit; kept at the app-wide cap
  promptRequired: { t2v: true, i2v: false, ref: false },
  durations: { t2v: { min: 4, max: 30 }, i2v: { min: 4, max: 30 }, ref: { min: 4, max: 30 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  endFrameField: "end_image_url",
  price: { usd: { "480p": 0.2056, "720p": 0.4622, "1080p": 1.1372 }, directUsd: { "480p": 0.1075, "720p": 0.2311, "1080p": 0.5686 }, estimate: ["direct"] },
  timeoutMinutes: SLOW,
  note: "Clips over 20 seconds can take twice as long.",
};

const happyHorse11: VideoLive = {
  endpoints: { t2v: "alibaba/happy-horse/v1.1/text-to-video", i2v: "alibaba/happy-horse/v1.1/image-to-video", ref: "alibaba/happy-horse/v1.1/reference-to-video" },
  refs: { max: 9 },
  byWf: { ref: { aspect: null } },
  promptMax: 5000, // not stated on the page
  promptRequired: { t2v: true, i2v: false, ref: true },
  durations: { t2v: { min: 3, max: 15 }, i2v: { min: 2, max: 15 }, ref: { min: 2, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "1080p" },
  aspect: { values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" },
  seed: { min: 1, max: 2147483646 },
  price: { usd: { "720p": 0.14, "1080p": 0.18 } },
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
  price: { usd: { "360p": 0.035, "540p": 0.045, "720p": 0.06, "1080p": 0.115 } },
  timeoutMinutes: SLOW,
};


// --- The other connected families (Higgsfield API reference of 2026-10-13; fields per workflow, see docs/video-api-appendix.md) ------------------------------------
const happyHorse10: VideoLive = {
  endpoints: { t2v: "alibaba/happy-horse/text-to-video", i2v: "alibaba/happy-horse/image-to-video", ref: "alibaba/happy-horse/reference-to-video" },
  refs: { max: 9 },
  byWf: { ref: { aspect: null } },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: false, ref: true },
  durations: { t2v: { min: 3, max: 15 }, i2v: { min: 2, max: 15 }, ref: { min: 2, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" },
  seed: { min: 1, max: 2147483646 },
  price: { usd: { "720p": 0.14, "1080p": 0.28 } },
  timeoutMinutes: SLOW,
};

// Wan 3.0 and Wan 3.0 Prime share their fields (2 to 30 s, sound, an "adaptive" shape, seed from 1 because 0 is not forwarded). Document and web-page references
// and "deep thinking" are not offered.
const wan3 = (prime: boolean): VideoLive => ({
  endpoints: prime
    ? { t2v: "alibaba/wan-3.0-prime/text-to-video", i2v: "alibaba/wan-3.0-prime/image-to-video", ref: "alibaba/wan-3.0-prime/reference-to-video" }
    : { t2v: "alibaba/wan-3.0/text-to-video", i2v: "alibaba/wan-3.0/image-to-video", ref: "alibaba/wan-3.0/reference-to-video" },
  refs: { max: 10, videos: { max: 5 } },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true, ref: true },
  durations: { t2v: { min: 2, max: 30 }, i2v: { min: 2, max: 30 }, ref: { min: 2, max: 30 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p", "1080p"], default: "1080p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"], default: "adaptive" },
  aspectOnI2v: true,
  audio: { field: "generate_audio", kind: "bool", default: true },
  seed: { min: 1, max: 2147483647 },
  endFrameField: "end_image_url",
  price: { usd: prime ? { "480p": 0.068, "720p": 0.14, "1080p": 0.28 } : { "480p": 0.05, "720p": 0.1, "1080p": 0.2 }, estimate: prime ? ["720p", "1080p"] : [] },
  timeoutMinutes: SLOW,
});

const wan27: VideoLive = {
  endpoints: { t2v: "wan/v2.7/text-to-video", i2v: "wan/v2.7/image-to-video", ref: "wan/v2.7/reference-to-video" },
  refs: { max: 5, videos: { max: 5 }, total: 5 },
  byWf: { ref: { aspect: { values: ["16:9", "9:16"], default: "16:9" } } },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: false, ref: true },
  durations: { t2v: { min: 2, max: 15 }, i2v: { min: 2, max: 15 }, ref: { min: 2, max: 10 } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" },
  seed: { min: 1, max: 2147483646 },
  negativePrompt: { max: 2000 },
  endFrameField: "end_image_url",
  price: { usd: { "720p": 0.1, "1080p": 0.15 } },
  timeoutMinutes: SLOW,
};

// Wan 2.6: lengths of 5, 10 or 15 s; no shape on text and image; reference-to-video takes reference CLIPS only (1 to 3), 5 or 10 s, no seed.
const wan26: VideoLive = {
  endpoints: { t2v: "wan/v2.6/text-to-video", i2v: "wan/v2.6/image-to-video", ref: "wan/v2.6/reference-to-video" },
  refs: { max: 0, videos: { max: 3 } },
  byWf: {
    i2v: { resolution: { values: ["480p", "720p", "1080p"], default: "720p" }, negativePrompt: { max: 2000 } },
    ref: { aspect: { values: ["16:9", "9:16", "1:1", "4:3", "3:4"], default: "16:9" }, seed: null },
  },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true, ref: true },
  durations: { t2v: { min: 5, max: 15, values: [5, 10, 15] }, i2v: { min: 5, max: 15, values: [5, 10, 15] }, ref: { min: 5, max: 10, values: [5, 10] } },
  durationDefault: 5,
  resolution: { values: ["720p", "1080p"], default: "720p" },
  seed: { min: 0, max: 10000000 },
  price: { usd: { "720p": 0.1, "1080p": 0.15 } },
  timeoutMinutes: SLOW,
};

// MiniMax H3: 2K only, 5 to 15 s, no sound switch; the watermark switch is always sent off. The shape follows the picture on image-to-video.
const minimaxH3: VideoLive = {
  endpoints: { t2v: "minimax/h3/text-to-video", i2v: "minimax/h3/image-to-video", ref: "minimax/h3/reference-to-video" },
  refs: { max: 9, videos: { max: 3 } },
  promptMax: 7000,
  promptRequired: { t2v: true, i2v: true, ref: true },
  durations: { t2v: { min: 5, max: 15 }, i2v: { min: 5, max: 15 }, ref: { min: 5, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["2K"], default: "2K" },
  aspect: { values: ["auto", "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], default: "auto" },
  fixed: { aigc_watermark: false },
  endFrameField: "end_image_url",
  price: { usd: { "2K": 0.13 } },
  timeoutMinutes: SLOW,
};

// Hailuo 2.3 Standard: 6 or 10 s at a fixed 768P; no shape, seed or sound switch.
const hailuo23: VideoLive = {
  endpoints: { t2v: "minimax/hailuo-2.3/standard/text-to-video", i2v: "minimax/hailuo-2.3/standard/image-to-video" },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 6, max: 10, values: [6, 10] }, i2v: { min: 6, max: 10, values: [6, 10] } },
  durationDefault: 6,
  price: { usd: { default: 0.056 } },
  timeoutMinutes: SLOW,
};

// LTX-2.5 Fast and Pro (the tier is the last part of the path): 6, 8 or 10 s, 16:9 or 9:16, sound. Frame rate and camera moves are left to their defaults.
const ltx25 = (tier: "fast" | "pro"): VideoLive => ({
  endpoints: { t2v: `lightricks/ltx-2.5/text-to-video/${tier}`, i2v: `lightricks/ltx-2.5/image-to-video/${tier}` },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true },
  durations: { t2v: { min: 6, max: 10, values: [6, 8, 10] }, i2v: { min: 6, max: 10, values: [6, 8, 10] } },
  durationDefault: 6,
  resolution: tier === "fast" ? { values: ["720p", "1080p", "2k", "4k"], default: "720p" } : { values: ["720p", "1080p"], default: "720p" },
  aspect: { values: ["16:9", "9:16"], default: "16:9" },
  aspectOnI2v: true,
  audio: { field: "generate_audio", kind: "bool", default: true },
  endFrameField: "end_image_url",
  price: { usd: tier === "fast" ? { "720p": 0.09, "1080p": 0.13, "2k": 0.19, "4k": 0.3 } : { "720p": 0.12, "1080p": 0.17 } },
  timeoutMinutes: SLOW,
});

// Grok Imagine Video 1.5: one endpoint for everything (text only, a first-frame picture, or up to 7 reference pictures); no sound switch or seed. Reference pictures
// allow only 480p or 720p.
const grok15: VideoLive = {
  endpoints: { t2v: "xai/grok-imagine-video/v1.5/reference-to-video", i2v: "xai/grok-imagine-video/v1.5/reference-to-video", ref: "xai/grok-imagine-video/v1.5/reference-to-video" },
  refs: { max: 7 },
  byWf: { ref: { resolution: { values: ["480p", "720p"], default: "480p" } } },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true, ref: true },
  durations: { t2v: { min: 1, max: 15 }, i2v: { min: 1, max: 15 }, ref: { min: 1, max: 15 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p", "1080p"], default: "480p" },
  aspect: { values: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], default: "auto" },
  aspectOnI2v: true,
  price: { usd: { "480p": 0.08, "720p": 0.14, "1080p": 0.25 } },
  timeoutMinutes: SLOW,
};

// Cinema Studio 4.0: text or references (no start frame); 4 to 30 s at 480p or 720p, with sound. The director controls (era, genre, light, camera...) are not offered yet.
const cinema40: VideoLive = {
  endpoints: { t2v: "higgsfield/cinema-studio/4.0", ref: "higgsfield/cinema-studio/4.0" },
  refs: { max: 30, videos: { max: 10 }, total: 50 },
  promptMax: 5000,
  promptRequired: { t2v: true, i2v: true, ref: true },
  durations: { t2v: { min: 4, max: 30 }, i2v: { min: 4, max: 30 }, ref: { min: 4, max: 30 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p"], default: "720p" },
  aspect: { values: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], default: "16:9" },
  audio: { field: "generate_audio", kind: "bool", default: true },
  price: { usd: { "480p": 0.2057, "720p": 0.4623 } },
  timeoutMinutes: SLOW,
};

// --- Motion transfer engines (the Motion chip, not the model picker) -------------------------------------------------------------------------------------------
// Kling Motion Control (2.6 and 3.0, Standard and Pro): a subject picture and a 3 to 30 s motion clip; the output follows the clip's length. Genjutsu motion transfer:
// the same idea (4 s or longer, trimmed to 30 s) at 480p, 720p or 1080p. The only published price is Genjutsu Restyle's (per source second: about $0.318 at 480p,
// $0.681 at 720p, $1.632 at 1080p); motion transfer's own price is NOT published, so these placeholders reuse that scale at about $0.008 a credit.
const klingMotion = (ver: "3" | "26", tier: "std" | "pro"): VideoLive => ({
  endpoints: { motion: ver === "3" ? `kling-video/v3/motion-control/${tier}` : `kling-video/motion-control/${tier}` },
  refs: { max: 0, videos: { max: 1 } },
  motion: { kind: "kling", minSec: 3, maxSec: 30 },
  promptMax: 5000,
  promptRequired: { t2v: false, i2v: false },
  durations: { t2v: { min: 3, max: 30 }, i2v: { min: 3, max: 30 } },
  durationDefault: 5,
  price: { usd: { default: ver === "3" ? (tier === "pro" ? 0.168 : 0.126) : 0.168 }, estimate: ver === "26" ? ["default"] : [] },
  timeoutMinutes: SLOW,
});
const genjutsuMotion: VideoLive = {
  endpoints: { motion: "higgsfield/genjutsu/motion-transfer/v1.0" },
  refs: { max: 0, videos: { max: 1 } },
  motion: { kind: "genjutsu", minSec: 4, maxSec: 30, trimsAbove: true },
  promptMax: 5000,
  promptRequired: { t2v: false, i2v: false },
  durations: { t2v: { min: 4, max: 30 }, i2v: { min: 4, max: 30 } },
  durationDefault: 5,
  resolution: { values: ["480p", "720p", "1080p"], default: "720p" },
  price: { usd: { "480p": 0.318, "720p": 0.681, "1080p": 1.632 } },
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
  { id: "happy_horse_1_1", label: "Happy Horse 1.1", maker: "Happy Horse", blurb: "Text, start frame and reference pictures, with a seed.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 9, live: happyHorse11 },
  { id: "pixverse_v6", label: "PixVerse V6", maker: "PixVerse", blurb: "Fast clips from 1 to 15 seconds, with sound and a seed.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(1, 15), qualities: ["360p", "540p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: pixverse6 },
  { id: "happy_horse_video", label: "Happy Horse 1.0", maker: "Happy Horse", blurb: "Text, start frame and reference pictures, with a seed.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 9, live: happyHorse10 },
  { id: "wan3_0", label: "Wan 3.0", maker: "Wan", blurb: "Long clips up to 30 s, pictures and clips as references, with sound.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"], durations: range(2, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 10, live: wan3(false) },
  { id: "wan3_0_prime", label: "Wan 3.0 Prime", maker: "Wan", blurb: "The higher tier of Wan 3.0, up to 30 s, with sound.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "adaptive"], durations: range(2, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 10, live: wan3(true) },
  { id: "wan2_7", label: "Wan 2.7", maker: "Wan", blurb: "Text, start and end frame, references, with a seed.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(2, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: true, refImages: 5, live: wan27 },
  { id: "wan2_6", label: "Wan 2.6", maker: "Wan", blurb: "Stylised clips of 5, 10 or 15 s; references are clips only.", ratios: [], durations: [5, 10, 15], qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: wan26 },
  { id: "minimax_h3", label: "MiniMax H3", maker: "MiniMax", blurb: "2K video from text, keyframes or references.", ratios: ["auto", "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 15), qualities: ["2K"], sound: "none", startFrame: true, endFrame: true, refImages: 9, live: minimaxH3 },
  { id: "minimax_hailuo", label: "Hailuo 2.3 Standard", maker: "MiniMax", blurb: "Natural physics and facial emotion, 6 or 10 s.", ratios: [], durations: [6, 10], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, live: hailuo23 },
  { id: "ltx_2_5", label: "LTX-2.5 Fast", maker: "Lightricks", blurb: "Fast clips up to 4K, with sound.", ratios: ["16:9", "9:16"], durations: [6, 8, 10], qualities: ["720p", "1080p", "2k", "4k"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: ltx25("fast") },
  { id: "ltx_2_5_pro", label: "LTX-2.5 Pro", maker: "Lightricks", blurb: "The higher-quality tier, 720p or 1080p, with sound.", ratios: ["16:9", "9:16"], durations: [6, 8, 10], qualities: ["720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, live: ltx25("pro") },
  { id: "grok_video_v15", label: "Grok Video 1.5", maker: "xAI", blurb: "Text, a first-frame picture, or up to 7 reference pictures.", ratios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], durations: range(1, 15), qualities: ["480p", "720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 7, live: grok15 },
  { id: "cinematic_studio_video_4_0", label: "Cinema Studio 4.0", maker: "Cinema Studio", blurb: "Cinema-grade video from text or references, up to 30 s.", ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], durations: range(4, 30), qualities: ["480p", "720p"], sound: "toggle", startFrame: false, endFrame: false, refImages: 30, live: cinema40 },
  // Motion engines: only the Motion chip uses these (hidden from the model picker).
  { id: "kling_mc_3_pro", label: "Kling 3.0 Motion Control Pro", maker: "Kling", blurb: "Copies a clip's movement onto your subject.", ratios: [], durations: [], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, hidden: true, live: klingMotion("3", "pro") },
  { id: "kling_mc_3_std", label: "Kling 3.0 Motion Control Standard", maker: "Kling", blurb: "Copies a clip's movement onto your subject.", ratios: [], durations: [], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, hidden: true, live: klingMotion("3", "std") },
  { id: "kling_mc_26_pro", label: "Kling 2.6 Motion Control Pro", maker: "Kling", blurb: "Copies a clip's movement onto your subject.", ratios: [], durations: [], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, hidden: true, live: klingMotion("26", "pro") },
  { id: "kling_mc_26_std", label: "Kling 2.6 Motion Control Standard", maker: "Kling", blurb: "Copies a clip's movement onto your subject.", ratios: [], durations: [], qualities: [], sound: "none", startFrame: true, endFrame: false, refImages: 0, hidden: true, live: klingMotion("26", "std") },
  { id: "genjutsu_motion", label: "Genjutsu Motion transfer", maker: "Genjutsu", blurb: "Moves your subject like the person in a clip.", ratios: [], durations: [], qualities: ["480p", "720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, hidden: true, live: genjutsuMotion },

  // Listed with the settings the catalog gives; not connected yet (greyed out, Soon).
  { id: "kling_o3_image_reference", label: "Kling 3.0 Omni", maker: "Kling", blurb: "Video from text and several reference pictures.", ratios: R3, durations: range(3, 15), qualities: ["Standard", "Pro", "4K"], sound: "toggle", startFrame: false, endFrame: false, refImages: 7 },
  { id: "seedance_2_0_mini", label: "Seedance 2.0 Mini", maker: "Bytedance", blurb: "Fast, budget Seedance 2.0.", ratios: RWIDE, durations: range(4, 15), qualities: ["480p", "720p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4 },
  { id: "seedance1_5", label: "Seedance 1.5 Pro", maker: "Bytedance", blurb: "Reliable motion, improved quality.", ratios: RWIDE, durations: [4, 8, 12], qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0 },
  { id: "cinematic_studio_3_0", label: "Cinema Studio Video 3.0", maker: "Cinema Studio", blurb: "Cinema-grade video, the most advanced.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(4, 15), qualities: ["480p", "720p", "1080p", "4K"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0 },
  { id: "flux_3_video", label: "FLUX 3 Video", maker: "Black Forest Labs", blurb: "Text, multi-frame and continuation, with sound.", ratios: ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 20), qualities: ["720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4 },
];

export const DEFAULT_VIDEO_MODEL = "kling_3_pro";
// Models that can copy the movement of a reference clip onto the video (motion transfer). From the catalog: only Kling 3.0 so far.
export const MOTION_MODEL_IDS = new Set(["kling_3_pro", "kling_3_std"]);
export const hasMotion = (m: VideoModel) => MOTION_MODEL_IDS.has(m.id);

// The longest model name: the model button is always as wide as this, so it keeps one size whichever model is chosen.
export const LONGEST_MODEL_LABEL = VIDEO_MODELS.filter((m) => !m.hidden).reduce((a, m) => (m.label.length > a.length ? m.label : a), "");

export const videoModelById = (id: string | null | undefined): VideoModel => VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
// What the model picker lists (the motion engines belong to the Motion chip).
export const PICKER_MODELS = VIDEO_MODELS.filter((m) => !m.hidden);
export const findVideoModel = (id: unknown): VideoModel | undefined => (typeof id === "string" ? VIDEO_MODELS.find((m) => m.id === id) : undefined);
export const isLive = (m: VideoModel): m is VideoModel & { live: VideoLive } => !!m.live;

// --- What a model offers for the way it is used ----------------------------------------------------------------------------------------------------------------
// A start frame makes it image-to-video; reference pictures (with no start frame) make it reference-to-video; otherwise text-to-video.
export const workflowOf = (hasStartFrame: boolean, hasRefs = false): Workflow => (hasStartFrame ? "i2v" : hasRefs ? "ref" : "t2v");
// The same, for a given model: a motion engine always works as motion transfer.
export const workflowFor = (m: VideoModel, hasStartFrame: boolean, hasRefs = false): Workflow => (m.live?.motion ? "motion" : workflowOf(hasStartFrame, hasRefs));

// The settings a workflow really has: the model's base settings with that workflow's differences applied.
function eff(l: VideoLive, wf: Workflow) {
  const o = wf === "motion" ? undefined : l.byWf?.[wf];
  const pick = <K extends keyof WfOverride>(k: K, base: WfOverride[K]) => (o && k in o ? (o[k] ?? undefined) : base);
  return {
    resolution: pick("resolution", l.resolution) as ResSpec | undefined,
    aspect: pick("aspect", wf === "i2v" && !l.aspectOnI2v ? undefined : l.aspect) as AspectSpec | undefined,
    seed: pick("seed", l.seed) as { min: number; max: number } | undefined,
    negativePrompt: pick("negativePrompt", l.negativePrompt) as { max: number } | undefined,
    audio: pick("audio", l.audio) as AudioSpec | undefined,
  };
}

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
  refAudioMax: number;       // reference sounds the model takes (0 = none)
  multiShot: { max: number; promptMax: number; minSec: number; maxSec: number } | null; // several shots in one clip (Kling 3.0)
  promptRequired: boolean;
  promptMax: number;
};

// The settings that apply to this model in this workflow. For a model that is not connected yet this is its catalog data, shown greyed.
export function capsFor(m: VideoModel, wf: Workflow): Caps {
  const l = m.live;
  if (!l) {
    return { durations: m.durations, defaultDuration: m.durations.includes(5) ? 5 : m.durations[0], qualities: m.qualities, defaultQuality: m.qualities.length ? m.qualities[Math.min(1, m.qualities.length - 1)] : "", ratios: m.ratios, defaultRatio: m.ratios.includes("16:9") ? "16:9" : m.ratios[0], audio: m.sound === "toggle", audioDefault: true, seed: null, negativePrompt: null, cfgScale: false, endFrame: m.endFrame, refMax: 0, refVideoMax: 0, refAudioMax: 0, multiShot: null, promptRequired: true, promptMax: 5000 };
  }
  if (wf === "motion") {
    const e = eff(l, wf);
    return { durations: [], defaultDuration: 5, qualities: e.resolution?.values ?? [], defaultQuality: e.resolution?.default ?? "", ratios: [], defaultRatio: "", audio: false, audioDefault: false, seed: null, negativePrompt: null, cfgScale: false, endFrame: false, refMax: 0, refVideoMax: l.refs?.videos?.max ?? 0, refAudioMax: 0, multiShot: null, promptRequired: false, promptMax: l.promptMax };
  }
  const d = (wf === "ref" ? l.durations.ref : undefined) ?? l.durations[wf === "i2v" ? "i2v" : "t2v"];
  const e = eff(l, wf);
  return {
    durations: d.values ?? range(d.min, d.max),
    defaultDuration: d.values ? (d.values.includes(l.durationDefault) ? l.durationDefault : d.values[0]) : Math.min(Math.max(l.durationDefault, d.min), d.max),
    qualities: e.resolution?.values ?? [],
    defaultQuality: e.resolution?.default ?? "",
    ratios: e.aspect?.values ?? [],
    defaultRatio: e.aspect?.default ?? "",
    audio: !!e.audio,
    audioDefault: e.audio?.default ?? false,
    seed: e.seed ?? null,
    negativePrompt: e.negativePrompt?.max ?? null,
    cfgScale: !!l.cfgScale,
    endFrame: wf === "i2v" && !!l.endFrameField,
    refMax: l.endpoints.ref ? l.refs?.max ?? 0 : 0,
    refVideoMax: l.endpoints.ref ? l.refs?.videos?.max ?? 0 : 0,
    refAudioMax: l.endpoints.ref ? l.refs?.audio?.max ?? 0 : 0,
    multiShot: wf !== "ref" && l.multiShot ? l.multiShot : null,
    promptRequired: (wf === "ref" ? l.promptRequired.ref : l.promptRequired[wf === "i2v" ? "i2v" : "t2v"]) ?? false,
    promptMax: l.promptMax,
  };
}

// --- Price ------------------------------------------------------------------------------------------------------------------------------------------------------
// The price of one render in LEDGER units (tenths of a credit; always a whole number of credits x 10, at least 1 credit), or null for a model that is not connected.
// For motion transfer `duration` is the length of the MOTION/SOURCE clip. `route` is the route the render really uses (see routes.ts).
export function videoCredits(m: VideoModel, resolution: string | undefined, duration: number, audio: boolean, route: Route = "higgsfield"): number | null {
  const l = m.live;
  if (!l) return null;
  const sound = audio && !!l.audio && !!l.price.usdAudio;
  const normal = sound ? l.price.usdAudio! : l.price.usd;
  // The direct route has prices only for some resolutions (Seedance: not 4k); any other resolution stays on Higgsfield's price.
  const direct = route === "direct" ? l.price.directUsd : undefined;
  const table = direct && direct[resolution ?? "default"] != null ? direct : normal;
  const key = resolution && table[resolution] != null ? resolution : table.default != null ? "default" : Object.keys(table)[0];
  const perSecond = table[key] ?? l.price.usd[key] ?? Math.max(...Object.values(l.price.usd));
  // video markup 1.8x (master brief section 1); the ceil happens once, on the whole clip
  return videoCreditsForUsd(duration * perSecond);
}
export function videoPrice(m: VideoModel, resolution: string | undefined, duration: number, audio: boolean, route: Route = "higgsfield"): number | null {
  const c = videoCredits(m, resolution, duration, audio, route);
  return c == null ? null : toLedger(c);
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
  refAudioUrls?: string[]; // reference sounds, in order (reference-to-video, Seedance)
  shots?: { prompt: string; duration: number }[]; // multi-shot (Kling 3.0): the shots in order; their summed length is the duration
  keepSound?: boolean;     // motion transfer (Kling): keep the sound of the motion clip
  orientation?: "image" | "video"; // motion transfer (Kling): whose facing direction the result follows
};
export type BuildResult = { ok: true; workflow: Workflow; endpoint: string; body: Record<string, unknown> } | { ok: false; error: string };

// Builds the exact JSON body for the model's endpoint. Fields a model does not list are never sent; a value the model cannot take is an error, not a silent change.
export function buildVideoBody(m: VideoModel, input: VideoInput): BuildResult {
  const l = m.live;
  if (!l) return { ok: false, error: `${m.label} is not available yet.` };
  const refs = input.refUrls ?? [];
  const refVideos = input.refVideoUrls ?? [];
  const refAudio = input.refAudioUrls ?? [];
  if (l.motion) return buildMotionBody(m, l, input);
  if ((refs.length || refVideos.length || refAudio.length) && (input.startUrl || input.endUrl)) return { ok: false, error: "Use either a start frame or reference pictures, not both." };
  const wf = workflowOf(!!input.startUrl, refs.length > 0 || refVideos.length > 0 || refAudio.length > 0);
  if (refAudio.length) {
    const a = l.refs?.audio;
    if (!a || !l.endpoints.ref) return { ok: false, error: `${m.label} takes no reference sounds.` };
    if (refAudio.length > a.max) return { ok: false, error: `${m.label} takes up to ${a.max} reference sounds (you chose ${refAudio.length}).` };
    if (!a.alone && !refs.length && !refVideos.length) return { ok: false, error: `${m.label} needs a reference picture or clip as well as the sound.` };
    if (l.refs?.total != null && refs.length + refVideos.length + refAudio.length > l.refs.total) return { ok: false, error: `${m.label} takes up to ${l.refs.total} references in all.` };
  }
  const endpoint = l.endpoints[wf];
  if (!endpoint) return { ok: false, error: wf === "ref" ? `${m.label} takes no reference pictures yet.` : `${m.label} has no ${wf === "i2v" ? "start-frame" : "text-to-video"} mode connected.` };
  if (wf === "ref" && refVideos.length > (l.refs?.videos?.max ?? 0)) return { ok: false, error: l.refs?.videos ? `${m.label} takes up to ${l.refs.videos.max} reference clips (you chose ${refVideos.length}).` : `${m.label} takes no reference clips.` };
  if (wf === "ref" && l.refs?.total != null && refs.length + refVideos.length > l.refs.total) return { ok: false, error: `${m.label} takes up to ${l.refs.total} reference pictures and clips in all (you chose ${refs.length + refVideos.length}).` };
  if (wf === "ref" && refs.length > (l.refs?.max ?? 0)) return { ok: false, error: `${m.label} takes up to ${l.refs?.max ?? 0} reference pictures (you chose ${refs.length}).` };
  const caps = capsFor(m, wf);
  const prompt = input.prompt.trim();
  const shots = input.shots ?? [];
  if (shots.length) {
    const ms = l.multiShot;
    if (!ms) return { ok: false, error: `${m.label} has no multi-shot mode.` };
    if (wf === "ref") return { ok: false, error: "Multi-shot does not work with reference pictures." };
    if (shots.length > ms.max) return { ok: false, error: `${m.label} takes up to ${ms.max} shots.` };
    for (const [i, sh] of shots.entries()) {
      if (!sh.prompt?.trim()) return { ok: false, error: `Shot ${i + 1} needs a description.` };
      if (sh.prompt.trim().length > ms.promptMax) return { ok: false, error: `Shot ${i + 1} can be up to ${ms.promptMax} characters.` };
      if (!Number.isInteger(sh.duration) || sh.duration < ms.minSec || sh.duration > ms.maxSec) return { ok: false, error: `Shot ${i + 1} must be ${ms.minSec} to ${ms.maxSec} seconds.` };
    }
    const total = shots.reduce((a, sh) => a + sh.duration, 0);
    if (total !== input.duration) return { ok: false, error: "The length must be the sum of the shots." };
    if (!caps.durations.includes(total)) return { ok: false, error: `The shots add up to ${total} s; ${m.label} makes clips of ${caps.durations[0]} to ${caps.durations[caps.durations.length - 1]} seconds.` };
  }
  if (caps.promptRequired && !prompt) return { ok: false, error: `${m.label} needs a prompt${wf === "i2v" ? " (even with a start frame)" : ""}.` };
  if (prompt.length > caps.promptMax) return { ok: false, error: `${m.label} accepts prompts up to ${caps.promptMax} characters (yours is ${prompt.length}).` };
  if (!shots.length && (!Number.isInteger(input.duration) || !caps.durations.includes(input.duration))) return { ok: false, error: caps.durations.length === 2 && caps.durations[1] - caps.durations[0] > 1 ? `${m.label} makes clips of ${caps.durations[0]} or ${caps.durations[1]} seconds.` : `${m.label} makes clips of ${caps.durations[0]} to ${caps.durations[caps.durations.length - 1]} seconds.` };

  const body: Record<string, unknown> = {};
  if (prompt || caps.promptRequired) body.prompt = prompt;
  body.duration = input.duration;
  if (shots.length) { body.multi_shots = true; body.multi_prompt = shots.map((sh) => ({ prompt: sh.prompt.trim(), duration: sh.duration })); }
  if (caps.qualities.length) {
    const res = input.resolution ?? caps.defaultQuality;
    if (!caps.qualities.includes(res)) return { ok: false, error: `${m.label} does not support the ${res} quality.` };
    body.resolution = res;
  }
  if (caps.ratios.length) {
    const ratio = input.aspectRatio ?? caps.defaultRatio;
    if (!caps.ratios.includes(ratio)) return { ok: false, error: `${m.label} does not support the ${ratio} aspect ratio.` };
    body.aspect_ratio = ratio;
  }
  const e = eff(l, wf);
  if (e.audio) {
    const on = input.audio ?? e.audio.default;
    body[e.audio.field] = e.audio.kind === "onoff" ? (on ? "on" : "off") : on;
  }
  if (e.seed && input.seed != null) {
    if (!Number.isInteger(input.seed) || input.seed < e.seed.min || input.seed > e.seed.max) return { ok: false, error: `The seed must be a whole number from ${e.seed.min.toLocaleString("en-US")} to ${e.seed.max.toLocaleString("en-US")} for ${m.label}.` };
    body.seed = input.seed;
  }
  if (l.fixed) Object.assign(body, l.fixed);
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
    if (refAudio.length) body.audio_urls = refAudio;
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

// Motion transfer (the Motion chip): a subject picture and ONE motion clip. The length follows the clip, so no duration is sent.
function buildMotionBody(m: VideoModel, l: VideoLive, input: VideoInput): BuildResult {
  const motion = l.motion;
  if (!motion) return { ok: false, error: `${m.label} has no motion mode connected.` };
  const endpoint = l.endpoints.motion;
  if (!endpoint) return { ok: false, error: `${m.label} has no motion mode connected.` };
  const clips = input.refVideoUrls ?? [];
  if (!input.startUrl) return { ok: false, error: "Choose the subject picture (Start frame) first." };
  if (clips.length !== 1) return { ok: false, error: "Choose one motion clip." };
  if (input.endUrl || (input.refUrls?.length ?? 0) > 0) return { ok: false, error: "Motion transfer takes one subject picture and one motion clip." };
  const prompt = input.prompt.trim();
  if (prompt.length > l.promptMax) return { ok: false, error: `${m.label} accepts prompts up to ${l.promptMax} characters (yours is ${prompt.length}).` };
  const body: Record<string, unknown> = {};
  if (motion.kind === "kling") {
    if (prompt) body.prompt = prompt;
    body.image_url = input.startUrl;
    body.video_url = clips[0];
    body.keep_original_sound = (input.keepSound ?? true) ? "yes" : "no"; // a word, not a boolean
    const orient = input.orientation ?? "video";
    if (orient !== "image" && orient !== "video") return { ok: false, error: "The facing direction must follow the picture or the video." };
    body.character_orientation = orient;
  } else {
    body.video_url = clips[0];
    body.image_urls = [input.startUrl];
    if (prompt) body.prompt = prompt;
    const caps = capsFor(m, "motion");
    const res = input.resolution ?? caps.defaultQuality;
    if (!caps.qualities.includes(res)) return { ok: false, error: `${m.label} does not support the ${res} quality.` };
    body.resolution = res;
  }
  return { ok: true, workflow: "motion", endpoint, body };
}
