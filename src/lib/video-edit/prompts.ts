// Eclone: builds the edit prompt for a change to an existing video, from the tested presets in presets.json.
// The rules are ported from the open-source scenario-alter skill (see NOTICE.md). Same inputs give the same prompt text.
import data from "./presets.json";

export const FEATURE_NAME = "Eclone";
export const MAX_PROMPT = 10000;

type Preset = { name: string; group: string; mode: "O" | "M" | "R"; target_frame?: boolean | "optional"; change: string; style?: string; opening?: string; fill?: Record<string, string>; refs?: string[]; check: string; unreliable?: boolean; note?: string };
type Data = { openings: Record<string, string>; close: Record<string, string>; presets: Preset[]; restyle_target_frame: string; restyle_style_image: string };
const D = data as unknown as Data;

export const PRESETS = D.presets;
export const findPreset = (name: string): Preset | undefined => D.presets.find((p) => p.name === name);

const SLOT = /\{([a-z_]+)\}/g;
const IMAGE_TAG = /@image(\d+)/g;
// phrases that make a restyle come back unchanged (tested: the model keeps the photo)
const RESTYLE_KEEPS = /\b(keep|keeps|keeping|preserve|retain|maintain|leave|do not change|don't change|unchanged|same)\b[^.;]{0,40}?\b(everything|light|lighting|sunlight|set|background|scenery|scene|look|colou?rs?|grade|photo|photographic|photoreal(istic)?|realism|realistic)\b/i;
// clothes named in "who" make an outfit swap contradict itself
const CLOTHES = /\b(hoodie|jacket|coat|shirt|t-shirt|tee|sweater|jumper|dress|suit|top|jeans|trousers|skirt|shorts|blazer|cardigan|uniform|outfit|vest)\b/i;
const CLOTHING_PRESETS = new Set(["outfit", "costume", "season-outfit"]);

export class EditPromptError extends Error {
  constructor(public problems: string[]) { super(problems.join(" ")); }
}

export type EditInput = {
  preset: string;
  who?: string;
  values?: Record<string, string>;
  extra?: string;
  imageCount?: number;      // reference pictures attached (target frame or style frame)
  styleImage?: boolean;     // restyle only: the picture is a frame of another film, used for style alone
};

export type EditPrompt = { prompt: string; notes: string[]; mode: Preset["mode"] };

// Fills the slots of one text; returns the missing slot names if any.
function fill(text: string, values: Record<string, string>): { out: string; missing: string[] } {
  const missing = [...new Set([...text.matchAll(SLOT)].map((m) => m[1]).filter((k) => !(k in values)))];
  return { out: text.replace(SLOT, (_, k: string) => values[k]), missing };
}

export function buildEditPrompt(input: EditInput): EditPrompt {
  const p = findPreset(input.preset);
  if (!p) throw new EditPromptError([`Unknown edit preset "${input.preset}".`]);
  const values: Record<string, string> = { ...(input.values ?? {}) };
  if (input.who) values.who = input.who.trim();
  const key = p.opening ?? p.mode;
  let opening = D.openings[key];
  const binding = p.mode === "R" && (input.imageCount ?? 0) > 0 ? (input.styleImage ? D.restyle_style_image : D.restyle_target_frame) : null;
  if (p.mode === "R") {
    opening = opening.replace("{style}", p.style ?? "");
    if (binding) {
      const i = opening.indexOf(". ");
      opening = `${opening.slice(0, i)}. ${binding} ${opening.slice(i + 2)}`;
    }
  }
  const raw = [opening, p.change, D.close[key]].join(" ");
  let { out, missing } = fill(raw, values);
  if (missing.length) {
    const hints = (k: string) => (k === "who" ? 'the person or subject as seen in the source, e.g. "the man in the olive hoodie"' : p.fill?.[k] ?? "");
    throw new EditPromptError(missing.map((k) => `Fill "${k}" (${hints(k)}).`));
  }
  // a {who} that opens a sentence is written in lower case by the user: capitalise sentence starts
  out = out.replace(/(^|[.!?] )([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  if (input.extra?.trim()) {
    const close = D.close[key];
    out = `${out.slice(0, out.length - close.length)}${input.extra.trim().replace(/\.$/, "")}. ${close}`;
  }

  const problems: string[] = [];
  const notes: string[] = [];
  const named = [...out.matchAll(IMAGE_TAG)].map((m) => Number(m[1]));
  const images = input.imageCount ?? 0;
  if (p.mode === "R") {
    if (RESTYLE_KEEPS.test(Object.values(values).join(" ") + " " + (input.extra ?? ""))) {
      problems.push("A restyle must not ask to keep the light, the set or everything: the model then returns the source unchanged. Remove that wording.");
    }
    if (images > 1) problems.push("A restyle takes one picture: the target frame (or, with a style frame, one style frame).");
  }
  if (named.length && images === 0) problems.push(`This edit names @image${Math.max(...named)} but no picture was attached. ${(p.refs ?? []).join("; ")}`);
  if (images > 0 && named.length && images > Math.max(...named)) notes.push(`${images} pictures attached, the prompt names ${Math.max(...named)}: bind the extra ones with the extra sentence.`);
  if (CLOTHING_PRESETS.has(p.name) && CLOTHES.test(values.who ?? "")) {
    notes.push("The clothes named above change: describe the person without them, or the prompt asks to keep what it then replaces.");
  }
  const used = new Set([...(D.openings[key] + (p.style ?? "") + p.change).matchAll(SLOT)].map((m) => m[1]));
  const unused = Object.keys(values).filter((k) => !used.has(k));
  if (unused.length) notes.push(`Ignored fields (this preset has no such slot): ${unused.join(", ")}.`);
  if (out.length > MAX_PROMPT) problems.push(`The prompt is ${out.length} characters; keep it under ${MAX_PROMPT}.`);
  if (p.unreliable) notes.push("This edit is unreliable: it often stays photographic. Try a 3D feature or anime look.");
  if (p.note) notes.push(p.note);
  if (problems.length) throw new EditPromptError(problems);
  return { prompt: out, notes, mode: p.mode };
}

// The run parameters for the edit model: the source video as the only reference, output length follows the source, no new sound
// unless asked, and a 480p draft (finalised later) unless a final resolution is asked for.
export function editRunParams(args: { prompt: string; sourceVideoId: string; imageIds: string[]; resolution: "480p" | "720p" | "1080p"; newAudio: boolean }) {
  return {
    prompt: args.prompt,
    referenceVideos: [args.sourceVideoId],
    ...(args.imageIds.length ? { referenceImages: args.imageIds } : {}),
    duration: -1,
    generateAudio: args.newAudio,
    ...(args.resolution === "480p" ? { draft: true } : { resolution: args.resolution }),
  };
}
