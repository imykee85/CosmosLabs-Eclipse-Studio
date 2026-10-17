import type { Edge } from "@xyflow/react";
import type { CNode, NodeKind, PicRef } from "./canvas";

// How canvas nodes talk to each other. Every node has labelled PORTS, the dots on its edges.
//   Outputs (one per node, handle id "out"):  Text prompt -> Prompt;  Character -> Character;  Product -> Product;  Scene -> Scene;  Style -> Style;
//                                             Image, Full-body and Character sheet generators -> Result (the picture they made, the one ticked "use this one");
//                                             Image -> Picture;  Video -> Clip;  Video generator -> Video (the clip it made);  Note -> none.
//   Inputs on an image generator (handle id = the port id):  Description (text prompts, many), Character, Product (many), Scene, Style, Ingredients (many; any
//   picture: another generator's Result, an Image node, or a Character, Product or Scene node's picture). Full-body and Character sheet have no Scene port.
//   Inputs on the video generator: Description, Start frame (one picture), Ingredients (pictures as references), Clips (videos as references).
// A wire goes from an output to the input of its own kind, or to Ingredients when what it carries is a picture. A generator composes one prompt from what it
// receives and what is typed on it, and sends the received pictures as numbered ingredients, telling the model what each numbered picture is.

export const isGen = (t?: string) => t === "generator" || t === "fullbody" || t === "sheet"; // the image generators
export const isVideoGen = (t?: string) => t === "videogen";
export const takesInputs = (t?: string) => isGen(t) || isVideoGen(t);

export type PortId = "description" | "character" | "product" | "scene" | "style" | "ingredients" | "start" | "clips";
export type PortDef = { id: PortId; label: string; many: boolean };

const PORTS: Record<PortId, PortDef> = {
  description: { id: "description", label: "Description", many: true },
  character: { id: "character", label: "Character", many: false },
  product: { id: "product", label: "Product", many: true },
  scene: { id: "scene", label: "Scene", many: false },
  style: { id: "style", label: "Style", many: false },
  ingredients: { id: "ingredients", label: "Ingredients", many: true },
  start: { id: "start", label: "Start frame", many: false },
  clips: { id: "clips", label: "Clips", many: true },
};
const PORT_ORDER: PortId[] = ["description", "start", "character", "product", "scene", "style", "ingredients", "clips"];
const IMAGE_PORTS: PortId[] = ["description", "character", "product", "scene", "style", "ingredients"];
const VIDEO_PORTS: PortId[] = ["description", "start", "ingredients", "clips"];

export const OUT_HANDLE = "out";

// The inputs a generator offers, top to bottom.
export const inPortsOf = (kind?: string): PortDef[] => (kind === "generator" ? IMAGE_PORTS : kind === "fullbody" || kind === "sheet" ? IMAGE_PORTS.filter((p) => p !== "scene") : kind === "videogen" ? VIDEO_PORTS : []).map((p) => PORTS[p]);
export const portLabel = (id: string): string => PORTS[id as PortId]?.label ?? id;
export const isMany = (id: string): boolean => PORTS[id as PortId]?.many ?? true;

// What a node's output is called (null: it has none).
export const outLabelOf = (kind?: string): string | null =>
  kind === "text" ? "Prompt" : kind === "character" ? "Character" : kind === "product" ? "Product" : kind === "scene" ? "Scene" : kind === "style" ? "Style" : isGen(kind) ? "Result"
  : kind === "image" ? "Picture" : kind === "clip" ? "Clip" : kind === "videogen" ? "Video" : null;

// The input port a node's output belongs on.
export const naturalPort = (kind?: string): PortId | null =>
  kind === "text" ? "description" : kind === "character" ? "character" : kind === "product" ? "product" : kind === "scene" ? "scene" : kind === "style" ? "style" : isGen(kind) || kind === "image" ? "ingredients"
  : kind === "clip" || kind === "videogen" ? "clips" : null;

const givesPicture = (kind?: string) => kind === "character" || kind === "product" || kind === "scene" || kind === "image" || isGen(kind);
const givesClip = (kind?: string) => kind === "clip" || kind === "videogen";

// May an output of `source` kind be plugged into this input port?
export const accepts = (sourceKind: string | undefined, port: string): boolean => {
  if (!sourceKind || sourceKind === "note") return false;
  if (port === "ingredients" || port === "start") return givesPicture(sourceKind);
  if (port === "clips") return givesClip(sourceKind);
  return naturalPort(sourceKind) === port;
};

