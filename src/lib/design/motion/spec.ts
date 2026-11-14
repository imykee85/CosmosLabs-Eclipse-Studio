// Design Studio Motion: the shared, browser-safe shapes (settings, versions, brand kits) and the fixed lists the screens offer.

export const MOTION_ASPECTS = ["16:9", "9:16", "1:1", "4:5", "4:3", "21:9"] as const;
export type MotionAspect = (typeof MOTION_ASPECTS)[number];
export const ASPECT_HINT: Record<MotionAspect, string> = {
  "16:9": "YouTube, slides and websites", "9:16": "Reels, Shorts and Stories", "1:1": "Social posts", "4:5": "Feed posts", "4:3": "Presentations", "21:9": "Cinematic banners",
};
/** Logical drawing space: the short side is always 1000 units, so a motion looks the same at any export size. */
export function logicalSize(a: MotionAspect): { W: number; H: number } {
  const [w, h] = a.split(":").map(Number), r = w / h;
  return r >= 1 ? { W: Math.round(1000 * r), H: 1000 } : { W: 1000, H: Math.round(1000 / r) };
}
/** Pixel size for a short side (1080 or 2160), both sides even. */
export function pixelSize(a: MotionAspect, short: number): { w: number; h: number } {
  const { W, H } = logicalSize(a), even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return W >= H ? { w: even((short * W) / H), h: short } : { w: short, h: even((short * H) / W) };
}

export const DURATIONS = [5, 10, 15, 30, 60] as const; // "Auto" lets the agent choose (4 to 60 s)
export const MAX_SECONDS = 60;
export const MIN_SECONDS = 2;

export const MOTION_MODELS = [
  { id: "claude-sonnet-5-5", name: "Eclipse Pro", blurb: "Balanced quality and speed" },
  { id: "claude-opus-5-5", name: "Eclipse Max", blurb: "Most inventive motion, about 2x the credits" },
  { id: "claude-haiku-5-5", name: "Eclipse Lite", blurb: "Quick drafts and small edits" },
] as const;
export type MotionModelId = (typeof MOTION_MODELS)[number]["id"];

export type MotionAudioChoice = { sfx: boolean; music: boolean; voice: boolean };
export type MotionSettings = {
  aspect: MotionAspect; duration: number | "auto"; loop: boolean; audio: MotionAudioChoice;
  brandKitId: string | null; model: MotionModelId; approval: "ask" | "auto";
  refs: { type: "upload" | "render"; id: string; label?: string }[];
  // The person's own finished videos the motion may play (M.clips): background plates, b-roll. Duration is filled in by the server.
  clips: MotionClip[];
  // Which models Atlas uses when it makes pictures and clips for the motion, and which voice speaks the voiceover. null = Eclipse picks.
  defaults: MotionDefaults;
};
export type MotionClip = { id: string; label?: string; duration?: number };
export type MotionDefaults = { image: string | null; video: string | null; voiceModel: string | null; voiceId: string | null; voiceName: string | null };
export const NO_DEFAULTS: MotionDefaults = { image: null, video: null, voiceModel: null, voiceId: null, voiceName: null };
export const MAX_CLIPS = 4;
export const DEFAULT_SETTINGS: MotionSettings = {
  aspect: "16:9", duration: "auto", loop: false, audio: { sfx: false, music: false, voice: false }, brandKitId: null, model: "claude-sonnet-5-5", approval: "ask", refs: [], clips: [], defaults: NO_DEFAULTS,
};

export type MotionComment = { id: string; t: number; x: number; y: number; text: string; at: string; used?: boolean };
export type AudioPart = { prompt: string; credits?: number | null; jobId?: string | null; status?: string; error?: string | null };
export type MotionAudio = { voice?: AudioPart; music?: AudioPart; sfx?: AudioPart; approval?: "waiting" | "approved" | "declined" };

export type MotionStatus = "planning" | "writing" | "reviewing" | "approval" | "finishing" | "ready" | "failed" | "stopped";
export const STEP_OF: Record<MotionStatus, number> = { planning: 0, writing: 1, reviewing: 2, approval: 3, finishing: 3, ready: 4, failed: 4, stopped: 4 };
export const RUNNING = new Set<MotionStatus>(["planning", "writing", "reviewing", "finishing"]);

export type MotionVersionItem = {
  id: string; n: number; parentId: string | null; label: string; kind: string; aspect: MotionAspect; duration: number; status: MotionStatus; error: string | null;
  code: string | null; plan: string | null; audio: MotionAudio | null; comments: MotionComment[]; credits: number; starred: boolean; createdAt: string; updatedAt: string;
};
export type MotionItem = { id: string; title: string; prompt: string; settings: MotionSettings; createdAt: string; updatedAt: string; versions: MotionVersionItem[]; thumb?: string | null };
export type MotionSummary = { id: string; title: string; prompt: string; aspect: MotionAspect; versions: number; updatedAt: string; status: MotionStatus | null };

export type BrandKitItem = { id: string; name: string; colors: string[]; fonts: { display: string; body: string }; logos: { type: "upload" | "render"; id: string }[]; notes: string; examples: string[]; updatedAt: string };

/** Fonts the runtime really draws (Inter is shipped; the rest are the device's own families). */
export const FONT_FAMILIES = ["Inter", "Serif", "Mono", "Condensed"] as const;

