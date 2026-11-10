import { DIRECTOR_STYLES } from "@/lib/director-styles";

// Director lenses for Atlas. The owner's DirectorSKILL carries one full module per director (src/lib/director-styles.ts, word for word). When a person names one of
// the twenty, exactly that module is added to Atlas's instructions for the message, with the skill's own rules for using it (one lens at a time, applied to the
// keyframe as well as the motion, the module's prompt templates as the shape of the answer). About 7,000 input tokens, charged as chat.
export const DIRECTORS: { id: string; label: string; re: RegExp }[] = [
  { id: "spielberg", label: "Steven Spielberg", re: /\bspielberg(?:ian)?\b/i },
  { id: "hitchcock", label: "Alfred Hitchcock", re: /\bhitchcock(?:ian)?\b/i },
  { id: "kubrick", label: "Stanley Kubrick", re: /\bkubrick(?:ian)?\b/i },
  { id: "kurosawa", label: "Akira Kurosawa", re: /\bkurosawa\b/i },
  { id: "scorsese", label: "Martin Scorsese", re: /\bscorsese\b/i },
  { id: "fellini", label: "Federico Fellini", re: /\bfellini(?:esque)?\b/i },
  { id: "bergman", label: "Ingmar Bergman", re: /\bbergman\b/i },
  { id: "tarkovsky", label: "Andrei Tarkovsky", re: /\btarkovsk(?:y|ian)\b/i },
  { id: "wong_kar_wai", label: "Wong Kar-wai", re: /\bwong[\s-]*kar[\s-]*wai\b|\bwkw\b/i },
  { id: "nolan", label: "Christopher Nolan", re: /\bnolan\b/i },
  { id: "villeneuve", label: "Denis Villeneuve", re: /\bvill?e?n[eu]{1,2}ve\b|\bvillenu?e?ve\b|\bvenuela\b/i },
  { id: "fincher", label: "David Fincher", re: /\bfincher\b/i },
  { id: "refn", label: "Nicolas Winding Refn", re: /\brefn\b/i },
  { id: "bi_gan", label: "Bi Gan", re: /\bbi[\s-]*gan\b/i },
  { id: "zhang_yimou", label: "Zhang Yimou", re: /\bzhang[\s-]*yimou\b/i },
  { id: "hou_hsiao_hsien", label: "Hou Hsiao-hsien", re: /\bhou[\s-]*hsiao[\s-]*hsien\b/i },
  { id: "park_chan_wook", label: "Park Chan-wook", re: /\bpark[\s-]*chan[\s-]*wook\b/i },
  { id: "malick", label: "Terrence Malick", re: /\bmalick\b/i },
  { id: "michael_mann", label: "Michael Mann", re: /\bmichael[\s-]*mann\b/i },
  { id: "coen_brothers", label: "the Coen brothers", re: /\bcoens?\b/i },
];

type Msg = ReadonlyArray<{ content: unknown }>;
const textOf = (c: unknown): string => typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (b && typeof b === "object" && (b as { type?: string }).type === "text" ? String((b as { text?: unknown }).text ?? "") : "")).join("\n") : "";

/** Every director named in one piece of text, in the order they appear. */
export function directorsIn(text: string): string[] {
  return DIRECTORS.map((d) => ({ id: d.id, at: text.search(d.re) })).filter((d) => d.at >= 0).sort((a, b) => a.at - b.at).map((d) => d.id);
}

/**
 * The lens to load: the directors named in the newest message that names any (then the prompt box, then earlier turns). One module only; when the same message
 * names more than one, the first is loaded and the others are listed so Atlas can say which it chose.
 */
export function pickDirector(messages: Msg, context: string): { id: string; others: string[] } | null {
  const sources = [...messages].reverse().map((m) => textOf(m.content)).concat(context);
  for (const t of sources) {
    const found = directorsIn(t);
    if (found.length) return { id: found[0], others: found.slice(1) };
  }
  return null;
}

/** The block added to Atlas's instructions for the chosen director. */
export function directorLensBlock(pick: { id: string; others: string[] }): string {
  const d = DIRECTORS.find((x) => x.id === pick.id)!;
  const others = pick.others.map((id) => DIRECTORS.find((x) => x.id === id)?.label).filter(Boolean);
  return `DIRECTOR LENS: ${d.label}
The person named this director. Below is the full style module, word for word (its Chinese headings and notes are part of it: read them, answer in the person's language, and write every prompt in English). Use it like this:
- It is the only lens. Its "Style parameters" block overrides lens kit, camera moves, motion budget, composition, light, palette, cutting, sound and performance for every shot, keyframe and prompt you write. Precedence: this lens, then genre, then the project's tone, then your own defaults.${others.length ? `\n- The person also named ${others.join(" and ")}. Two lenses at once give incoherence: pick the one that serves the scene's dramatic core, say so in one line, and say what the other would have changed.` : ""}
- A lens applied to the shot list but not to the first frame does not survive generation: apply it to the keyframe or still prompt as well as the motion prompt.
- Use the module's own prompt templates ("Image-to-video motion prompt", "Keyframe / still prompt") as the shape of what you hand over, filled with the person's scene; its worked example shows the standard. Put its negative_prompt_adds into the leave-out text when the model has one.
- Read "What this lens is NOT" so you do not drift into a neighbouring director. Respect its clip length and, for vertical 9:16, its rewrite.
- Describe method only: never copy a real film's specific shots, lines, characters or plot.
- Say in one line which lens you applied and why.

${DIRECTOR_STYLES[pick.id]}`;
}
