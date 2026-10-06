import type { Edge, Node } from "@xyflow/react";

// Canvas: a free-form graph of nodes that feeds the image generator. Saved per project in this browser.
export type NodeKind = "character" | "product" | "scene" | "text" | "style" | "fullbody" | "generator";

export type CanvasNodeData = {
  text?: string;      // text node: the prompt
  desc?: string;      // ingredient nodes: a short description until the Library can supply real ones
  style?: string;     // style node
  ratio?: string;     // generator node
  busy?: boolean;     // generator node, while a render is running
  error?: string;
  imageUrl?: string;  // generator node: latest result
};
export type CNode = Node<CanvasNodeData>;

export const NODE_CATALOG: { kind: NodeKind; label: string; blurb: string }[] = [
  { kind: "text", label: "Text prompt", blurb: "Describe the shot" },
  { kind: "character", label: "Character", blurb: "Who is in it" },
  { kind: "product", label: "Product", blurb: "What is being shown" },
  { kind: "scene", label: "Scene", blurb: "Where it happens" },
  { kind: "style", label: "Style", blurb: "The look and feel" },
  { kind: "fullbody", label: "Full-body generator", blurb: "Builds a head-to-toe look of the character" },
  { kind: "generator", label: "Image generator", blurb: "Turns the nodes wired in into a picture" },
];

export const STYLES = ["None", "Editorial", "Cinematic", "Minimal studio", "Film grain", "Golden hour", "Luxury product"];
export const RATIOS = ["1:1", "4:5", "9:16", "16:9"];

const key = (projectId: string) => `eclipse-canvas-${projectId}`;
const uid = () => `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newNode(kind: NodeKind, position: { x: number; y: number }, data: CanvasNodeData = {}): CNode {
  const base: CanvasNodeData = kind === "generator" || kind === "fullbody" ? { ratio: kind === "fullbody" ? "9:16" : "4:5" } : kind === "style" ? { style: "None" } : {};
  return { id: uid(), type: kind, position, data: { ...base, ...data } };
}

// The starting canvas: eight nodes, eight wires. The character, text and style feed a full-body generator, which feeds the image
// generator together with two products, a scene and the text.
export function defaultGraph(): { nodes: CNode[]; edges: Edge[] } {
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
  try {
    localStorage.setItem(key(projectId), JSON.stringify({
      nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data: { ...data, busy: false } })),
      edges: edges.map(({ id, source, target }) => ({ id, source, target })),
      viewport: viewport ?? null,
    }));
  } catch {}
}

// "Open in canvas" from the prompt box: add a text node and a generator, wired together, below whatever is already there.
export function seedFromPrompt(projectId: string, seed: { prompt: string; ratio: string }) {
  const existing = loadCanvas(projectId) ?? defaultGraph();
  const maxY = existing.nodes.reduce((m, n) => Math.max(m, n.position.y + 320), 0);
  const text = newNode("text", { x: 380, y: maxY + 40 }, { text: seed.prompt });
  const gen = newNode("generator", { x: 780, y: maxY + 40 }, { ratio: seed.ratio });
  saveCanvas(projectId, [...existing.nodes, text, gen], [...existing.edges, { id: `e-${text.id}`, source: text.id, target: gen.id }], null);
}

// The prompt a generator sends: the text nodes, each ingredient description and the style wired into it, and (through a
// full-body generator) whatever feeds that one too.
export function buildPrompt(nodes: CNode[], edges: Edge[], generatorId: string): string {
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
  const parts: string[] = [];
  for (const n of inputs.filter((x) => x.type === "text")) if (n.data.text?.trim()) parts.push(n.data.text.trim());
  for (const [kind, label] of [["character", "Character"], ["product", "Product"], ["scene", "Scene"]] as const)
    for (const n of inputs.filter((x) => x.type === kind)) if (n.data.desc?.trim()) parts.push(`${label}: ${n.data.desc.trim()}`);
  for (const n of inputs.filter((x) => x.type === "style")) if (n.data.style && n.data.style !== "None") parts.push(`Style: ${n.data.style}`);
  if (nodes.find((n) => n.id === generatorId)?.type === "fullbody" && parts.length) parts.push("Full body shot, head to toe");
  return parts.join(". ").slice(0, 2000);
}
