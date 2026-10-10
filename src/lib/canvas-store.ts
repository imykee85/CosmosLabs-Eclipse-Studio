import type { Edge } from "@xyflow/react";
import { clerkEnabled } from "./clerk-enabled";
import { migrateNode, newNode, type CNode, type SavedCanvas } from "./canvas";
import { isGen, outputOf } from "./canvas-flow";

// The canvas library of one project. Signed in: the account holds the canvases (so they follow you across devices) and this browser keeps a copy of each
// that is used when the account cannot be reached; a copy that could not be sent is marked and wins on the next open. Demo mode (no sign-in): browser only.

export type CanvasMeta = { id: string; name: string; nodeCount: number; updatedAt: number; deletedAt: number | null; thumbId: string | null };
export type CanvasDoc = SavedCanvas;

const idxKey = (projectId: string) => `eclipse-canvas-index-${projectId}`;
const docKey = (id: string) => `eclipse-canvas-doc-${id}`;
const dirtyKey = (id: string) => `eclipse-canvas-dirty-doc-${id}`;
const legacyKey = (projectId: string) => `eclipse-canvas-${projectId}`; // the one canvas older versions kept per project
const legacyDirty = (projectId: string) => `eclipse-canvas-dirty-${projectId}`;
export const lastKey = (projectId: string) => `eclipse-canvas-last-${projectId}`;

const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const drop = (k: string) => { try { localStorage.removeItem(k); } catch {} };
const newId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ms = (v: unknown): number => { const t = typeof v === "string" || typeof v === "number" ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? t : Date.now(); };

type ServerMeta = { id: string; name: string; nodeCount: number; thumbId: string | null; updatedAt: string; deletedAt: string | null };
const fromServer = (m: ServerMeta): CanvasMeta => ({ id: m.id, name: m.name, nodeCount: m.nodeCount, thumbId: m.thumbId ?? null, updatedAt: ms(m.updatedAt), deletedAt: m.deletedAt ? ms(m.deletedAt) : null });

function normalize(d: unknown): CanvasDoc | null {
  const g = d as CanvasDoc | null;
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
  return { ...g, nodes: g.nodes.map(migrateNode) };
}

// What is saved of a graph: layout, wiring and everything typed or chosen; running work is kept so it can be picked up again.
function payloadOf(nodes: CNode[], edges: Edge[], viewport?: CanvasDoc["viewport"]): CanvasDoc {
  return {
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data: { ...data } })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    viewport: viewport ?? null,
  };
}

// The render shown on a canvas's library card: the first generator's picture that has been made.
export function thumbOf(nodes: CNode[]): string | null {
  for (const n of nodes) if (isGen(n.type)) { const id = outputOf(n); if (id) return id; }
  return null;
}

const localIndex = (projectId: string): CanvasMeta[] => read<CanvasMeta[]>(idxKey(projectId)) ?? [];
const putIndex = (projectId: string, list: CanvasMeta[]) => write(idxKey(projectId), list);

function upsertLocal(projectId: string, meta: CanvasMeta) {
  const list = localIndex(projectId).filter((m) => m.id !== meta.id);
  putIndex(projectId, [meta, ...list]);
}

// The canvas an older version saved for this project, turned into a canvas of the library (once).
function takeLegacy(projectId: string): CanvasDoc | null {
  const doc = normalize(read(legacyKey(projectId)));
  return doc && doc.nodes.length ? doc : null;
}

