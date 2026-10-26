"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, ConnectionLineType, Controls, getNodesBounds, getViewportForBounds, MiniMap, Panel, ReactFlow, ReactFlowProvider, SelectionMode, useEdgesState, useNodesState, useReactFlow, useStoreApi, ViewportPortal,
  type Connection, type Edge, type FinalConnectionState, type NodeChange, type NodeMouseHandler,
} from "@xyflow/react";
import { ArrowLeft, AudioLines, Clapperboard, Eraser, Film, Group, LayoutTemplate, ListOrdered, MessageSquareText, Mic, Mountain, Music2, Package, Palette, PersonStanding, Minimize2, Plus, Search, Settings, Share2, Shirt, StickyNote, Trash2, Type, User, X, Image as ImageIcon, Maximize2, Undo2, Redo2, MousePointer2, Hand, ZoomIn } from "lucide-react";
import AgentMenu from "@/components/create/AgentMenu";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgentHost } from "@/lib/agent-chat";
import ModelPicker, { AUTO } from "@/components/create/ModelPicker";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import RenderDialog from "@/components/library/RenderDialog";
import { instantiate, newNode, NODE_GROUPS, refFileUrl, type CanvasNodeData, type CanvasTemplate, type CNode, type NodeKind } from "@/lib/canvas";
import { deleteAnyTemplate, listAllTemplates, saveAnyTemplate } from "@/lib/canvas-templates";
import { alignDrag, type Guides } from "@/lib/canvas-guides";
import { useCanvasSettings } from "@/lib/canvas-settings";
import { useCanvasComments } from "@/lib/use-canvas-comments";
import { canWire, inputsOf, isAudioNode, makesPicture, makeEdge, NEXT_KINDS, outLabelOf, picturesOf, portFor, portLabel, PREV_KINDS, TITLES, withoutReplaced, type PortId } from "@/lib/canvas-flow";
import { renameCanvas, saveCanvasDoc, type CanvasDoc, type CanvasMeta } from "@/lib/canvas-store";
import { useAgent } from "@/lib/use-agent";
import { MODEL_STORAGE_KEY, useModels } from "@/lib/use-models";
import type { Render } from "@/lib/use-renders";
import { CanvasCtx, type AskRequest } from "./CanvasContext";
import { CommentsPanel, SettingsModal, SharePanel } from "./CanvasPanels";
import { nodeTypes } from "./node-types";
import "@/components/create/create.css";
import "./canvas.css";

const ICONS: Record<string, React.ReactNode> = {
  text: <Type size={20} />, character: <User size={20} />, product: <Package size={20} />, scene: <Mountain size={20} />, style: <Palette size={20} />,
  fullbody: <PersonStanding size={20} />, generator: <ImageIcon size={20} />, note: <StickyNote size={20} />,
  video: <Clapperboard size={20} />, videogen: <Clapperboard size={20} />, sheet: <Shirt size={20} />, image: <ImageIcon size={20} />, clip: <Film size={20} />,
  assistant: <MessageSquareText size={20} />, editor: <Eraser size={20} />, upscaler: <ZoomIn size={20} />, list: <ListOrdered size={20} />, voiceover: <Mic size={20} />, sfx: <AudioLines size={20} />, music: <Music2 size={20} />,
};
const DOUBLE_TAP_MS = 320;

// The app theme lives on <html data-app-theme>; follow it so the canvas switches with the toggle.
// The phone layout (same query the rest of the app uses): the toolbar docks at the bottom and the node list is a bottom sheet.
const PHONE_QUERY = "(max-width: 800px), (pointer: coarse) and (max-width: 1000px)";
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

function useAppDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.appTheme !== "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

type AddMenu = { nodeId: string; side: "after" | "before"; left: number; top: number; flow?: { x: number; y: number }; port?: PortId };

// A spot at (x, y) or just below whatever is already there, so a new node never lands on top of another.
function freeSpot(nodes: CNode[], x: number, y: number): { x: number; y: number } {
  let pos = { x, y };
  for (let i = 0; i < 30; i++) {
    const hit = nodes.find((n) => Math.abs(n.position.x - pos.x) < 320 && pos.y > n.position.y - 80 && pos.y < n.position.y + (n.measured?.height ?? 320) + 20);
    if (!hit) return pos;
    pos = { x: pos.x, y: hit.position.y + (hit.measured?.height ?? 320) + 40 };
  }
  return pos;
}

