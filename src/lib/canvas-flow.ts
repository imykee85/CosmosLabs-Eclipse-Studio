import type { Edge } from "@xyflow/react";
import type { CNode, NodeKind, PicRef } from "./canvas";

// How canvas nodes talk to each other. Every node GIVES something to the node it is wired into, and a generator RECEIVES what is wired into it:
//   Text prompt      gives its text
//   Character, Product, Scene   give a picture (when one was chosen) and a description (when one was typed)
//   Style            gives its style
//   Image generator, Full-body generator   give the picture they made (the one marked "use this one"), which the next generator reads as a reference picture
//   Note             gives nothing
// A generator composes one prompt from what it receives and what is typed on it, and sends the received pictures as numbered references, telling
// the model in the prompt what each numbered picture is.

export const isGen = (t?: string) => t === "generator" || t === "fullbody";

export type Role = "prompt" | "style" | "character" | "product" | "scene" | "result";
const ROLE_ORDER: Role[] = ["prompt", "style", "character", "product", "scene", "result"];
const roleOf = (t?: string): Role | null =>
  t === "text" ? "prompt" : t === "style" ? "style" : t === "character" ? "character" : t === "product" ? "product" : t === "scene" ? "scene" : isGen(t) ? "result" : null;

export const TITLES: Record<NodeKind, string> = {
  character: "Character", product: "Product", scene: "Scene", text: "Text prompt", style: "Style", note: "Note", fullbody: "Full-body generator", generator: "Image generator",
};

// The picture a generator hands on: the one marked, else its first finished render.
export const outputOf = (n: CNode): string | null => {
  const g = n.data.gens ?? [];
  return n.data.pick && g.includes(n.data.pick) ? n.data.pick : g[0] ?? null;
};

export type Input = {
  nodeId: string;
  kind: NodeKind;
  title: string;
  role: Role;
  text?: string;       // the prompt, description or style the node gives
  pic?: PicRef;        // the picture the node gives
  ready: boolean;      // false: the node has nothing to give yet (a generator that has not made an image)
  why?: string;        // plain words for "not ready"
};

// What is wired directly into a generator, in a steady order: prompts, style, character, product, scene, then earlier results; wiring order within a group.
export function inputsOf(nodes: CNode[], edges: Edge[], generatorId: string): Input[] {
  const out: Input[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.target !== generatorId || seen.has(e.source)) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (!n) continue;
    const role = roleOf(n.type);
    if (!role) continue; // a note gives nothing
    seen.add(n.id);
    const d = n.data;
    const title = TITLES[n.type as NodeKind] ?? "Node";
    if (role === "prompt") out.push({ nodeId: n.id, kind: "text", title, role, text: d.text?.trim() || undefined, ready: !!d.text?.trim(), why: "The text prompt is empty." });
    else if (role === "style") { const st = d.style && d.style !== "None" ? d.style : undefined; out.push({ nodeId: n.id, kind: "style", title, role, text: st, ready: !!st, why: "No style is chosen." }); }
    else if (role === "result") {
      const id = outputOf(n);
      out.push({ nodeId: n.id, kind: n.type as NodeKind, title, role, pic: id ? { type: "render", id, label: d.prompt?.trim() || title } : undefined, ready: !!id, why: `${title} has not made a picture yet. Generate it first.` });
    } else out.push({ nodeId: n.id, kind: n.type as NodeKind, title, role, text: d.desc?.trim() || undefined, pic: d.ref, ready: !!(d.ref || d.desc?.trim()), why: `${title} has no picture or description yet.` });
  }
  return out.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
}

export type Numbered = { n: number; role: Role | "own"; label: string; pic: PicRef; from: string };

// The pictures in the order the model reads them: wired-in ones first (in the order above), then the ones picked on the node itself.
export function picturesOf(inputs: Input[], own: PicRef[] = []): Numbered[] {
  const list: Numbered[] = [];
  for (const i of inputs) if (i.pic && !list.some((p) => p.pic.id === i.pic!.id)) list.push({ n: 0, role: i.role, label: i.pic.label, pic: i.pic, from: i.title });
  for (const r of own) if (!list.some((p) => p.pic.id === r.id)) list.push({ n: 0, role: "own", label: r.label, pic: r, from: "this node" });
  return list.map((p, i) => ({ ...p, n: i + 1 }));
}

