// A treatment: the plan for a video, built up in the Treatment chat (Brief, Concept or Guide) and carried on to Prompts and Video Studio.
export type Treatment = { title: string; logline: string; audience: string; goal: string; tone: string; look: string; structure: string[]; notes: string };
export const EMPTY_TREATMENT: Treatment = { title: "", logline: "", audience: "", goal: "", tone: "", look: "", structure: [], notes: "" };

const LIMITS: Record<Exclude<keyof Treatment, "structure">, number> = { title: 80, logline: 300, audience: 300, goal: 300, tone: 200, look: 400, notes: 800 };
const FIELDS = Object.keys(LIMITS) as (keyof typeof LIMITS)[];
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

// Reads whatever came back (from the model or from this browser's storage) into a safe treatment; unknown fields are dropped, long ones cut.
export function cleanTreatment(input: unknown): Treatment {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const t: Treatment = { ...EMPTY_TREATMENT, structure: [] };
  for (const f of FIELDS) t[f] = clip(o[f], LIMITS[f]);
  if (Array.isArray(o.structure)) t.structure = o.structure.map((s) => clip(s, 220)).filter(Boolean).slice(0, 12);
  return t;
}

// An update from the model changes only the fields it sends; the rest stay as they were.
export function mergeTreatment(current: Treatment, update: unknown): Treatment {
  const u = (update && typeof update === "object" ? update : {}) as Record<string, unknown>;
  const next = { ...current, structure: [...current.structure] };
  for (const f of FIELDS) if (typeof u[f] === "string") next[f] = clip(u[f], LIMITS[f]);
  if (Array.isArray(u.structure)) next.structure = cleanTreatment({ structure: u.structure }).structure;
  return next;
}

export const hasTreatment = (t: Treatment) => FIELDS.some((f) => t[f]) || t.structure.length > 0;

const LABELS: Record<keyof Omit<Treatment, "structure">, string> = { title: "Title", logline: "Idea", audience: "Audience", goal: "Goal", tone: "Tone", look: "Look", notes: "Notes" };

/** The treatment as plain text: what Prompts, Atlas and the Copy button receive. */
export function treatmentText(t: Treatment): string {
  const lines = (Object.keys(LABELS) as (keyof typeof LABELS)[]).filter((f) => t[f]).map((f) => `${LABELS[f]}: ${t[f]}`);
  if (t.structure.length) lines.push("Structure:", ...t.structure.map((s, i) => `${i + 1}. ${s}`));
  return lines.join("\n");
}