function Inner({ projectId, canvasId, meta, doc, onBack }: { projectId: string; canvasId: string; meta: CanvasMeta; doc: CanvasDoc; onBack: () => void }) {
  const saved = doc;
  const [nodes, setNodes, onNodesChange] = useNodesState<CNode>(doc.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(doc.edges);
  const [panel, setPanel] = useState<null | "nodes" | "templates" | "share" | "comments">(null);
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<CanvasTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [tplError, setTplError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, changeSettings] = useCanvasSettings();
  const [guides, setGuides] = useState<Guides | null>(null);   // alignment lines shown while a node is dragged
  const comments = useCanvasComments(canvasId);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskRequest | null>(null);      // a picker or dialog a node asked for
  const [detail, setDetail] = useState<Render | null>(null);    // a finished image shown with its details
  const [addMenu, setAddMenu] = useState<AddMenu | null>(null); // the "add the next node" menu
  const [undo, setUndo] = useState<{ nodes: CNode[]; edges: Edge[] } | null>(null); // what was just deleted, for the Undo bar
  const [name, setName] = useState(meta.name);
  const [status, setStatus] = useState<"saved" | "saving" | "local">("saved");
  const phone = usePhone();
  const [tool, setTool] = useState<"pan" | "select">("pan"); // Pan: drag the board. Select: drag a box round nodes (the only way to do it with a finger).
  const [cat, setCat] = useState<string>("All");           // node list category
  const [notice, setNotice] = useState<string | null>(null); // a short message (for example a wire that cannot be made)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const groupDrag = useRef<{ id: string; from: { x: number; y: number }; members: Map<string, { x: number; y: number }> } | null>(null);
  const lastTap = useRef({ id: "", t: 0 });
  const dark = useAppDark();
  const models = useModels({ edit: true });
  const agent = useAgent();
  const store = useStoreApi();
  const { screenToFlowPosition, getNode, getNodes, getEdges, getViewport, setViewport } = useReactFlow();
  // The agent works on the selected image generator (else the first one): it can put a prompt in it and, once the user approves, run it.
  const targetGen = () => { const all = getNodes() as CNode[]; return all.find((n) => n.type === "generator" && n.selected) ?? all.find((n) => n.type === "generator") ?? null; };
  useAgentHost({
    page: "canvas",
    context: () => { const g = targetGen(); return { prompt: g?.data.prompt ?? "", ratio: g?.data.ratio, qty: g?.data.qty }; },
    setPrompt: (text) => { const g = targetGen(); if (g) setNodes((ns) => ns.map((n) => (n.id === g.id ? { ...n, data: { ...n.data, prompt: text } } : n))); },
    generate: async ({ prompt, count }) => {
      const g = targetGen();
      if (!g) return "There is no image generator on this canvas. Add one first.";
      setNodes((ns) => ns.map((n) => (n.id === g.id ? { ...n, data: { ...n.data, ...(prompt ? { prompt } : {}), ...(count ? { qty: count } : {}) } } : n)));
      await new Promise((r) => window.setTimeout(r, 120)); // let the node take the new text before it runs
      window.dispatchEvent(new CustomEvent("eclipse-node-run", { detail: { id: g.id } }));
      return "";
    },
  });

  // Save after changes (nodes, wires, camera), a moment after the last one, and at once when you leave.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ nodes, edges, viewport: doc.viewport ?? null as CanvasDoc["viewport"] });
  latest.current.nodes = nodes; latest.current.edges = edges;
  const flush = useCallback(() => {
    timer.current = null;
    const l = latest.current;
    setStatus("saving");
    void saveCanvasDoc(projectId, canvasId, l.nodes, l.edges, l.viewport).then((r) => setStatus(r));
  }, [projectId, canvasId]);
  const persist = useCallback(() => {
    try { latest.current.viewport = getViewport(); } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  }, [flush, getViewport]);
  // Save only when something that is kept changed (what is in the nodes, where they sit, the wiring): measuring the nodes on opening, or selecting one, is not an edit.
  const sigOf = (ns: CNode[], es: Edge[]) => JSON.stringify([ns.map((n) => [n.id, n.type, n.position.x, n.position.y, n.data, n.type === "group" ? [n.width, n.height] : 0]), es.map((e) => [e.id, e.source, e.target])]);
  const lastSig = useRef(sigOf(doc.nodes, doc.edges));
  useEffect(() => { const sig = sigOf(nodes, edges); if (sig === lastSig.current) return; lastSig.current = sig; persist(); }, [nodes, edges, persist]);
  useEffect(() => {
    const leave = () => { if (timer.current) { clearTimeout(timer.current); flush(); } };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
  }, [flush]);

  // Undo and redo for what shapes the canvas: nodes added or removed, where they sit, and the wiring. A change is filed as one step a moment
  // after the last edit. Going back keeps what a node has made since (its pictures, its text): only existence, position and wires are restored.
  const structSig = (ns: CNode[], es: Edge[]) => JSON.stringify([ns.map((n) => [n.id, n.type, Math.round(n.position.x), Math.round(n.position.y)]), es.map((e) => [e.id, e.source, e.sourceHandle ?? "", e.target, e.targetHandle ?? ""])]);
  const hist = useRef<{ past: { nodes: CNode[]; edges: Edge[] }[]; future: { nodes: CNode[]; edges: Edge[] }[]; base: { nodes: CNode[]; edges: Edge[] }; sig: string }>({
    past: [], future: [], base: { nodes: doc.nodes, edges: doc.edges }, sig: structSig(doc.nodes, doc.edges),
  });
  useEffect(() => {
    const h = hist.current;
    const sig = structSig(nodes, edges);
    if (sig === h.sig) return;
    const t = setTimeout(() => {
      h.past.push(h.base);
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      h.base = { nodes, edges };
      h.sig = sig;
      setCanUndo(true); setCanRedo(false);
    }, 350);
    return () => clearTimeout(t);
  }, [nodes, edges]);
  const restoreSnap = useCallback((snap: { nodes: CNode[]; edges: Edge[] }) => {
    const cur = new Map((getNodes() as CNode[]).map((n) => [n.id, n]));
    setNodes(snap.nodes.map((n) => { const c = cur.get(n.id); return c ? { ...c, position: n.position, selected: false } : { ...n, selected: false }; }));
    setEdges(snap.edges);
  }, [getNodes, setNodes, setEdges]);
  const undoStep = useCallback(() => {
    const h = hist.current;
    const now = { nodes: getNodes() as CNode[], edges: getEdges() };
    const dirty = structSig(now.nodes, now.edges) !== h.sig; // an edit not filed yet: go back to the last filed state
    const target = dirty ? h.base : h.past.pop();
    if (!target) return;
    h.future.push(now);
    h.base = target; h.sig = structSig(target.nodes, target.edges);
    restoreSnap(target);
    setCanUndo(h.past.length > 0); setCanRedo(true);
  }, [getNodes, getEdges, restoreSnap]);
  const redoStep = useCallback(() => {
    const h = hist.current;
    const target = h.future.pop();
    if (!target) return;
    h.past.push(h.base);
    h.base = target; h.sig = structSig(target.nodes, target.edges);
    restoreSnap(target);
    setCanUndo(true); setCanRedo(h.future.length > 0);
  }, [restoreSnap]);

  const groupSelectedRef = useRef<() => void>(() => {});

  // Keyboard: Ctrl or Cmd + Z undoes, plus Shift (or Y) redoes, N opens the node list. Not while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]"))) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redoStep(); else undoStep(); }
      else if (mod && k === "y") { e.preventDefault(); redoStep(); }
      else if (mod && k === "g") { e.preventDefault(); groupSelectedRef.current(); }
      else if (!mod && !e.altKey && k === "v") { setTool("select"); }
      else if (!mod && !e.altKey && k === "h") { setTool("pan"); }
      else if (!mod && !e.altKey && k === "n") { e.preventDefault(); setPanel((p) => (p === "nodes" ? null : "nodes")); setQuery(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoStep, redoStep]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Fly the camera to fit some nodes. The tween is driven by hand (frame by frame) because a click on a node leaves the library's own
  // animation interrupted before it starts.
  const flight = useRef(0);
  const flyTo = useCallback((ids: string[] | null, padding: number, maxZoom: number) => {
    const el = wrap.current;
    const list = ids ? ids.map((i) => getNode(i)).filter(Boolean) as CNode[] : getNodes();
    if (!el || !list.length) return;
    const to = getViewportForBounds(getNodesBounds(list), el.clientWidth, el.clientHeight, 0.15, maxZoom, padding);
    const from = getViewport();
    const t0 = performance.now(), ms = 650, id = ++flight.current;
    const step = (now: number) => {
      if (id !== flight.current) return;
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      // interpolate the zoom in log space so it feels even
      const zoom = from.zoom * Math.pow(to.zoom / from.zoom, e);
      setViewport({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [getNode, getNodes, getViewport, setViewport]);

  // Double-tap a node: fly the camera in so that node fills the view. Double-tap it again (or empty space): back to the overview.
  const focus = useCallback((id: string) => { setFocused(id); setHint(false); flyTo([id], 0.35, 1.4); }, [flyTo]);
  const overview = useCallback(() => { setFocused(null); flyTo(null, 0.2, 1); }, [flyTo]);

  const onNodeClick: NodeMouseHandler = useCallback((e, node) => {
    const hit = (e.target as HTMLElement).closest("input, textarea, select, button");
    if (hit) return; // typing and buttons are not double-taps
    const now = Date.now();
    if (lastTap.current.id === node.id && now - lastTap.current.t < DOUBLE_TAP_MS) {
      lastTap.current = { id: "", t: 0 };
      if (focused === node.id) overview(); else focus(node.id);
    } else lastTap.current = { id: node.id, t: now };
  }, [focused, focus, overview]);

  const onPaneClick = useCallback(() => {
    setPanel(null); setAddMenu(null);
    const now = Date.now();
    if (lastTap.current.id === "pane" && now - lastTap.current.t < DOUBLE_TAP_MS) { lastTap.current = { id: "", t: 0 }; overview(); }
    else lastTap.current = { id: "pane", t: now };
  }, [overview]);

  // A wire goes from an output to the input of its own kind (or to Ingredients for a picture). A port that takes one wire swaps the old wire for the new one.
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.target}-${c.targetHandle ?? "in"}-${Date.now().toString(36)}` }, withoutReplaced(es, c.target, c.targetHandle ?? ""))), [setEdges]);
  const isValidConnection = useCallback((c: Connection | Edge) => canWire(getNodes() as CNode[], getEdges(), { source: c.source, target: c.target, targetHandle: c.targetHandle }), [getNodes, getEdges]);

  // A wire dragged out and dropped on empty space opens the same "add the next node" menu, there.
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (state.isValid === false && state.fromNode && state.toNode && state.toHandle) { setNotice(`Cannot connect ${outLabelOf(state.fromNode.type)?.toLowerCase() ?? "this"} to ${portLabel(state.toHandle.id ?? "").toLowerCase()}.`); return; }
    if (state.isValid || !state.fromNode || state.toNode || state.toHandle) return;
    const pt = "changedTouches" in event ? event.changedTouches[0] : event;
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const fromInput = state.fromHandle?.type === "target";
    setAddMenu({ nodeId: state.fromNode.id, side: fromInput ? "before" : "after", port: fromInput ? (state.fromHandle?.id as PortId | undefined) : undefined, left: pt.clientX - box.left, top: pt.clientY - box.top, flow: screenToFlowPosition({ x: pt.clientX, y: pt.clientY }) });
  }, [screenToFlowPosition]);

  const openAdd = useCallback((nodeId: string, side: "after" | "before", anchor: DOMRect) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setPanel(null);
    setAddMenu({ nodeId, side, left: side === "after" ? anchor.right - box.left + 8 : anchor.left - box.left - 252, top: anchor.top - box.top - 6 });
  }, []);

  // Make the chosen node next to (and already wired to) the one the menu came from.
  function addLinked(kind: NodeKind) {
    const m = addMenu;
    const from = m ? getNode(m.nodeId) : null;
    if (!m || !from) { setAddMenu(null); return; }
    const w = from.measured?.width ?? 300;
    const at = m.flow ?? (m.side === "after" ? { x: from.position.x + w + 120, y: from.position.y } : { x: from.position.x - 460, y: from.position.y });
    const n = newNode(kind, freeSpot(getNodes() as CNode[], at.x, at.y));
    // The new node plugs into the port of its own kind (Ingredients where the generator has no such port).
    const port = m.side === "after" ? portFor(from.type, kind) : (m.port ?? portFor(kind, from.type));
    if (!port) { setAddMenu(null); return; }
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), { ...n, selected: true }]);
    setEdges((es) => {
      const edge = m.side === "after" ? makeEdge(from.id, n.id, port) : makeEdge(n.id, from.id, port);
      return [...withoutReplaced(es, edge.target, port), edge];
    });
    setAddMenu(null); setHint(false);
    setTimeout(() => flyTo([from.id, n.id], 0.2, 1), 120);
  }

  function addNode(kind: NodeKind) {
    const r = wrap.current?.getBoundingClientRect();
    const centre = r ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
    const jitter = () => (Math.random() - 0.5) * 80;
    const n = newNode(kind, { x: centre.x - 130 + jitter(), y: centre.y - 90 + jitter() });
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), { ...n, selected: true }]);
    setPanel(null);
  }

  function openPanel(which: "nodes" | "templates" | "share" | "comments") {
    if (panel === which) { setPanel(null); return; }
    if (which === "templates") { setTplError(""); void listAllTemplates().then(setTemplates); }
    setQuery("");
    setPanel(which);
  }

  // Use a template: add a copy to the right of whatever is already on the canvas, then fly to it.
  function applyTemplate(t: CanvasTemplate) {
    const existing = getNodes();
    const at = existing.length
      ? { x: Math.max(...existing.map((n) => n.position.x + (n.measured?.width ?? 300))) + 120, y: Math.min(...existing.map((n) => n.position.y)) }
      : { x: 0, y: 0 };
    const g = instantiate(t, at);
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), ...g.nodes]);
    setEdges((es) => [...es, ...g.edges]);
    setPanel(null); setHint(false);
    setTimeout(() => flyTo(g.nodes.map((n) => n.id), 0.2, 1), 120);
  }

  async function saveAsTemplate() {
    if (!nodes.length) return;
    setTplError("");
    const r = await saveAnyTemplate(tplName || "My template", nodes, edges);
    setTemplates(r.list);
    if (r.error) setTplError(r.error); else setTplName("");
  }

  // Full screen covers the rest of the app (a fixed layer rather than the browser's Fullscreen API, which phones do not offer).
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [full]);

  // Wires run while their source is still making an image, and are dashed while the source has nothing to give yet.
  const shownEdges = useMemo(() => edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source);
    const makes = !!src && (makesPicture(src.type) || src.type === "videogen" || isAudioNode(src.type));
    const waiting = makes && !(src!.data.gens?.length) && !(src!.data.pending?.length);
    const running = makes && (src!.data.pending?.length ?? 0) > 0;
    return { ...e, type: settings.edge === "bezier" ? undefined : settings.edge, animated: running, className: waiting ? "cv-wire-wait" : "" };
  }), [edges, nodes, settings.edge]);

  // Pickers and dialogs a node asked for.
  const askNode = ask && "nodeId" in ask ? (nodes.find((n) => n.id === ask.nodeId) as CNode | undefined) : undefined;
  const modelOf = (d: CanvasNodeData) => (d.model && (d.model === AUTO || models?.some((m) => m.id === d.model)) ? d.model : AUTO);
  const refsMax = (() => {
    if (!askNode || ask?.kind !== "refs" || !models) return -1;
    const wired = picturesOf(inputsOf(nodes, edges, askNode.id)).length;
    const mid = modelOf(askNode.data);
    const cap = mid === AUTO ? Math.max(0, ...models.filter((m) => !m.requiresReference).map((m) => m.maxReferences)) : models.find((m) => m.id === mid)?.maxReferences ?? 0;
    return Math.max(0, cap - wired);
  })();
  const patchNode = (id: string, data: Partial<CanvasNodeData>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
  useEffect(() => {
    // No room for reference pictures (the model takes none, or wired-in nodes already use every place): say so on the node instead of opening an empty picker.
    if (ask?.kind === "refs" && askNode && refsMax === 0) {
      patchNode(askNode.id, { note: "This model has no room for more reference pictures: it takes none, or the wired-in nodes already use them all." });
      setAsk(null);
    }
  }, [ask, askNode, refsMax]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ask?.kind !== "details") return;
    let live = true;
    fetch(`/api/generations/${ask.genId}`).then((r) => (r.ok ? r.json() : null)).then((g) => { if (live && g) setDetail(g as Render); }).catch(() => {}).finally(() => { if (live) setAsk(null); });
    return () => { live = false; };
  }, [ask]);
  useEffect(() => {
    if (!addMenu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAddMenu(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [addMenu]);

  const renamed = useRef(meta.name);
  async function commitName() {
    const nm = name.trim();
    if (!nm) { setName(renamed.current); return; }
    if (nm === renamed.current) return;
    try { await renameCanvas(projectId, canvasId, nm); renamed.current = nm; } catch { setName(renamed.current); }
  }

  // Deleting a node (its trash button, or Delete / Backspace) takes its wires with it and offers Undo for a few seconds. Pictures it made stay in the Library.
  const onDelete = useCallback(({ nodes: dn, edges: de }: { nodes: CNode[]; edges: Edge[] }) => { if (dn.length || de.length) setUndo({ nodes: dn, edges: de }); }, []);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);
  function restoreDeleted() {
    if (!undo) return;
    const u = undo;
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), ...u.nodes.filter((n) => !ns.some((x) => x.id === n.id)).map((n) => ({ ...n, selected: false }))]);
    setEdges((es) => {
      const ids = new Set([...getNodes().map((n) => n.id), ...u.nodes.map((n) => n.id)]);
      return [...es, ...u.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && !es.some((x) => x.id === e.id))];
    });
    setUndo(null);
  }

  const q = query.trim().toLowerCase();
  const groups = NODE_GROUPS.filter((g) => cat === "All" || g.title === cat).map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q) || i.blurb.toLowerCase().includes(q)) })).filter((g) => g.items.length);
  const selectedCount = nodes.filter((n) => n.selected).length;
  function deleteSelected() {
    const ids = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (!ids.size) return;
    const dn = nodes.filter((n) => ids.has(n.id));
    const de = edges.filter((e) => ids.has(e.source) || ids.has(e.target));
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setUndo({ nodes: dn, edges: de });
  }

  // Group the selected nodes: a titled frame behind them. Dragging the frame moves what sits inside it.
  function groupSelected() {
    const sel = nodes.filter((n) => n.selected && n.type !== "group");
    if (!sel.length) return;
    const pad = 40, head = 36;
    const x0 = Math.min(...sel.map((n) => n.position.x)), y0 = Math.min(...sel.map((n) => n.position.y));
    const x1 = Math.max(...sel.map((n) => n.position.x + (n.measured?.width ?? 264))), y1 = Math.max(...sel.map((n) => n.position.y + (n.measured?.height ?? 320)));
    const g = newNode("group", { x: x0 - pad, y: y0 - pad - head });
    g.width = x1 - x0 + pad * 2; g.height = y1 - y0 + pad * 2 + head;
    setNodes((ns) => [{ ...g, selected: true }, ...ns.map((x) => ({ ...x, selected: false }))]);
    store.setState({ nodesSelectionActive: false }); // the box left by a multi-select goes away; only the group is selected now
    setTimeout(() => flyTo([g.id], 0.2, 1), 150);
  }
  groupSelectedRef.current = groupSelected;
  const onNodeDragStart = useCallback((_: unknown, node: CNode) => {
    if (node.type !== "group") { groupDrag.current = null; return; }
    const w = node.measured?.width ?? node.width ?? 480, h = node.measured?.height ?? node.height ?? 340;
    const members = new Map<string, { x: number; y: number }>();
    for (const n of getNodes() as CNode[]) {
      if (n.id === node.id || n.type === "group") continue;
      const cx = n.position.x + (n.measured?.width ?? 264) / 2, cy = n.position.y + (n.measured?.height ?? 320) / 2;
      if (cx >= node.position.x && cx <= node.position.x + w && cy >= node.position.y && cy <= node.position.y + h) members.set(n.id, { ...n.position });
    }
    groupDrag.current = { id: node.id, from: { ...node.position }, members };
  }, [getNodes]);
  const onNodeDrag = useCallback((_: unknown, node: CNode) => {
    const g = groupDrag.current;
    if (!g || g.id !== node.id || !g.members.size) return;
    const dx = node.position.x - g.from.x, dy = node.position.y - g.from.y;
    setNodes((ns) => ns.map((n) => { const m = g.members.get(n.id); return m ? { ...n, position: { x: m.x + dx, y: m.y + dy } } : n; }));
  }, [setNodes]);
  const onNodeDragStop = useCallback(() => { groupDrag.current = null; setGuides(null); }, []);
  // Helper lines: one node dragged alone snaps to the edges and centres of its neighbours, and the lines show what it lined up with.
  const onNodesChangeGuided = useCallback((changes: NodeChange<CNode>[]) => {
    const one = changes.length === 1 ? changes[0] : null;
    if (settings.helperLines && one && one.type === "position" && one.dragging && one.position) {
      const n = getNode(one.id);
      if (n && n.type !== "group") {
        const others = (getNodes() as CNode[]).filter((o) => o.id !== n.id && o.type !== "group").map((o) => ({ x: o.position.x, y: o.position.y, w: o.measured?.width ?? 264, h: o.measured?.height ?? 320 }));
        const r = alignDrag({ x: one.position.x, y: one.position.y, w: n.measured?.width ?? 264, h: n.measured?.height ?? 320 }, others);
        setGuides(r.guides.x.length || r.guides.y.length ? r.guides : null);
        onNodesChange([{ ...one, position: { x: r.x, y: r.y } }]);
        return;
      }
    }
    if (guides && changes.some((c) => c.type === "position" && c.dragging === false)) setGuides(null);
    onNodesChange(changes);
  }, [settings.helperLines, getNode, getNodes, onNodesChange, guides]);
  const commentNode = (() => { const sel = nodes.filter((n) => n.selected && n.type !== "group"); return sel.length === 1 ? { id: sel[0].id, title: TITLES[sel[0].type as NodeKind] ?? "this node" } : null; })();
  const openCommentCount = comments.items.filter((c) => !c.resolved).length;

  const extraBtns = (
    <>
          <button type="button" className="cv-add" aria-expanded={panel === "share"} aria-haspopup="dialog" onClick={() => openPanel("share")} title="Share a view-only link"><Share2 size={16} /> Share</button>
          <button type="button" className="cv-add cv-hist" aria-expanded={panel === "comments"} aria-haspopup="dialog" aria-label={`Comments${openCommentCount ? `, ${openCommentCount} open` : ""}`} title="Comments" onClick={() => openPanel("comments")}><MessageSquareText size={16} />{openCommentCount > 0 ? openCommentCount : ""}</button>
          <button type="button" className="cv-add cv-hist" aria-label="Canvas settings" title="Canvas settings" onClick={() => { setPanel(null); setShowSettings(true); }}><Settings size={16} /></button>
    </>
  );

  const toolbar = (
    <>
        <div className="cv-btns">
          <button type="button" className="cv-add" aria-expanded={panel === "nodes"} aria-haspopup="dialog" onClick={() => openPanel("nodes")} title="Add node (N)"><Plus size={16} /> Add node</button>
          <button type="button" className="cv-add cv-hist" disabled={!canUndo} onClick={undoStep} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
          <button type="button" className="cv-add cv-hist" disabled={!canRedo} onClick={redoStep} aria-label="Redo" title="Redo (Shift+Ctrl+Z)"><Redo2 size={16} /></button>
          <button type="button" className={`cv-add cv-hist ${tool === "select" ? "is-on" : ""}`} aria-pressed={tool === "select"} onClick={() => setTool((t) => (t === "select" ? "pan" : "select"))} aria-label={tool === "select" ? "Select mode: drag a box round nodes" : "Pan mode: drag to move the board"} title={tool === "select" ? "Select (V): drag a box round nodes. Press H for pan." : "Pan (H). Press V to select several nodes."}>{tool === "select" ? <MousePointer2 size={16} /> : <Hand size={16} />}</button>
          {selectedCount > 0 && <button type="button" className="cv-add cv-hist" onClick={groupSelected} aria-label="Group the selected nodes" title="Group the selected nodes (Ctrl+G)"><Group size={16} /></button>}
          {selectedCount > 1 && <button type="button" className="cv-add cv-hist cv-danger" onClick={deleteSelected} aria-label={`Delete ${selectedCount} selected nodes`} title="Delete the selected nodes"><Trash2 size={16} />{selectedCount}</button>}
          <button type="button" className="cv-add" aria-expanded={panel === "templates"} aria-haspopup="dialog" onClick={() => openPanel("templates")}><LayoutTemplate size={16} /> Templates</button>
          {phone && extraBtns}
        </div>
        {phone && panel && <div className="cv-scrim" onClick={() => setPanel(null)} />}
        {panel === "nodes" && (
          <div className="cv-pop" role="dialog" aria-label="Nodes">
            <header><b>Nodes</b><button type="button" aria-label="Close" onClick={() => setPanel(null)}><X size={16} /></button></header>
            <label className="cv-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes..." aria-label="Search nodes" /></label>
            <div className="cv-cats" role="tablist" aria-label="Node categories">
              {["All", ...NODE_GROUPS.map((g) => g.title)].map((c) => (
                <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "is-on" : ""} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="cv-pop-body">
              {groups.map((g) => (
                <section key={g.title}>
                  <h3>{g.title}</h3>
                  <div className="cv-grid">
                    {g.items.map((i) => (
                      <button key={i.id} type="button" className="cv-tile" title={i.blurb} onClick={() => i.kind && addNode(i.kind)}>
                        {ICONS[i.id]}<span>{i.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {!groups.length && <p className="cv-none">No nodes match.</p>}
            </div>
          </div>
        )}
        {panel === "share" && <SharePanel canvasId={canvasId} onClose={() => setPanel(null)} />}
        {panel === "comments" && (
          <CommentsPanel items={comments.items} error={comments.error} enabled={comments.enabled} add={comments.add} resolve={comments.resolve} remove={comments.remove}
            selected={commentNode} label={(nid) => { const n = getNode(nid); return n ? TITLES[n.type as NodeKind] ?? null : null; }} onFocusNode={(nid) => focus(nid)} onClose={() => setPanel(null)} />
        )}
        {panel === "templates" && (
          <div className="cv-pop" role="dialog" aria-label="Templates">
            <header><b>Templates</b><button type="button" aria-label="Close" onClick={() => setPanel(null)}><X size={16} /></button></header>
            <div className="cv-pop-body">
              <section>
                <h3>Save this canvas</h3>
                <div className="cv-save">
                  <input value={tplName} maxLength={40} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveAsTemplate(); }}
                    placeholder="Template name" aria-label="Template name" disabled={!nodes.length} />
                  <button type="button" disabled={!nodes.length} onClick={() => void saveAsTemplate()}>Save</button>
                </div>
                {!nodes.length && <p className="cv-none">Add some nodes first.</p>}
                {tplError && <p className="cv-error" role="alert">{tplError}</p>}
              </section>
              <section>
                <h3>Use a template</h3>
                <div className="cv-tpls">
                  {templates.map((t) => (
                    <div key={t.id} className="cv-tpl">
                      <button type="button" className="cv-tpl-use" onClick={() => applyTemplate(t)}>
                        <LayoutTemplate size={18} />
                        <span><b>{t.name}</b><small>{t.nodes.length} nodes{t.builtIn ? " · built in" : t.server ? " · saved to your account" : " · this browser"}</small></span>
                      </button>
                      {!t.builtIn && <button type="button" className="cv-tpl-del" aria-label={`Delete ${t.name}`} title="Delete template" onClick={() => void deleteAnyTemplate(t).then(setTemplates)}><Trash2 size={15} /></button>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
    </>
  );

  return (
    <CanvasCtx.Provider value={{ focus, ask: setAsk, addAfter: (id, r) => openAdd(id, "after", r), addBefore: (id, r) => openAdd(id, "before", r), comments: comments.counts, openComments: () => setPanel("comments") }}>
      <div className={`cv-wrap ${full ? "is-full" : ""}`} ref={wrap} onWheelCapture={() => { flight.current++; }} onPointerDownCapture={() => { flight.current++; }}>
        <ReactFlow
          nodes={nodes} edges={shownEdges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChangeGuided} onEdgesChange={onEdgesChange} onNodeDragStart={onNodeDragStart} onNodeDrag={onNodeDrag} onNodeDragStop={onNodeDragStop}
          zoomOnScroll={settings.wheel === "zoom"} panOnScroll={settings.wheel === "pan"} connectionLineType={settings.edge === "bezier" ? ConnectionLineType.Bezier : settings.edge === "step" ? ConnectionLineType.Step : settings.edge === "straight" ? ConnectionLineType.Straight : ConnectionLineType.SmoothStep} onConnect={onConnect} onConnectEnd={onConnectEnd} isValidConnection={isValidConnection}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick} onMoveEnd={persist} onDelete={onDelete}
          defaultViewport={saved?.viewport ?? undefined} fitView={!saved?.viewport} fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15} maxZoom={2.5} zoomOnDoubleClick={false} deleteKeyCode={["Backspace", "Delete"]}
          panOnDrag={tool === "pan" ? true : [1, 2]} selectionOnDrag={tool === "select"} selectionMode={SelectionMode.Partial} multiSelectionKeyCode={["Meta", "Control", "Shift"]}
          colorMode={dark ? "dark" : "light"} proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="cv-panel">
            <div className="cv-top">
              <button type="button" className="cv-back" onClick={onBack} aria-label="Back to your canvases" title="All canvases"><ArrowLeft size={16} /></button>
              <input className="cv-name" value={name} maxLength={60} aria-label="Canvas name" onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
              <span className={`cv-status is-${status}`} aria-live="polite" title={status === "local" ? "Kept in this browser. It will be sent to your account on the next change." : undefined}>{status === "saving" ? "Saving…" : status === "local" ? "Saved on this device" : "Saved"}</span>
            </div>
            {!phone && toolbar}
          </Panel>
          {phone && <Panel position="bottom-center" className="cv-panel cv-dock">{toolbar}</Panel>}
          <Panel position="top-right" className="cv-panel cv-right">
            {!phone && extraBtns}
            <button type="button" className="cv-fit" onClick={() => setFull((f) => !f)} aria-pressed={full} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}>
              {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
          {guides && (
            <ViewportPortal>
              {guides.x.map((x) => <div key={`gx${x}`} className="cv-guide" style={{ left: x, top: -20000, width: 0, height: 40000, borderLeft: "1px dashed #c00707" }} />)}
              {guides.y.map((y) => <div key={`gy${y}`} className="cv-guide" style={{ top: y, left: -20000, height: 0, width: 40000, borderTop: "1px dashed #c00707" }} />)}
            </ViewportPortal>
          )}
          <Controls showInteractive={false} position="bottom-left" />
          {nodes.length > 0 && <MiniMap pannable zoomable position="bottom-right" className="cv-minimap" nodeColor="#8a857e" nodeStrokeWidth={0} />}
          {hint && !phone && nodes.length > 0 && <Panel position="bottom-center" className="cv-hint">Double-tap a node to zoom in on it</Panel>}
          {nodes.length === 0 && !panel && (
            <Panel position="top-left" className="cv-empty-wrap">
              <div className="cv-blank">
                <b>A blank canvas</b>
                <p>Add nodes, wire them into a generator, then press Generate. Or start from a template.</p>
                <div>
                  <button type="button" className="cv-go" onClick={() => openPanel("nodes")}>Add a node</button>
                  <button type="button" className="cv-ghost" onClick={() => openPanel("templates")}>Use a template</button>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>
        {addMenu && (() => {
          const target = getNode(addMenu.nodeId);
          const kinds = addMenu.side === "after" ? NEXT_KINDS : PREV_KINDS.filter((k) => (addMenu.port ? portFor(k, target?.type) === addMenu.port : !!portFor(k, target?.type)));
          const w = wrap.current?.clientWidth ?? 800, h = wrap.current?.clientHeight ?? 600;
          const blurb = (k: NodeKind) => NODE_GROUPS.flatMap((g) => g.items).find((i) => i.kind === k)?.blurb ?? "";
          return (
            <div className="cv-addmenu" style={{ left: Math.max(8, Math.min(addMenu.left, w - 250)), top: Math.max(8, Math.min(addMenu.top, h - (kinds.length * 54 + 56))) }} role="menu" aria-label={addMenu.side === "after" ? "Add the next node" : "Add a node that feeds this one"}>
              <header><b>{addMenu.side === "after" ? "Add the next node" : "Feed this node with"}</b><button type="button" aria-label="Close" onClick={() => setAddMenu(null)}><X size={14} /></button></header>
              {kinds.map((k) => (
                <button key={k} type="button" role="menuitem" onClick={() => addLinked(k)}>
                  {ICONS[k]}<span><b>{TITLES[k]}</b><small>{blurb(k)}</small></span>
                </button>
              ))}
            </div>
          );
        })()}
        {ask?.kind === "picture" && (
          <ReferencePicker max={1} picked={[]} onClose={() => setAsk(null)}
            onChange={(next: RefPick[]) => {
              const p = next[0];
              if (p) patchNode(ask.nodeId, { ref: { type: p.type, id: p.id, label: p.label } });
              setAsk(null);
            }} />
        )}
        {ask?.kind === "clip" && (
          <ReferencePicker max={0} picked={[]} onChange={() => {}} videoMax={1} pickedVideos={[]} videosOnly note="Choose one of your videos for this node."
            onVideosChange={(next) => { const v = next[0]; if (v) patchNode(ask.nodeId, { clip: { id: v.id, label: v.label, sec: v.sec ?? null } }); setAsk(null); }}
            onClose={() => setAsk(null)} />
        )}
        {ask?.kind === "refs" && askNode && refsMax > 0 && (
          <ReferencePicker max={refsMax} picked={(askNode.data.refs ?? []).map((r) => ({ ...r, url: refFileUrl(r) }))} onClose={() => setAsk(null)}
            onChange={(next: RefPick[]) => patchNode(askNode.id, { refs: next.map((p) => ({ type: p.type, id: p.id, label: p.label })), note: undefined })} />
        )}
        {ask?.kind === "model" && askNode && models && (
          <ModelPicker models={models} value={modelOf(askNode.data)} onClose={() => setAsk(null)}
            onPick={(id) => { patchNode(askNode.id, { model: id }); try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch {} setAsk(null); }} />
        )}
        {showSettings && <SettingsModal settings={settings} onChange={changeSettings} onClose={() => setShowSettings(false)} />}
        {notice && (
          <div className="cv-notice" role="alert">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X size={13} /></button>
          </div>
        )}
        {undo && (
          <div className="cv-undo" role="status">
            <span>Deleted {undo.nodes.length === 1 ? (TITLES[undo.nodes[0].type as NodeKind] ?? "a node") : undo.nodes.length > 1 ? `${undo.nodes.length} nodes` : "a wire"}</span>
            <button type="button" onClick={restoreDeleted}>Undo</button>
            <button type="button" className="cv-undo-x" aria-label="Dismiss" onClick={() => setUndo(null)}><X size={13} /></button>
          </div>
        )}
        {ask?.kind === "agent" && <AgentMenu anchor={ask.anchor} selected={agent.agent} onPick={agent.setAgent} onClose={() => setAsk(null)} />}
        {detail && <RenderDialog g={detail} onClose={() => setDetail(null)} />}
      </div>
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
    </CanvasCtx.Provider>
  );
}

export default function CanvasView(props: { projectId: string; canvasId: string; meta: CanvasMeta; doc: CanvasDoc; onBack: () => void }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
