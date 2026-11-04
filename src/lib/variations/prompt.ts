// Variations: one reference picture in, a set of controlled variations out. Four modes (Reframe, Storyboard, People, Custom).
// The page picks a mode, its options and a grid size; this turns them into ONE instruction per cell. Each cell is its own render from the
// same picture, so a failed cell never spoils the others. The name lives here.
export const FEATURE_NAME = "Variations";

export const GRIDS = ["1x2", "2x1", "2x2", "2x3", "3x2", "2x4", "4x2", "3x3"] as const;
export type GridId = (typeof GRIDS)[number];
export const gridCount = (g: GridId) => { const [a, b] = g.split("x").map(Number); return a * b; };
export const MAX_CELLS = 9;

export type ModeId = "reframe" | "storyboard" | "people" | "custom";
export type PeopleId = "demographics" | "expressions" | "age";
export const MODES: { id: ModeId; label: string; hint: string }[] = [
  { id: "reframe", label: "Reframe", hint: "Create different angles and perspectives of your image." },
  { id: "storyboard", label: "Storyboard", hint: "Generate a cinematic storyboard." },
  { id: "people", label: "People", hint: "Vary facial features, expressions, and demographics." },
  { id: "custom", label: "Custom", hint: "Generate custom variations based on your prompt." },
];
export const PEOPLE: { id: PeopleId; label: string; hint: string }[] = [
  { id: "demographics", label: "Demographics", hint: "Explore different ethnicities and genders while maintaining the original composition." },
  { id: "expressions", label: "Expressions", hint: "Generate variations with different facial expressions." },
  { id: "age", label: "Age", hint: "Generate variations with different ages." },
];

export const PERSPECTIVES: { id: string; label: string; text: string }[] = [
  { id: "ext_long", label: "Ext. long shot", text: "an extreme long shot, the subject small in a wide surrounding space" },
  { id: "long", label: "Long shot", text: "a long shot, the whole subject visible with space around it" },
  { id: "closeup", label: "Closeup", text: "a close-up" },
  { id: "medium_long", label: "Medium long", text: "a medium long shot" },
  { id: "ext_closeup", label: "Extreme closeup", text: "an extreme close-up on a detail of the subject" },
  { id: "low", label: "Low angle", text: "a low angle looking up at the subject" },
  { id: "back", label: "Back view", text: "a back view, seen from directly behind the subject" },
  { id: "med_closeup", label: "Med. closeup", text: "a medium close-up" },
  { id: "high", label: "High angle", text: "a high angle looking down at the subject" },
  { id: "ots", label: "OTS", text: "an over-the-shoulder view" },
  { id: "wide", label: "Wide", text: "a wide shot with a lot of the surroundings" },
  { id: "pov", label: "POV", text: "a point-of-view shot, as if seen through the subject's eyes" },
  { id: "aerial", label: "Aerial", text: "an aerial view from high above" },
  { id: "eye", label: "Eye level", text: "an eye-level view straight on to the subject" },
  { id: "profile", label: "Profile", text: "a profile view from the side" },
  { id: "three_q", label: "3/4 view", text: "a three-quarter view" },
];
export const defaultPerspectives = (n: number) => PERSPECTIVES.slice(0, n).map((p) => p.id);

// Lists are plain data so they can be edited without touching the logic.
export const ETHNICITIES = ["South Asian", "East Asian", "Southeast Asian", "Middle Eastern", "North African", "Sub-Saharan African", "East African", "West African", "European", "Scandinavian", "Slavic", "Mediterranean", "Hispanic/Latino", "Mestizo", "Caribbean", "Pacific Islander", "Indigenous/Native American", "Central Asian", "Japanese", "Korean", "Chinese", "Indian", "Persian", "Arab", "Multiracial"];
export type GenderId = "male" | "female" | "both";
export const GENDERS: { id: GenderId; label: string }[] = [{ id: "male", label: "Male" }, { id: "female", label: "Female" }, { id: "both", label: "Both" }];