export const SUGGESTIONS = ["Smoother easing", "Speed it up", "Add sound effects", "Try 9:16"] as const;

export const TEMPLATES: { id: string; name: string; aspect: MotionAspect; duration: number; prompt: string }[] = [
  { id: "kinetic", name: "Kinetic typography", aspect: "16:9", duration: 10, prompt: "Bold sports kinetic typography.\n0 to 2s: \"GO\" grows and splits.\n2 to 4s: \"BEYOND\" moves in a weight wave.\n4 to 7s: \"EVERY STEP\" repeats, then becomes a ribbon.\n7 to 10s: \"MAKE YOUR NEXT MOVE.\" assembles and settles." },
  { id: "logo", name: "Logo reveal", aspect: "16:9", duration: 6, prompt: "A clean logo reveal: a thin line draws a circle, the mark fades up from the centre with a soft glow, the wordmark slides in letter by letter, then everything settles and holds." },
  { id: "launch", name: "Product launch", aspect: "16:9", duration: 12, prompt: "A product launch film for an app: dark background, three feature cards fly in one after another with smooth parallax, a big headline \"Now available\", a call to action button pulses at the end." },
  { id: "stats", name: "Stats counter", aspect: "1:1", duration: 8, prompt: "An animated stats post: \"100K followers\" counts up from zero, confetti dots burst outward, a thank-you line types on underneath." },
  { id: "lower", name: "Lower thirds", aspect: "16:9", duration: 6, prompt: "A modern lower-third title for an interview: a coloured bar wipes in, the name and role slide in on two lines, hold, then wipe out." },
  { id: "story", name: "Story promo", aspect: "9:16", duration: 10, prompt: "A vertical promo for a summer sale: big \"SUMMER SALE\" in two lines bouncing in, \"UP TO 50% OFF\" stamps down, shapes drift in the background, swipe-up arrow at the end." },
  { id: "chart", name: "Animated chart", aspect: "16:9", duration: 10, prompt: "An animated bar chart of monthly revenue Jan to Jun growing from 20 to 95, bars rise one after another with values counting up, a trend line draws across, a headline \"Up 375%\"." },
  { id: "loop", name: "Background loop", aspect: "16:9", duration: 8, prompt: "A calm looping background: soft gradient blobs slowly drift and blend, fine particles float upward. The end matches the start so it loops without a seam." },
];

export const isAspect = (v: unknown): v is MotionAspect => typeof v === "string" && (MOTION_ASPECTS as readonly string[]).includes(v);

/** Cleans settings from the browser: known values only, numbers clamped. */
export function cleanSettings(raw: unknown): MotionSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const a = (o.audio && typeof o.audio === "object" ? o.audio : {}) as Record<string, unknown>;
  const d = o.duration === "auto" ? "auto" : Number(o.duration);
  const refs = Array.isArray(o.refs) ? (o.refs as unknown[]).flatMap((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    return (x.type === "upload" || x.type === "render") && typeof x.id === "string" && x.id.length <= 64 ? [{ type: x.type as "upload" | "render", id: x.id, ...(typeof x.label === "string" ? { label: x.label.slice(0, 80) } : {}) }] : [];
  }).slice(0, 8) : [];
  const clips = Array.isArray(o.clips) ? (o.clips as unknown[]).flatMap((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    return typeof x.id === "string" && x.id.length <= 64 ? [{ id: x.id, ...(typeof x.label === "string" ? { label: x.label.slice(0, 80) } : {}), ...(Number.isFinite(Number(x.duration)) && Number(x.duration) > 0 ? { duration: Math.min(600, Number(x.duration)) } : {}) }] : [];
  }).slice(0, MAX_CLIPS) : [];
  const df = (o.defaults && typeof o.defaults === "object" ? o.defaults : {}) as Record<string, unknown>;
  const str = (v: unknown, n = 64) => (typeof v === "string" && v.trim() && v.length <= n ? v.trim() : null);
  const defaults: MotionDefaults = { image: str(df.image), video: str(df.video), voiceModel: str(df.voiceModel), voiceId: str(df.voiceId, 120), voiceName: str(df.voiceName, 80) };
  return {
    aspect: isAspect(o.aspect) ? o.aspect : "16:9",
    duration: d === "auto" ? "auto" : Number.isFinite(d) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round((d as number) * 10) / 10)) : "auto",
    loop: o.loop === true,
    audio: { sfx: a.sfx === true, music: a.music === true, voice: a.voice === true },
    brandKitId: typeof o.brandKitId === "string" && o.brandKitId.length <= 64 ? o.brandKitId : null,
    model: MOTION_MODELS.some((m) => m.id === o.model) ? (o.model as MotionModelId) : "claude-sonnet-5-5",
    approval: o.approval === "auto" ? "auto" : "ask",
    refs, clips, defaults,
  };
}

/** Hex colours (#rgb, #rrggbb) used in a motion's code, most used first: the palette of "Create brand kit from this motion". */
export function colorsInCode(code: string, max = 6): string[] {
  const counts = new Map<string, number>();
  for (const m of code.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1].toLowerCase(); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    counts.set(`#${h}`, (counts.get(`#${h}`) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
}