export async function listCanvases(projectId: string, bin = false): Promise<CanvasMeta[]> {
  if (clerkEnabled) {
    try {
      const res = await fetch(`/api/canvases?projectId=${encodeURIComponent(projectId)}&bin=${bin ? 1 : 0}`);
      if (res.ok) {
        const items = ((await res.json()).items ?? []).map(fromServer) as CanvasMeta[];
        if (!bin && items.length === 0) {
          // Nothing in the account yet: a canvas only this browser has (saved before the library existed) becomes the first one.
          const legacy = takeLegacy(projectId);
          if (legacy) { const made = await createCanvas(projectId, "Canvas 1", legacy); drop(legacyKey(projectId)); drop(legacyDirty(projectId)); return made ? [made] : []; }
        }
        if (!bin) {
          // Keep this browser's index in step with the account (its copies of canvases that are gone are dropped).
          const live = new Set(items.map((m) => m.id));
          const kept = localIndex(projectId).filter((m) => m.deletedAt != null && !live.has(m.id));
          putIndex(projectId, [...items, ...kept]);
        }
        return items;
      }
    } catch {}
  }
  let list = localIndex(projectId);
  if (!list.length) {
    const legacy = takeLegacy(projectId);
    if (legacy) {
      const meta: CanvasMeta = { id: newId(), name: "Canvas 1", nodeCount: legacy.nodes.length, updatedAt: Date.now(), deletedAt: null, thumbId: thumbOf(legacy.nodes) };
      write(docKey(meta.id), legacy);
      putIndex(projectId, [meta]);
      drop(legacyKey(projectId)); drop(legacyDirty(projectId));
      list = [meta];
    }
  }
  return list.filter((m) => (bin ? m.deletedAt != null : m.deletedAt == null)).sort((a, b) => (bin ? (b.deletedAt ?? 0) - (a.deletedAt ?? 0) : b.updatedAt - a.updatedAt));
}

