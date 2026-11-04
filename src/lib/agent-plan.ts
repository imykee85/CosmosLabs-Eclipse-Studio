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
  refs?: PlanRef[];      // pictures the person gave Atlas in the conversation, used as references for every picture and the video
};
export type PlanRef = { type: "upload" | "render"; id: string };
export const MAX_PLAN_REFS = 4;
export type StepState = "waiting" | "running" | "done" | "failed";
export type PlanStep = { id: string; kind: "hero" | "scenes" | "video"; label: string; state: StepState; ids?: string[]; error?: string };
export type PlanState = {
  id?: string;           // the saved plan on the server, once approved
  spec: PlanSpec;
  steps: PlanStep[];
  status: "ready" | "running" | "done" | "failed" | "canceled";
  price?: number | null; // total in ledger units, when it could be worked out
  note?: string;
};

const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** What Atlas proposed, cleaned: null when it is not a usable plan. */
export function cleanRefs(v: unknown): PlanRef[] {
  const seen = new Set<string>();
  const out: PlanRef[] = [];
  for (const r of (Array.isArray(v) ? v : []) as { type?: unknown; id?: unknown }[]) {
    if ((r?.type !== "upload" && r?.type !== "render") || typeof r.id !== "string" || !r.id || r.id.length > 64 || seen.has(`${r.type}:${r.id}`)) continue;
    seen.add(`${r.type}:${r.id}`);
    out.push({ type: r.type, id: r.id });
    if (out.length >= MAX_PLAN_REFS) break;
  }
  return out;
}

/** `pictures` are the ones the person attached, in the order Atlas was shown them (Picture 1, Picture 2, ...); Atlas names the ones the plan should use by number. */
export function cleanPlan(i: Record<string, unknown>, pictures: PlanRef[] = []): PlanSpec | null {
  const hero = clip(i.hero_prompt, 4000);
  const video = clip(i.video_prompt, 4000);
  const scenes = (Array.isArray(i.scenes) ? i.scenes : []).map((s) => clip(s, 4000)).filter(Boolean).slice(0, MAX_SCENES);
  if (!hero || !video || scenes.length < 1) return null;
  const sec = Number(i.duration_seconds);
  const seconds = Number.isFinite(sec) ? Math.min(30, Math.max(4, Math.round(sec))) : 8;
  const ratio = typeof i.aspect_ratio === "string" && RATIOS.includes(i.aspect_ratio) ? i.aspect_ratio : "16:9";
  const nums = Array.isArray(i.reference_pictures) ? (i.reference_pictures as unknown[]) : [];
  const refs = cleanRefs(nums.flatMap((n) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= pictures.length ? [pictures[(n as number) - 1]] : [])));
  return { title: clip(i.title, 80) || "Production plan", hero, scenes, video, seconds, ratio, ...(refs.length ? { refs } : {}) };
}

export function newPlan(spec: PlanSpec, price?: number | null): PlanState {
  return {
    spec, status: "ready", price,
    steps: [
      { id: "hero", kind: "hero", label: spec.refs?.length ? `Hero image from your ${spec.refs.length} picture${spec.refs.length === 1 ? "" : "s"}` : "Hero image", state: "waiting" },
      { id: "scenes", kind: "scenes", label: `${spec.scenes.length} more picture${spec.scenes.length === 1 ? "" : "s"} from the hero`, state: "waiting" },
      { id: "video", kind: "video", label: `${spec.seconds}-second video from all ${spec.scenes.length + 1} pictures`, state: "waiting" },
    ],
  };
}

/** A plan spec sent by the browser, checked again on the server (the browser's copy is never trusted). */
export function cleanSpec(v: unknown): PlanSpec | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const spec = cleanPlan({ title: o.title, hero_prompt: o.hero, scenes: o.scenes, video_prompt: o.video, duration_seconds: o.seconds, aspect_ratio: o.ratio });
  const refs = cleanRefs(o.refs);
  return spec && refs.length ? { ...spec, refs } : spec;
}
