import { clerkEnabled } from "./clerk-enabled";
import type { Edge, Node } from "@xyflow/react";

// Canvas: a free-form graph of nodes that feeds the image generator. Saved per project in this browser and, when signed in, to the account.
export type NodeKind = "character" | "product" | "scene" | "text" | "style" | "fullbody" | "note" | "generator";

export type CanvasNodeData = {
  text?: string;      // text node: the prompt
  desc?: string;      // ingredient nodes: a short description until the Library can supply real ones
  ref?: { type: "upload" | "render"; id: string; label: string }; // ingredient nodes: a picture chosen from the Library
  style?: string;     // style node
  ratio?: string;     // generator node
  model?: string;     // generator node: image model id
  busy?: boolean;     // (unused now: a running render is marked by pendingId)
  pendingId?: string; // generator node: the render in progress, kept so it can be picked up after leaving the page
  genId?: string;     // generator node: the finished render, used to fetch a fresh image link

  error?: string;
  imageUrl?: string;  // generator node: latest result
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

const key = (projectId: string) => `eclipse-canvas-${projectId}`;
const uid = () => `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newNode(kind: NodeKind, position: { x: number; y: number }, data: CanvasNodeData = {}): CNode {
  const base: CanvasNodeData = kind === "generator" || kind === "fullbody" ? { ratio: kind === "fullbody" ? "9:16" : "4:5" } : kind === "style" ? { style: "None" } : {};
  return { id: uid(), type: kind, position, data: { ...base, ...data } };
}

// A new canvas is blank. This is the ready-made flow offered as the "Starter flow" template: the character, text and style feed a
// full-body generator, which feeds the image generator together with two products, a scene and the text.
function starterGraph(): { nodes: CNode[]; edges: Edge[] } {
  const character = newNode("character", { x: 0, y: 0 });
  const productA = newNode("product", { x: 0, y: 300 });
  const productB = newNode("product", { x: 0, y: 600 });
  const text = newNode("text", { x: 360, y: -60 });
  const style = newNode("style", { x: 360, y: 320 });
  const scene = newNode("scene", { x: 360, y: 570 });
  const body = newNode("fullbody", { x: 740, y: -20 });
  const gen = newNode("generator", { x: 1120, y: 180 });
  const wire = (a: CNode, b: CNode) => ({ id: `e-${a.id}-${b.id}`, source: a.id, target: b.id });
  return {
    nodes: [character, productA, productB, text, style, scene, body, gen],
    edges: [wire(character, body), wire(text, body), wire(style, body), wire(body, gen), wire(productA, gen), wire(productB, gen), wire(scene, gen), wire(text, gen)],
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
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data: { ...data, busy: false, error: undefined, imageUrl: undefined, pendingId: undefined, genId: undefined } })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
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
  const edges = t.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ id: `e-${ids.get(e.source)}-${ids.get(e.target)}`, source: ids.get(e.source)!, target: ids.get(e.target)! }));
  return { nodes, edges };
}

export type SavedCanvas = { nodes: CNode[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } | null };

export function loadCanvas(projectId: string): SavedCanvas | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const g = JSON.parse(raw) as SavedCanvas;
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
    return { ...g, nodes: g.nodes.map((n) => ({ ...n, data: { ...n.data, busy: false } })) };
  } catch { return null; }
}

export function saveCanvas(projectId: string, nodes: CNode[], edges: Edge[], viewport?: SavedCanvas["viewport"]) {
  const payload: SavedCanvas = {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data: { ...data, busy: false } })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    viewport: viewport ?? null,
  };
  try { localStorage.setItem(key(projectId), JSON.stringify(payload)); } catch {}
  pushToServer(projectId, payload);
}

// With sign-in on, every save is also sent to the account so the canvas follows it across devices. This browser keeps
// its own copy too; if a send fails the copy is marked unsynced so the next load keeps it instead of an older server copy.
const dirtyKey = (projectId: string) => `eclipse-canvas-dirty-${projectId}`;

function pushToServer(projectId: string, payload: SavedCanvas) {
  if (!clerkEnabled) return;
  fetch(`/api/canvas/${encodeURIComponent(projectId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: payload }) })
    .then((r) => { try { r.ok ? localStorage.removeItem(dirtyKey(projectId)) : localStorage.setItem(dirtyKey(projectId), "1"); } catch {} })
    .catch(() => { try { localStorage.setItem(dirtyKey(projectId), "1"); } catch {} });
}

