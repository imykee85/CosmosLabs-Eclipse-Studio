// Models Orbit's agents can run on. Auto is the default; the Claude models are the ones the backend plan calls for
// (docs/backend-design.md section 7). Descriptions are Eclipse's own wording. Nothing is connected yet.
export type OrbitModel = { id: string; name: string; blurb: string; icon: "auto" | "deep" | "balanced" | "fast"; tag?: string };

export const orbitModels: OrbitModel[] = [
  { id: "auto", name: "Auto", blurb: "Picks the right model for each request", icon: "auto", tag: "Recommended" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", blurb: "Deepest thinking for big concepts and hard problems", icon: "deep" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", blurb: "Balanced speed and quality for everyday work", icon: "balanced" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", blurb: "Fastest, for quick answers and small edits", icon: "fast" },
];

export const MODEL_KEY = "eclipse-orbit-model";
