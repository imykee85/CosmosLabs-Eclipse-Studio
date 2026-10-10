import type { Edge, Node } from "@xyflow/react";
import { makeEdge, migrateEdges, type PortId } from "./canvas-flow";

// Canvas: a free-form graph of nodes that feeds the image generator. Saved per project in this browser and, when signed in, to the account.
export type NodeKind = "character" | "product" | "scene" | "text" | "style" | "fullbody" | "note" | "generator";

export type PicRef = { type: "upload" | "render"; id: string; label: string };

export type CanvasNodeData = {
  text?: string;      // text node: the prompt
  desc?: string;      // ingredient nodes: a short description
  ref?: PicRef;       // ingredient nodes: a picture chosen from the Library
  style?: string;     // style node
  // Image generators (and full-body generators) work like Image Studio's prompt box:
  prompt?: string;    // what is typed into the node itself
  ratio?: string;
  model?: string;     // an image model id, or "auto"
  qty?: number;       // images per press of Generate (1 to 4)
  tier?: string;      // quality: 1k, 1.5k, 2k, 4k
  refs?: PicRef[];    // reference pictures chosen on the node itself (the wired-in ones come on top of these)
  seedOn?: boolean;   // fixed seed
  seed?: string;      // the seed number as typed
  gens?: string[];    // the finished renders of the latest batch
  pending?: string[]; // renders still running (they keep going on the server if you leave)
  pick?: string;      // which finished render this node hands to the next one (the first by default)
  note?: string;
  error?: string;
  // Older saves: one render at a time. Read once and turned into the fields above by migrateNode.
  busy?: boolean;
  pendingId?: string;
  genId?: string;
  imageUrl?: string;
};
export type CNode = Node<CanvasNodeData>;

// The node picker: groups, in order. "soon" entries are shown but cannot be added yet.
export type CatalogItem = { id: string; kind?: NodeKind; label: string; blurb: string };
export const NODE_GROUPS: { title: string; items: CatalogItem[] }[] = [
  { title: "Generators", items: [
    { id: "generator", kind: "generator", label: "Image generator", blurb: "Turns the wired-in nodes into a picture" },
    { id: "video", label: "Video generator", blurb: "Turns a picture into motion" },
  ] },
  { title: "Input", items: [
    { id: "character", kind: "character", label: "Character", blurb: "Who is in it" },
    { id: "product", kind: "product", label: "Product", blurb: "What is being shown" },
    { id: "style", kind: "style", label: "Style", blurb: "The look and feel" },
    { id: "scene", kind: "scene", label: "Scene", blurb: "Where it happens" },
  ] },
  { title: "Utility", items: [
    { id: "fullbody", kind: "fullbody", label: "Full-body generator", blurb: "A head-to-toe look of the character" },
    { id: "sheet", label: "Character sheet generator", blurb: "Several angles of one character" },
    { id: "text", kind: "text", label: "Text prompt", blurb: "Describe the shot" },
    { id: "note", kind: "note", label: "Note", blurb: "A reminder that is not sent anywhere" },
  ] },
  { title: "Media", items: [
    { id: "image", label: "Image", blurb: "Bring in a picture" },
    { id: "clip", label: "Video", blurb: "Bring in a clip" },
  ] },
];

export const STYLES = ["None", "Editorial", "Cinematic", "Minimal studio", "Film grain", "Golden hour", "Luxury product"];