// The port to use for a new wire from a node of `sourceKind` into a generator of `targetKind`: its own port, or Ingredients where the generator has no such port.
export const portFor = (sourceKind: string | undefined, targetKind: string | undefined): PortId | null => {
  const p = naturalPort(sourceKind);
  if (!p || !takesInputs(targetKind)) return null;
  // A picture plugged into the video generator is its start frame by default (Ingredients is the other picture port).
  if (isVideoGen(targetKind) && givesPicture(sourceKind)) return "start";
  if (inPortsOf(targetKind).some((d) => d.id === p)) return p;
  return givesPicture(sourceKind) ? "ingredients" : null;
};

export const TITLES: Record<NodeKind, string> = {
  character: "Character", product: "Product", scene: "Scene", text: "Text prompt", style: "Style", note: "Note", fullbody: "Full-body generator", generator: "Image generator",
  sheet: "Character sheet generator", image: "Image", clip: "Video", videogen: "Video generator",
};

// The picture a generator hands on: the one marked, else its first finished render.
export const outputOf = (n: CNode): string | null => {
  const g = n.data.gens ?? [];
  return n.data.pick && g.includes(n.data.pick) ? n.data.pick : g[0] ?? null;
};

export type Role = "prompt" | "style" | "character" | "product" | "scene" | "ingredient" | "start" | "clip";
export type Input = {
  nodeId: string;
  kind: NodeKind;
  title: string;
  port: PortId;
  role: Role;
  text?: string;       // the prompt, description or style the node gives
  pic?: PicRef;        // the picture the node gives
  clip?: { id: string; label: string; sec?: number | null }; // the clip the node gives (Video node, or a video generator's result)
  fromResult: boolean; // the picture is another generator's result
  ready: boolean;      // false: the node has nothing to give yet (a generator that has not made an image)
  why?: string;        // plain words for "not ready"
};

const roleOfPort = (port: PortId): Role => (port === "description" ? "prompt" : port === "ingredients" ? "ingredient" : port === "clips" ? "clip" : port);

// The port an edge ends at (older saves have no handle ids: they are read as the source's own port).
export function targetPortOf(e: Edge, nodes: CNode[]): PortId {
  const h = e.targetHandle as PortId | null | undefined;
  if (h && PORTS[h]) return h;
  const s = nodes.find((n) => n.id === e.source);
  const t = nodes.find((n) => n.id === e.target);
  return portFor(s?.type, t?.type) ?? "ingredients";
}

// What is wired directly into a generator, in a steady order (by port, then wiring order).
export function inputsOf(nodes: CNode[], edges: Edge[], generatorId: string): Input[] {
  const out: Input[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.target !== generatorId) continue;
    const n = nodes.find((x) => x.id === e.source);
    if (!n || n.type === "note") continue;
    const port = targetPortOf(e, nodes);
    if (seen.has(`${n.id}:${port}`)) continue;
    seen.add(`${n.id}:${port}`);
    const d = n.data;
    const title = TITLES[n.type as NodeKind] ?? "Node";
    const base = { nodeId: n.id, kind: n.type as NodeKind, title, port, role: roleOfPort(port), fromResult: isGen(n.type) || isVideoGen(n.type) };
    if (port === "clips") {
      if (isVideoGen(n.type)) { const cid = outputOf(n); out.push({ ...base, clip: cid ? { id: cid, label: d.prompt?.trim() || title } : undefined, ready: !!cid, why: `${title} has not made a video yet. Generate it first.` }); }
      else out.push({ ...base, clip: d.clip, ready: !!d.clip, why: "The Video node has no clip yet." });
    } else if (port === "description") out.push({ ...base, text: d.text?.trim() || undefined, ready: !!d.text?.trim(), why: "The text prompt is empty." });
    else if (port === "style") { const st = d.style && d.style !== "None" ? d.style : undefined; out.push({ ...base, text: st, ready: !!st, why: "No style is chosen." }); }
    else if (isGen(n.type)) {
      const id = outputOf(n);
      out.push({ ...base, pic: id ? { type: "render", id, label: d.prompt?.trim() || title } : undefined, ready: !!id, why: `${title} has not made a picture yet. Generate it first.` });
    } else if (port === "ingredients" || port === "start") out.push({ ...base, pic: d.ref, ready: !!d.ref, why: `${title} has no picture yet.` });
    else out.push({ ...base, text: d.desc?.trim() || undefined, pic: d.ref, ready: !!(d.ref || d.desc?.trim()), why: `${title} has no picture or description yet.` });
  }
  return out.sort((a, b) => PORT_ORDER.indexOf(a.port) - PORT_ORDER.indexOf(b.port));
}