// Before the canvas opens: bring the account's saved copy into this browser, unless this browser has newer unsynced work.
export async function hydrateCanvasFromServer(projectId: string): Promise<void> {
  if (!clerkEnabled) return;
  try {
    if (localStorage.getItem(dirtyKey(projectId))) return;
    const res = await fetch(`/api/canvas/${encodeURIComponent(projectId)}`);
    if (!res.ok) return;
    const { data } = await res.json();
    if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) localStorage.setItem(key(projectId), JSON.stringify(data));
  } catch {}
}

// "Open in canvas" from the prompt box: add a text node and a generator, wired together, below whatever is already there.
export function seedFromPrompt(projectId: string, seed: { prompt: string; ratio: string }) {
  const existing = loadCanvas(projectId) ?? { nodes: [], edges: [] };
  const maxY = existing.nodes.reduce((m, n) => Math.max(m, n.position.y + 320), -40);
  const text = newNode("text", { x: 380, y: maxY + 40 }, { text: seed.prompt });
  const gen = newNode("generator", { x: 780, y: maxY + 40 }, { ratio: seed.ratio });
  saveCanvas(projectId, [...existing.nodes, text, gen], [...existing.edges, { id: `e-${text.id}`, source: text.id, target: gen.id }], null);
}

// The address of a node's chosen picture (our own, so it does not expire).
export const refFileUrl = (r: NonNullable<CanvasNodeData["ref"]>) => (r.type === "upload" ? `/api/uploads/${r.id}/file` : `/api/generations/${r.id}/file`);

// The inputs wired into a generator, in the order the prompt reads them (a full-body generator's inputs count too).
function wiredInputs(nodes: CNode[], edges: Edge[], generatorId: string): CNode[] {
  const seen = new Set<string>();
  const inputs: CNode[] = [];
  const collect = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const e of edges) {
      if (e.target !== id) continue;
      const n = nodes.find((x) => x.id === e.source);
      if (!n || inputs.includes(n)) continue;
      inputs.push(n);
      if (n.type === "fullbody") collect(n.id);
    }
  };
  collect(generatorId);
  return inputs;
}

// The pictures chosen in the Character, Product and Scene nodes wired into a generator, in that order (the order the model sees them).
export function collectReferences(nodes: CNode[], edges: Edge[], generatorId: string): { type: "upload" | "render"; id: string }[] {
  const inputs = wiredInputs(nodes, edges, generatorId);
  const out: { type: "upload" | "render"; id: string }[] = [];
  for (const kind of ["character", "product", "scene"] as const)
    for (const n of inputs.filter((x) => x.type === kind)) if (n.data.ref && !out.some((o) => o.id === n.data.ref!.id)) out.push({ type: n.data.ref.type, id: n.data.ref.id });
  return out;
}

// The prompt a generator sends: the text nodes, each ingredient description and the style wired into it, and (through a
// full-body generator) whatever feeds that one too.
export function buildPrompt(nodes: CNode[], edges: Edge[], generatorId: string): string {
  const inputs = wiredInputs(nodes, edges, generatorId);
  const parts: string[] = [];
  for (const n of inputs.filter((x) => x.type === "text")) if (n.data.text?.trim()) parts.push(n.data.text.trim());
  for (const [kind, label] of [["character", "Character"], ["product", "Product"], ["scene", "Scene"]] as const)
    for (const n of inputs.filter((x) => x.type === kind)) if (n.data.desc?.trim()) parts.push(`${label}: ${n.data.desc.trim()}`);
  for (const n of inputs.filter((x) => x.type === "style")) if (n.data.style && n.data.style !== "None") parts.push(`Style: ${n.data.style}`);
  if (nodes.find((n) => n.id === generatorId)?.type === "fullbody" && parts.length) parts.push("Full body shot, head to toe");
  return parts.join(". ").slice(0, 2000);
}
