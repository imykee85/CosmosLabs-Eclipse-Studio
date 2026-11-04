// Atlas plans (owner 2026-11-04, Scale only): Atlas plans a small production and the person approves it ONCE. It makes a hero image, then the pictures the video
// needs (as many as Atlas decides), then ONE video that uses all of them as references. Pure and browser-safe: the server cleans what Atlas proposed, the browser runs it.
export const MAX_SCENES = 8;
export type PlanSpec = {
  title: string;
  hero: string;          // the prompt for the hero image
  scenes: string[];      // one prompt per extra picture, made from the hero so the look stays the same
  video: string;         // the motion prompt for the video
  seconds: number;       // length of the video
  ratio: string;         // aspect ratio of the pictures and the video
};
export type StepState = "waiting" | "running" | "done" | "failed";
export type PlanStep = { id: string; kind: "hero" | "scenes" | "video"; label: string; state: StepState; ids?: string[]; error?: string };
export type PlanState = {
  spec: PlanSpec;
  steps: PlanStep[];
  status: "ready" | "running" | "done" | "failed" | "canceled";
  price?: number | null; // total in ledger units, when it could be worked out
  note?: string;
};

const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** What Atlas proposed, cleaned: null when it is not a usable plan. */
export function cleanPlan(i: Record<string, unknown>): PlanSpec | null {
  const hero = clip(i.hero_prompt, 4000);
  const video = clip(i.video_prompt, 4000);
  const scenes = (Array.isArray(i.scenes) ? i.scenes : []).map((s) => clip(s, 4000)).filter(Boolean).slice(0, MAX_SCENES);
  if (!hero || !video || scenes.length < 1) return null;
  const sec = Number(i.duration_seconds);
  const seconds = Number.isFinite(sec) ? Math.min(30, Math.max(4, Math.round(sec))) : 8;
  const ratio = typeof i.aspect_ratio === "string" && RATIOS.includes(i.aspect_ratio) ? i.aspect_ratio : "16:9";
  return { title: clip(i.title, 80) || "Production plan", hero, scenes, video, seconds, ratio };
}

export function newPlan(spec: PlanSpec, price?: number | null): PlanState {
  return {
    spec, status: "ready", price,
    steps: [
      { id: "hero", kind: "hero", label: "Hero image", state: "waiting" },
      { id: "scenes", kind: "scenes", label: `${spec.scenes.length} more picture${spec.scenes.length === 1 ? "" : "s"} from the hero`, state: "waiting" },
      { id: "video", kind: "video", label: `${spec.seconds}-second video from all ${spec.scenes.length + 1} pictures`, state: "waiting" },
    ],
  };
}
