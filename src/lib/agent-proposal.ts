// What Atlas proposes for the prompt box, as one card the person can apply (owner 2026-11-01): the new prompt, the settings it would change and the old values beside them.
// Pure and browser-safe, so it can be tested without a screen.
export type SettingLine = { label: string; from?: string; to: string };
export type Proposal = {
  page: string;
  prompt?: string;            // the new prompt, when Atlas wrote one
  count?: number;             // how many to make, when he said
  controls: Record<string, unknown>; // the box settings he chose (without the prompt)
  settings: SettingLine[];    // the same, as readable lines
  before: string;             // the prompt as it was when he answered
  applied?: "apply" | "generate";
};
export type ProposalContext = { prompt?: string; ratio?: string; qty?: number; model?: string };
type ActionLike = { kind: "generate" | "use_prompt" | "reply"; prompt?: string; count?: number };

const LABEL: Record<string, string> = { model: "Model", ratio: "Aspect ratio", count: "Images", quality: "Quality", duration: "Length", sound: "Sound", fixed_seed: "Fixed seed" };
const show = (k: string, v: unknown) => (k === "sound" || k === "fixed_seed" ? (v ? "On" : "Off") : k === "duration" ? `${v} s` : String(v));

export function buildProposal(page: string, controls: Record<string, unknown> | undefined, actions: ActionLike[], ctx: ProposalContext): Proposal | null {
  const ctl: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(controls ?? {})) if (k !== "prompt" && v !== undefined && LABEL[k]) ctl[k] = v;
  const fromAction = actions.find((a) => (a.kind === "use_prompt" || a.kind === "generate") && a.prompt);
  const prompt = (typeof controls?.prompt === "string" && controls.prompt) || fromAction?.prompt || undefined;
  const count = typeof ctl.count === "number" ? ctl.count : fromAction?.count;
  if (!prompt && !Object.keys(ctl).length) return null;
  const was: Record<string, string | undefined> = { ratio: ctx.ratio, model: ctx.model, count: ctx.qty !== undefined ? String(ctx.qty) : undefined };
  const settings = Object.entries(ctl).map(([k, v]) => ({ label: LABEL[k], ...(was[k] && was[k] !== show(k, v) ? { from: was[k] } : {}), to: show(k, v) }));
  return { page, ...(prompt ? { prompt } : {}), ...(count ? { count } : {}), controls: ctl, settings, before: ctx.prompt ?? "" };
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** The new prompt split into pieces, each marked when it holds words the old prompt did not have. */
export function diffWords(oldText: string, newText: string): { text: string; added: boolean }[] {
  const have = new Map<string, number>();
  for (const w of oldText.split(/\s+/)) { const k = norm(w); if (k) have.set(k, (have.get(k) ?? 0) + 1); }
  const out: { text: string; added: boolean }[] = [];
  for (const w of newText.split(/(\s+)/)) {
    if (!w) continue;
    if (/^\s+$/.test(w)) { if (out.length) out[out.length - 1].text += w; continue; }
    const k = norm(w);
    const left = k ? have.get(k) ?? 0 : 1;
    const added = !!k && left === 0;
    if (k && left > 0) have.set(k, left - 1);
    const last = out[out.length - 1];
    if (last && last.added === added) last.text += w; else out.push({ text: w, added });
  }
  return out;
}

// What shows while Atlas is working (owner 2026-11-01): short creative lines, a few more for the studio he is in.
export const THINKING_GENERAL = ["Sketching an idea", "Mixing colours", "Framing the shot", "Finding the light", "Moving things around", "Trying a different angle", "Adding the finishing touches"];
export const THINKING_IMAGE = ["Choosing the lens", "Setting the light", "Picking the palette", "Composing the frame"];
export const THINKING_VIDEO = ["Blocking the scene", "Planning the camera move", "Cutting the sequence", "Timing the shot"];
export const THINKING_AUDIO = ["Tuning the voice", "Finding the rhythm", "Mixing the sound"];
export function thinkingLines(page: string | undefined): string[] {
  if (page === "studio") return [...THINKING_GENERAL, ...THINKING_IMAGE];
  if (page === "video") return [...THINKING_GENERAL, ...THINKING_VIDEO];
  return THINKING_GENERAL;
}