export async function createCanvas(projectId: string, name?: string, doc?: CanvasDoc | null): Promise<CanvasMeta | null> {
  const nm = (name ?? "").trim().slice(0, 60) || "Untitled canvas";
  const body = doc ?? { nodes: [], edges: [], viewport: null };
  if (clerkEnabled) {
    try {
      const res = await fetch("/api/canvases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, name: nm, data: body, thumbId: thumbOf(body.nodes) }) });
      if (res.ok) {
        const meta = fromServer((await res.json()).item);
        write(docKey(meta.id), body);
        upsertLocal(projectId, meta);
        return meta;
      }
      throw new Error((await res.json().catch(() => ({}))).error ?? "Could not create the canvas.");
    } catch (e) { throw e instanceof Error ? e : new Error("Could not create the canvas."); }
  }
  const meta: CanvasMeta = { id: newId(), name: nm, nodeCount: body.nodes.length, updatedAt: Date.now(), deletedAt: null, thumbId: thumbOf(body.nodes) };
  write(docKey(meta.id), body);
  upsertLocal(projectId, meta);
  return meta;
}

export async function loadCanvasDoc(projectId: string, id: string): Promise<{ meta: CanvasMeta; doc: CanvasDoc } | null> {
  const metaLocal = localIndex(projectId).find((m) => m.id === id) ?? null;
  const local = normalize(read(docKey(id)));
  if (clerkEnabled) {
    // A copy this browser could not send wins (it is newer); it is sent again by the next save.
    const unsynced = (() => { try { return !!localStorage.getItem(dirtyKey(id)); } catch { return false; } })();
    try {
      const res = await fetch(`/api/canvases/${encodeURIComponent(id)}`);
      if (res.ok) {
        const j = await res.json();
        const meta = fromServer({ ...j.item, nodeCount: j.data?.nodes?.length ?? 0, thumbId: null });
        const doc = unsynced && local ? local : normalize(j.data);
        if (doc) { write(docKey(id), doc); upsertLocal(projectId, { ...(metaLocal ?? meta), id, name: meta.name, updatedAt: meta.updatedAt, deletedAt: meta.deletedAt }); return { meta: { ...(metaLocal ?? meta), name: meta.name, deletedAt: meta.deletedAt }, doc }; }
      } else if (res.status === 404) return null;
    } catch {}
  }
  return local && metaLocal ? { meta: metaLocal, doc: local } : local ? { meta: { id, name: "Canvas", nodeCount: local.nodes.length, updatedAt: Date.now(), deletedAt: null, thumbId: null }, doc: local } : null;
}

// Save a graph. Always kept in this browser; signed in, also sent to the account. Returns "saved" or "local" (kept here, not yet in the account).
export async function saveCanvasDoc(projectId: string, id: string, nodes: CNode[], edges: Edge[], viewport?: CanvasDoc["viewport"]): Promise<"saved" | "local"> {
  const doc = payloadOf(nodes, edges, viewport);
  const thumbId = thumbOf(nodes);
  write(docKey(id), doc);
  const prev = localIndex(projectId).find((m) => m.id === id);
  upsertLocal(projectId, { id, name: prev?.name ?? "Canvas", nodeCount: nodes.length, updatedAt: Date.now(), deletedAt: prev?.deletedAt ?? null, thumbId });
  if (!clerkEnabled) return "saved";
  try {
    const res = await fetch(`/api/canvases/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: doc, thumbId }) });
    if (res.ok) { drop(dirtyKey(id)); return "saved"; }
  } catch {}
  try { localStorage.setItem(dirtyKey(id), "1"); } catch {}
  return "local";
}

async function patch(id: string, body: object): Promise<void> {
  const res = await fetch(`/api/canvases/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong. Please try again.");
}

function mutateLocal(projectId: string, id: string, f: (m: CanvasMeta) => CanvasMeta) {
  putIndex(projectId, localIndex(projectId).map((m) => (m.id === id ? f(m) : m)));
}

export async function renameCanvas(projectId: string, id: string, name: string): Promise<void> {
  const nm = name.trim().slice(0, 60);
  if (!nm) throw new Error("Give the canvas a name.");
  if (clerkEnabled) await patch(id, { action: "rename", name: nm });
  mutateLocal(projectId, id, (m) => ({ ...m, name: nm }));
}

export async function trashCanvas(projectId: string, id: string): Promise<void> {
  if (clerkEnabled) await patch(id, { action: "trash" });
  mutateLocal(projectId, id, (m) => ({ ...m, deletedAt: Date.now() }));
}

export async function restoreCanvas(projectId: string, id: string): Promise<void> {
  if (clerkEnabled) await patch(id, { action: "restore" });
  mutateLocal(projectId, id, (m) => ({ ...m, deletedAt: null }));
}

export async function deleteCanvasForever(projectId: string, id: string): Promise<void> {
  if (clerkEnabled) {
    const res = await fetch(`/api/canvases/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not delete the canvas.");
  }
  putIndex(projectId, localIndex(projectId).filter((m) => m.id !== id));
  drop(docKey(id)); drop(dirtyKey(id));
}

export async function duplicateCanvas(projectId: string, id: string): Promise<CanvasMeta | null> {
  const src = await loadCanvasDoc(projectId, id);
  if (!src) throw new Error("That canvas could not be opened.");
  const base = src.meta.name.replace(/ copy( \d+)?$/, "");
  // Results made in the original stay (they are Library images); running work is not copied.
  const nodes = src.doc.nodes.map((n) => ({ ...n, data: { ...n.data, pending: undefined, error: undefined } }));
  return createCanvas(projectId, `${base} copy`, { ...src.doc, nodes });
}

// "Open canvas" in Image Studio: a new canvas holding the typed prompt as a text node wired into an image generator.
export async function createCanvasFromPrompt(projectId: string, seed: { prompt: string; ratio: string }): Promise<CanvasMeta | null> {
  const text = newNode("text", { x: 0, y: 0 }, { text: seed.prompt });
  const gen = newNode("generator", { x: 420, y: 0 }, { ratio: seed.ratio });
  const name = seed.prompt.replace(/\s+/g, " ").trim().slice(0, 40) || "From Image Studio";
  return createCanvas(projectId, name, { nodes: [text, gen], edges: [{ id: `e-${text.id}-${gen.id}`, source: text.id, target: gen.id }], viewport: null });
}
