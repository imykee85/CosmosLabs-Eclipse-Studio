// The video models Video Studio offers, with the settings each one takes (read from Higgsfield's model catalog, 2026-10-10): shapes, lengths,
// quality, whether it makes sound, and whether it takes a start frame, an end frame or reference pictures.
// NOT connected to generation yet: the request address and field names of each video model's REST page are still needed (the sandbox cannot read them),
// so `endpoint` stays null and Video Studio's Generate says so. Add `endpoint` (and the body fields) per model when its page is supplied.
export type VideoModel = {
  id: string;                  // Higgsfield catalog id
  label: string;
  maker: string;
  blurb: string;
  ratios: string[];            // "auto" lets the model pick
  durations: number[];         // allowed lengths in seconds
  qualities: string[];         // resolution or mode names; empty = one fixed quality
  sound: "toggle" | "none";    // can sound be switched on or off
  startFrame: boolean;
  endFrame: boolean;
  refImages: number;           // reference pictures (0 = none); counts are not stated by the catalog, so kept conservative
  endpoint: string | null;
};

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const R3 = ["16:9", "9:16", "1:1"];
const RWIDE = ["auto", "16:9", "9:16", "4:3", "3:4", "1:1", "21:9"];

export const VIDEO_MODELS: VideoModel[] = [
  { id: "kling3_0", label: "Kling 3.0", maker: "Kling", blurb: "Multi-shot, audio sync and motion transfer.", ratios: R3, durations: range(3, 15), qualities: ["Standard", "Pro", "4K"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, endpoint: null },
  { id: "kling3_0_turbo", label: "Kling 3.0 Turbo", maker: "Kling", blurb: "Fast text-to-video and start-frame animation.", ratios: R3, durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, endpoint: null },
  { id: "kling_o3_image_reference", label: "Kling 3.0 Omni", maker: "Kling", blurb: "Video from text and several reference pictures.", ratios: R3, durations: range(3, 15), qualities: ["Standard", "Pro", "4K"], sound: "toggle", startFrame: false, endFrame: false, refImages: 7, endpoint: null },
  { id: "kling2_6", label: "Kling 2.6", maker: "Kling", blurb: "Cinematic motion and physics.", ratios: R3, durations: [5, 10], qualities: [], sound: "toggle", startFrame: true, endFrame: false, refImages: 0, endpoint: null },
  { id: "seedance_2_0", label: "Seedance 2.0", maker: "Bytedance", blurb: "Reference-driven video with consistent identity.", ratios: RWIDE, durations: range(4, 15), qualities: ["480p", "720p", "1080p", "4K"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "seedance_2_0_mini", label: "Seedance 2.0 Mini", maker: "Bytedance", blurb: "Fast, budget Seedance 2.0.", ratios: RWIDE, durations: range(4, 15), qualities: ["480p", "720p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "seedance_2_5", label: "Seedance 2.5", maker: "Bytedance", blurb: "Text-to-video and references, up to 30 seconds.", ratios: RWIDE, durations: range(4, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "seedance1_5", label: "Seedance 1.5 Pro", maker: "Bytedance", blurb: "Reliable motion, improved quality.", ratios: RWIDE, durations: [4, 8, 12], qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, endpoint: null },
  { id: "cinematic_studio_3_0", label: "Cinema Studio Video 3.0", maker: "Higgsfield", blurb: "Cinema-grade video, the most advanced.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(4, 15), qualities: ["480p", "720p", "1080p", "4K"], sound: "toggle", startFrame: true, endFrame: true, refImages: 0, endpoint: null },
  { id: "cinematic_studio_video_4_0", label: "Cinema Studio 4.0", maker: "Higgsfield", blurb: "Automatic direction with camera, lighting and genre.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(4, 30), qualities: ["480p", "720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "grok_video_v15", label: "Grok Video 1.5", maker: "xAI", blurb: "Text, a start picture, or picture and audio references.", ratios: ["auto"], durations: range(2, 15), qualities: ["480p", "720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, endpoint: null },
  { id: "grok_video_v15_lite", label: "Grok Imagine Video 1.5 Lite", maker: "xAI", blurb: "Fast text and first-frame video.", ratios: ["auto", "16:9", "9:16", "4:3", "3:4", "1:1", "3:2", "2:3"], durations: range(1, 15), qualities: ["480p", "720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, endpoint: null },
  { id: "minimax_h3", label: "MiniMax H3", maker: "MiniMax", blurb: "Keyframes or references, 2K.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(4, 15), qualities: ["2K"], sound: "none", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "minimax_h3_max", label: "MiniMax H3 Max", maker: "MiniMax", blurb: "Fast text-to-video and keyframes.", ratios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 15), qualities: ["480p", "768p"], sound: "none", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
  { id: "minimax_hailuo", label: "Hailuo", maker: "MiniMax", blurb: "Natural physics and facial emotion.", ratios: ["auto"], durations: [6, 10], qualities: ["512", "768", "1080"], sound: "none", startFrame: true, endFrame: true, refImages: 0, endpoint: null },
  { id: "wan2_6", label: "Wan 2.6", maker: "Wan", blurb: "Stylised, experimental and creative.", ratios: R3, durations: [5, 10, 15], qualities: ["720p", "1080p"], sound: "none", startFrame: false, endFrame: false, refImages: 4, endpoint: null },
  { id: "happy_horse_video", label: "Happy Horse Video", maker: "Happy Horse", blurb: "Text-to-video and start-frame animation.", ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"], durations: range(3, 15), qualities: ["720p", "1080p"], sound: "none", startFrame: true, endFrame: false, refImages: 0, endpoint: null },
  { id: "flux_3_video", label: "FLUX 3 Video", maker: "Black Forest Labs", blurb: "Text, multi-frame and continuation, with sound.", ratios: ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: range(5, 20), qualities: ["720p", "1080p"], sound: "toggle", startFrame: true, endFrame: true, refImages: 4, endpoint: null },
];

export const DEFAULT_VIDEO_MODEL = "kling3_0";
export const videoModelById = (id: string | null | undefined): VideoModel => VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
