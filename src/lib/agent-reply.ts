import type Anthropic from "@anthropic-ai/sdk";
import { cleanPlan, type PlanRef, type PlanSpec } from "./agent-plan";
import { cleanMission, type MissionSpec } from "./agent-mission-spec";

// Turns the model's answer into what the browser shows: the text and the buttons made from its tool calls. Kept apart from the route so it can be tested.
export type Action = { kind: "generate" | "use_prompt" | "reply" | "make"; label: string; prompt?: string; count?: number; asset?: "image" | "video"; ratio?: string };
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const MAX_PROMPT = 32000; // the longest prompt any model takes (GPT Image); the box shows the chosen model's own limit
const PRETTY_UP_TO = 8000; // JSON prompts are written out with indentation while they stay this short, else on one line

// A prompt normally arrives as text, but a structured (JSON-style) prompt can arrive as an object: keep it, written out as JSON text.
function promptText(v: unknown): string {
  if (typeof v === "string") return v.trim().slice(0, MAX_PROMPT);
  if (v && typeof v === "object") {
    try { const pretty = JSON.stringify(v, null, 2); return (pretty.length <= PRETTY_UP_TO ? pretty : JSON.stringify(v)).slice(0, MAX_PROMPT); } catch { return ""; }
  }
  return "";
}

// Settings Atlas chose for the prompt box (owner 2026-10-21). Only known keys with the right kind of value get through; the screen checks the values against what its box really offers.
export type Controls = { model?: string; ratio?: string; count?: number; quality?: string; duration?: number; sound?: boolean; fixed_seed?: boolean; prompt?: string; move?: string; move2?: string; combine?: string; rotate?: number; vertical?: number; distance?: number; speed?: number; lens?: number; shake?: number; length?: number };
export function cleanControls(i: Record<string, unknown>): Controls {
  const c: Controls = {};
  const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  const model = str(i.model, 80); if (model) c.model = model;
  const ratio = str(i.aspect_ratio, 12); if (ratio) c.ratio = ratio;
  const quality = str(i.quality, 12); if (quality) c.quality = quality;
  if (Number.isInteger(i.count) && (i.count as number) >= 1 && (i.count as number) <= 4) c.count = i.count as number;
  if (Number.isInteger(i.duration_seconds) && (i.duration_seconds as number) >= 1 && (i.duration_seconds as number) <= 60) c.duration = i.duration_seconds as number;
  if (typeof i.sound === "boolean") c.sound = i.sound;
  if (typeof i.fixed_seed === "boolean") c.fixed_seed = i.fixed_seed;
  const prompt = promptText(i.prompt); if (prompt) c.prompt = prompt;
  // ShotMap camera move (owner 2026-11-13): a described camera motion as the Moves settings. The screen checks each value against what it offers.
  const move = str(i.move, 20); if (move) c.move = move;
  const move2 = str(i.second_move, 20); if (move2) c.move2 = move2;
  const combine = str(i.combine, 12); if (combine) c.combine = combine;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  const rot = num(i.rotate_deg, 0, 359); if (rot !== undefined) c.rotate = rot;
  const vert = num(i.vertical_deg, -30, 80); if (vert !== undefined) c.vertical = vert;
  const dist = num(i.distance_m, 1, 40); if (dist !== undefined) c.distance = dist;
  const spd = num(i.speed_percent, 25, 300); if (spd !== undefined) c.speed = spd;
  const lens = num(i.lens_mm, 12, 200); if (lens !== undefined) c.lens = lens;
  const shake = num(i.shake_percent, 0, 100); if (shake !== undefined) c.shake = shake;
  const len = num(i.length_seconds, 2, 30); if (len !== undefined) c.length = len;
  return c;
}

export function buildReply(content: Anthropic.ContentBlock[], stopReason: string | null | undefined, pictures: PlanRef[] = []): { text: string; actions: Action[]; controls: Controls; plan?: PlanSpec; mission?: MissionSpec } {
  let text = "";
  let plan: PlanSpec | undefined;
  let mission: MissionSpec | undefined;
  const actions: Action[] = [];
  let controls: Controls = {};
  for (const b of content) {
    if (b.type === "text") text += b.text;
    else if (b.type === "tool_use") {
      const i = (b.input ?? {}) as Record<string, unknown>;
      const prompt = promptText(i.prompt);
      if (b.name === "propose_generation" && prompt) {
        const n = Number.isInteger(i.count) ? Math.min(4, Math.max(1, i.count as number)) : undefined;
        actions.push({ kind: "generate", label: n && n > 1 ? `Generate ${n}` : "Generate", prompt, count: n });
      } else if (b.name === "suggest_prompt" && prompt) actions.push({ kind: "use_prompt", label: "Use this prompt", prompt });
      else if (b.name === "make_asset" && prompt) {
        const asset = i.kind === "video" ? "video" : "image";
        const ratio = typeof i.aspect_ratio === "string" && /^\d{1,2}:\d{1,2}$/.test(i.aspect_ratio) ? i.aspect_ratio : undefined;
        actions.push({ kind: "make", label: asset === "video" ? "Make this clip" : "Make this picture", prompt, asset, ...(ratio ? { ratio } : {}) });
      }
      else if (b.name === "propose_plan") plan = cleanPlan(i, pictures) ?? plan;
      else if (b.name === "propose_mission") mission = cleanMission(i) ?? mission;
      else if (b.name === "set_prompt_box") controls = { ...controls, ...cleanControls(i) };
      else if (b.name === "ask_approval" && Array.isArray(i.options)) for (const o of i.options.slice(0, 4)) { const l = clip(o, 40); if (l) actions.push({ kind: "reply", label: l }); }
    }
  }
  text = text.trim();
  // An answer that ran out of room can lose its buttons: never leave the person looking for something that is not there.
  if (stopReason === "max_tokens" && !actions.length) text += `${text ? "\n\n" : ""}My answer was cut off before I could attach the buttons. Ask me to send it again, shorter.`;
  if (!text && !actions.length && (plan || mission)) text = mission ? "Here is the mission." : "Here is the plan.";
  if (!text && !actions.length && !plan && !mission) text = Object.keys(controls).length ? "Done." : "I don't have anything to add yet. Tell me a bit more.";
  return { text, actions, controls, ...(plan ? { plan } : {}), ...(mission ? { mission } : {}) };
}