export type Numbered = { n: number; role: Role | "own"; label: string; pic: PicRef; from: string; fromResult: boolean };

// The pictures in the order the model reads them: wired-in ones first (in the order above), then the ones picked on the node itself.
export function picturesOf(inputs: Input[], own: PicRef[] = []): Numbered[] {
  const list: Numbered[] = [];
  for (const i of inputs) if (i.pic && !list.some((p) => p.pic.id === i.pic!.id)) list.push({ n: 0, role: i.role, label: i.pic.label, pic: i.pic, from: i.title, fromResult: i.fromResult });
  for (const r of own) if (!list.some((p) => p.pic.id === r.id)) list.push({ n: 0, role: "own", label: r.label, pic: r, from: "this node", fromResult: false });
  return list.map((p, i) => ({ ...p, n: i + 1 }));
}

const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const wordFor = (p: Numbered) => (p.fromResult ? "a previous result" : p.role === "character" ? "the character" : p.role === "product" ? "the product" : p.role === "scene" ? "the scene" : "an ingredient");

export const SHEET_PROMPT = "Character reference sheet of this one character: full body, shown from the front, three-quarter, side and back, plus a close-up of the face, all in one image side by side, same outfit, proportions and colours in every view, neutral pose, plain light grey background, even studio light, no text";

// The one prompt a generator sends. Own text first, then the wired-in prompts, then descriptions and style, then what each numbered picture is.
export function composePrompt(kind: NodeKind, own: string, inputs: Input[], pics: Numbered[], max: number): string {
  const parts: string[] = [];
  if (own.trim()) parts.push(own.trim());
  for (const i of inputs) if (i.port === "description" && i.text) parts.push(i.text);
  for (const [port, label] of [["character", "Character"], ["product", "Product"], ["scene", "Scene"]] as const)
    for (const i of inputs) if (i.port === port && i.text) parts.push(`${label}: ${i.text}`);
  for (const i of inputs) if (i.port === "style" && i.text) parts.push(`Style: ${i.text}`);
  if (parts.length && kind === "fullbody") parts.push("Full body shot, head to toe");
  if (kind === "sheet") parts.push(SHEET_PROMPT);
  let text = parts.join(". ");
  if (pics.length) text += `${text ? ". " : ""}Reference images: ${pics.map((p) => `image ${p.n} is ${wordFor(p)}${p.label && !p.fromResult ? ` (${short(p.label, 30)})` : ""}`).join("; ")}`;
  return text.slice(0, max);
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

// May this wire be made? Output to an input of its own kind (or Ingredients for a picture), never into itself, never twice, never in a loop.
export function canWire(nodes: CNode[], edges: Edge[], c: { source: string; target: string; targetHandle?: string | null }): boolean {
  const s = nodes.find((n) => n.id === c.source), t = nodes.find((n) => n.id === c.target);
  if (!s || !t || s.id === t.id || !takesInputs(t.type)) return false;
  const port = (c.targetHandle as PortId | null | undefined) ?? portFor(s.type, t.type);
  if (!port || !inPortsOf(t.type).some((d) => d.id === port) || !accepts(s.type, port)) return false;
  if (edges.some((e) => e.source === s.id && e.target === t.id && targetPortOf(e, nodes) === port)) return false;
  return !wouldLoop(edges, s.id, t.id);
}

// A wire from `sourceId` into `port` of `targetId`.
export const makeEdge = (sourceId: string, targetId: string, port: PortId): Edge => ({ id: `e-${sourceId}-${targetId}-${port}`, source: sourceId, sourceHandle: OUT_HANDLE, target: targetId, targetHandle: port });

// Connecting into a port that takes one wire replaces the wire that was there.
export function withoutReplaced(edges: Edge[], targetId: string, port: string): Edge[] {
  return isMany(port) ? edges : edges.filter((e) => !(e.target === targetId && e.targetHandle === port));
}

// Older saves carry wires without handle ids: give each the ports it meant.
export function migrateEdges(nodes: CNode[], edges: Edge[]): Edge[] {
  return edges.map((e) => (e.targetHandle && e.sourceHandle ? e : { ...e, sourceHandle: OUT_HANDLE, targetHandle: targetPortOf(e, nodes) }));
}

// What the "+" beside a node offers: after a node (its output) only generators can take it in; before a generator (its input) any input node.
export const NEXT_KINDS: NodeKind[] = ["generator", "fullbody", "sheet", "videogen"];
export const PREV_KINDS: NodeKind[] = ["text", "character", "product", "scene", "style", "image", "clip", "generator", "fullbody", "sheet", "videogen"];