const uid = () => `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newNode(kind: NodeKind, position: { x: number; y: number }, data: CanvasNodeData = {}): CNode {
  const base: CanvasNodeData = kind === "generator" || kind === "fullbody" ? { ratio: kind === "fullbody" ? "9:16" : "4:5" } : kind === "style" ? { style: "None" } : {};
  return { id: uid(), type: kind, position, data: { ...base, ...data } };
}

// A new canvas is blank. This is the ready-made flow offered as the "Starter flow" template: the character, text and style feed a
// full-body generator, which feeds the image generator together with two products, a scene and the text.
function starterGraph(): { nodes: CNode[]; edges: Edge[] } {
  // Nodes are about 264 px wide and 330 to 560 px tall (title, display, controls) with port labels beside them, so the columns and rows are spaced wide.
  const character = newNode("character", { x: 0, y: 0 });
  const productA = newNode("product", { x: 0, y: 520 });
  const productB = newNode("product", { x: 0, y: 1040 });
  const text = newNode("text", { x: 440, y: 0 });
  const style = newNode("style", { x: 440, y: 520 });
  const scene = newNode("scene", { x: 440, y: 1040 });
  const body = newNode("fullbody", { x: 900, y: 120 });
  const gen = newNode("generator", { x: 1380, y: 480 });
  const wire = (a: CNode, b: CNode, port: PortId): Edge => makeEdge(a.id, b.id, port);
  return {
    nodes: [character, productA, productB, text, style, scene, body, gen],
    edges: [wire(character, body, "character"), wire(text, body, "description"), wire(style, body, "style"), wire(body, gen, "ingredients"), wire(productA, gen, "product"), wire(productB, gen, "product"), wire(scene, gen, "scene"), wire(text, gen, "description")],
  };
}

// Templates: the built-in starter flow plus the user's own, saved in this browser for every project.
export type CanvasTemplate = { id: string; name: string; nodes: CNode[]; edges: Edge[]; builtIn?: boolean };
const TEMPLATES_KEY = "eclipse-canvas-templates";

export function loadTemplates(): CanvasTemplate[] {
  let mine: CanvasTemplate[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]");
    if (Array.isArray(raw)) mine = raw.filter((t) => t && typeof t.name === "string" && Array.isArray(t.nodes) && Array.isArray(t.edges));
  } catch {}
  return [{ id: "starter", name: "Starter flow", builtIn: true, ...starterGraph() }, ...mine];
}

function writeTemplates(list: CanvasTemplate[]) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list.filter((t) => !t.builtIn))); } catch {}
}

// Keep the layout, the wiring and what was typed; leave out results and errors.
export function saveTemplate(name: string, nodes: CNode[], edges: Edge[]): CanvasTemplate[] {
  const t: CanvasTemplate = {
    id: `t-${Date.now().toString(36)}`, name: name.trim().slice(0, 40) || "My template",
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data: { ...data, error: undefined, note: undefined, gens: undefined, pending: undefined, pick: undefined } })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  };
  const list = [...loadTemplates(), t];
  writeTemplates(list);
  return list;
}

export function deleteTemplate(id: string): CanvasTemplate[] {
  const list = loadTemplates().filter((t) => t.id !== id);
  writeTemplates(list);
  return list;
}

// A copy of a template with fresh ids, moved so its top-left corner lands at `at`.
export function instantiate(t: CanvasTemplate, at: { x: number; y: number }): { nodes: CNode[]; edges: Edge[] } {
  const ids = new Map<string, string>();
  const minX = Math.min(...t.nodes.map((n) => n.position.x)), minY = Math.min(...t.nodes.map((n) => n.position.y));
  const nodes = t.nodes.map((n) => {
    const c = newNode(n.type as NodeKind, { x: n.position.x - minX + at.x, y: n.position.y - minY + at.y }, { ...n.data });
    ids.set(n.id, c.id);
    return c;
  });
  const edges = migrateEdges(nodes, t.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ ...e, id: `e-${ids.get(e.source)}-${ids.get(e.target)}-${e.targetHandle ?? "in"}`, source: ids.get(e.source)!, target: ids.get(e.target)! })));
  return { nodes, edges };
}

export type SavedCanvas = { nodes: CNode[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } | null };

// Older canvases kept one render per generator in pendingId / genId (and a link that expired); turn them into the current fields.
export function migrateNode(n: CNode): CNode {
  const d = n.data as CanvasNodeData;
  if (!("pendingId" in d) && !("genId" in d) && !("imageUrl" in d) && !("busy" in d)) return n;
  const next: CanvasNodeData = { ...d };
  if (d.pendingId && !next.pending?.length) next.pending = [d.pendingId];
  if (d.genId && !next.gens?.length) { next.gens = [d.genId]; next.pick = d.genId; }
  delete next.pendingId; delete next.genId; delete next.imageUrl; delete next.busy;
  return { ...n, data: next };
}

// The address of a node's chosen picture (our own, so it does not expire).
export const refFileUrl = (r: NonNullable<CanvasNodeData["ref"]>) => (r.type === "upload" ? `/api/uploads/${r.id}/file` : `/api/generations/${r.id}/file`);