const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const ROLE_WORDS: Record<Numbered["role"], string> = { prompt: "a reference", style: "a style reference", character: "the character", product: "the product", scene: "the scene", result: "a previous result", own: "a reference" };

// The one prompt a generator sends. Own text first, then the wired-in prompts, then descriptions and style, then what each numbered picture is.
export function composePrompt(kind: NodeKind, own: string, inputs: Input[], pics: Numbered[], max: number): string {
  const parts: string[] = [];
  if (own.trim()) parts.push(own.trim());
  for (const i of inputs) if (i.role === "prompt" && i.text) parts.push(i.text);
  for (const [role, label] of [["character", "Character"], ["product", "Product"], ["scene", "Scene"]] as const)
    for (const i of inputs) if (i.role === role && i.text) parts.push(`${label}: ${i.text}`);
  for (const i of inputs) if (i.role === "style" && i.text) parts.push(`Style: ${i.text}`);
  if (parts.length && kind === "fullbody") parts.push("Full body shot, head to toe");
  let text = parts.join(". ");
  if (pics.length) text += `${text ? ". " : ""}Reference images: ${pics.map((p) => `image ${p.n} is ${ROLE_WORDS[p.role]}${p.label && p.role !== "result" ? ` (${short(p.label, 30)})` : ""}`).join("; ")}`;
  return text.slice(0, max);
}

// What a node gives, in a few plain words (shown under the node and on its wires).
export function givesText(n: CNode): string {
  const d = n.data;
  switch (n.type) {
    case "text": return d.text?.trim() ? "its text" : "nothing yet (empty)";
    case "style": return d.style && d.style !== "None" ? `the style: ${d.style}` : "nothing yet (no style)";
    case "character": case "product": case "scene": {
      const bits = [d.ref ? "a picture" : "", d.desc?.trim() ? "a description" : ""].filter(Boolean);
      return bits.length ? bits.join(" and ") : "nothing yet";
    }
    case "generator": case "fullbody": {
      const id = outputOf(n);
      const k = (d.gens ?? []).length;
      return id ? `an image${k > 1 ? ` (1 of ${k} made)` : ""}` : (d.pending?.length ? "an image, still being made" : "nothing yet (no image made)");
    }
    default: return "nothing";
  }
}

// A one-word tag for the wire leaving a node.
export function wireLabel(n: CNode): string {
  switch (n.type) {
    case "text": return "text";
    case "style": return "style";
    case "character": case "product": case "scene": return n.data.ref && n.data.desc?.trim() ? "picture + text" : n.data.ref ? "picture" : n.data.desc?.trim() ? "text" : "empty";
    case "generator": case "fullbody": return outputOf(n) ? "image" : "no image yet";
    default: return "";
  }
}

// Would a wire from `source` to `target` close a loop (target already feeds, directly or not, into source)?
export function wouldLoop(edges: Edge[], source: string, target: string): boolean {
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.source === id) stack.push(e.target);
  }
  return false;
}

// Which nodes may feed which: anything but a note can feed a generator; a generator can feed another generator (its picture); no loops.
export function canWire(nodes: CNode[], edges: Edge[], sourceId: string, targetId: string): boolean {
  const s = nodes.find((n) => n.id === sourceId), t = nodes.find((n) => n.id === targetId);
  if (!s || !t || s.id === t.id) return false;
  if (!isGen(t.type) || s.type === "note") return false;
  if (edges.some((e) => e.source === s.id && e.target === t.id)) return false;
  return !wouldLoop(edges, s.id, t.id);
}

// What the "+" beside a node offers: after a node (its output) only generators can take it in; before a generator (its input) any input node.
export const NEXT_KINDS: NodeKind[] = ["generator", "fullbody"];
export const PREV_KINDS: NodeKind[] = ["text", "character", "product", "scene", "style", "generator", "fullbody"];