const EXPRESSIONS = ["a warm smile", "a big laugh", "a serious, calm look", "a look of surprise", "a thoughtful, distant look", "a soft, gentle smile", "a confident smirk", "a worried look", "a joyful, bright expression"];
// Real photos start at adult: no children, whatever the person asks.
const AGES = ["a young adult around 20", "an adult around 30", "an adult around 40", "a middle-aged person around 50", "an older person around 65", "an elderly person around 80"];
const BEATS = ["an establishing wide shot of the scene", "a medium shot that introduces the main subject", "a close-up on the subject's face or most important detail", "a detail shot of an object or gesture", "an action moment", "a reaction shot", "a low-angle dramatic shot", "a wide shot from a new side", "a closing shot that ends the sequence"];

export type VarState = {
  mode: ModeId; grid: GridId;
  perspectives: string[]; // reframe
  narrative: string; auto: boolean; // storyboard
  people: PeopleId; ethnicities: string[]; gender: GenderId; // people
  custom: string; note?: string;
};
export const initialState = (): VarState => ({ mode: "reframe", grid: "2x2", perspectives: defaultPerspectives(4), narrative: "", auto: true, people: "expressions", ethnicities: [], gender: "both", custom: "" });

const KEEP = "Keep the subject, its identity and details, the art style, the colours and the overall look exactly the same as the reference picture.";
const KEEP_SCENE = `${KEEP} Keep the same framing, composition, background, clothing and lighting.`;

/** Split a storyboard text into one scene per line ("Scene 1: ..." prefixes are dropped). */
export function parseScenes(text: string): string[] {
  return text.split(/\r?\n|;/).map((l) => l.replace(/^\s*(scene\s*\d+|\d+)\s*[:.)-]\s*/i, "").trim()).filter(Boolean);
}
const cap = (list: string[], n: number) => Array.from({ length: n }, (_, i) => list[i % list.length]);

/** Why the current choices cannot run yet, or "" when they can. */
export function problem(s: VarState, consent: boolean): string {
  const n = gridCount(s.grid);
  if (n > MAX_CELLS) return "Choose a smaller grid.";
  if (s.mode === "reframe" && s.perspectives.length !== n) return `Choose ${n} perspectives (you have ${s.perspectives.length}).`;
  if (s.mode === "storyboard" && !s.auto) { const k = parseScenes(s.narrative).length; if (k !== n) return `This grid needs ${n} scenes and you wrote ${k}. One scene per line.`; }
  if (s.mode === "people" && !consent) return "Confirm the picture is yours or the person agreed.";
  if (s.mode === "people" && s.people === "demographics" && s.ethnicities.length !== n) return `Choose ${n} ethnicities (you have ${s.ethnicities.length}).`;
  if (s.mode === "custom" && !s.custom.trim()) return "Describe the variations you want.";
  return "";
}

/** One instruction per cell. */
export function cellPrompts(s: VarState): string[] {
  const n = gridCount(s.grid);
  const tail = s.note?.trim() ? ` ${s.note.trim()}` : "";
  let out: string[] = [];
  if (s.mode === "reframe") {
    out = s.perspectives.slice(0, n).map((id) => `Show the same subject from ${PERSPECTIVES.find((p) => p.id === id)?.text ?? id}. Change only the camera view. ${KEEP}`);
  } else if (s.mode === "storyboard") {
    const scenes = s.auto ? cap(BEATS, n) : parseScenes(s.narrative).slice(0, n);
    out = scenes.map((t, i) => `Storyboard frame ${i + 1} of ${n}: ${t}. Draw it in the same style as the reference picture, with the same characters and setting. ${KEEP}`);
  } else if (s.mode === "people") {
    if (s.people === "expressions") out = cap(EXPRESSIONS, n).map((e) => `Change only the person's facial expression to ${e}. ${KEEP_SCENE}`);
    else if (s.people === "age") out = cap(AGES, n).map((a) => `Show the same person as ${a}. Adult ages only. ${KEEP_SCENE}`);
    else out = s.ethnicities.slice(0, n).map((e, i) => {
      const g = s.gender === "both" ? (i % 2 === 0 ? "male" : "female") : s.gender;
      return `Show the person as a ${g} of ${e} background. Change only the person's physical features. ${KEEP_SCENE}`;
    });
  } else {
    out = Array.from({ length: n }, (_, i) => `${s.custom.trim()}. This is variation ${i + 1} of ${n}; make it clearly different from the other variations. Keep the framing and composition of the reference picture.`);
  }
  return out.map((p) => p + tail);
}
