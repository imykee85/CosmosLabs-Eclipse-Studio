"use client";

import SoonTag from "@/components/SoonTag";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, getNodesBounds, getViewportForBounds, MiniMap, Panel, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type FinalConnectionState, type NodeMouseHandler,
} from "@xyflow/react";
import { ArrowLeft, Clapperboard, Film, LayoutTemplate, Mountain, Package, Palette, PersonStanding, Minimize2, Plus, Search, Shirt, StickyNote, Trash2, Type, User, X, Image as ImageIcon, Maximize2 } from "lucide-react";
import AgentMenu from "@/components/create/AgentMenu";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgentHost } from "@/lib/agent-chat";
import ModelPicker, { AUTO } from "@/components/create/ModelPicker";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import RenderDialog from "@/components/library/RenderDialog";
import { deleteTemplate, instantiate, loadTemplates, newNode, NODE_GROUPS, refFileUrl, saveTemplate, type CanvasNodeData, type CanvasTemplate, type CNode, type NodeKind } from "@/lib/canvas";
import { canWire, inputsOf, isGen, makeEdge, NEXT_KINDS, picturesOf, portFor, PREV_KINDS, TITLES, withoutReplaced, type PortId } from "@/lib/canvas-flow";
import { renameCanvas, saveCanvasDoc, type CanvasDoc, type CanvasMeta } from "@/lib/canvas-store";
import { useAgent } from "@/lib/use-agent";
import { MODEL_STORAGE_KEY, useModels } from "@/lib/use-models";
import type { Render } from "@/lib/use-renders";
import { CanvasCtx, type AskRequest } from "./CanvasContext";
import { nodeTypes } from "./nodes";
import "@/components/create/create.css";
import "./canvas.css";

const ICONS: Record<string, React.ReactNode> = {
  text: <Type size={20} />, character: <User size={20} />, product: <Package size={20} />, scene: <Mountain size={20} />, style: <Palette size={20} />,
  fullbody: <PersonStanding size={20} />, generator: <ImageIcon size={20} />, note: <StickyNote size={20} />,
  video: <Clapperboard size={20} />, sheet: <Shirt size={20} />, image: <ImageIcon size={20} />, clip: <Film size={20} />,
};
const DOUBLE_TAP_MS = 320;

// The app theme lives on <html data-app-theme>; follow it so the canvas switches with the toggle.
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
  const [panel, setPanel] = useState<null | "nodes" | "templates">(null);
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<CanvasTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskRequest | null>(null);      // a picker or dialog a node asked for
  const [detail, setDetail] = useState<Render | null>(null);    // a finished image shown with its details
  const [addMenu, setAddMenu] = useState<AddMenu | null>(null); // the "add the next node" menu
  const [undo, setUndo] = useState<{ nodes: CNode[]; edges: Edge[] } | null>(null); // what was just deleted, for the Undo bar
  const [name, setName] = useState(meta.name);
  const [status, setStatus] = useState<"saved" | "saving" | "local">("saved");
  const wrap = useRef<HTMLDivElement>(null);
  const lastTap = useRef({ id: "", t: 0 });
  const dark = useAppDark();
  const models = useModels({ edit: true });
  const agent = useAgent();
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
  const sigOf = (ns: CNode[], es: Edge[]) => JSON.stringify([ns.map((n) => [n.id, n.type, n.position.x, n.position.y, n.data]), es.map((e) => [e.id, e.source, e.target])]);
  const lastSig = useRef(sigOf(doc.nodes, doc.edges));
  useEffect(() => { const sig = sigOf(nodes, edges); if (sig === lastSig.current) return; lastSig.current = sig; persist(); }, [nodes, edges, persist]);
  useEffect(() => {
    const leave = () => { if (timer.current) { clearTimeout(timer.current); flush(); } };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
  }, [flush]);

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

  function openPanel(which: "nodes" | "templates") {
    if (panel === which) { setPanel(null); return; }
    if (which === "templates") setTemplates(loadTemplates());
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

  function saveAsTemplate() {
    if (!nodes.length) return;
    setTemplates(saveTemplate(tplName || "My template", nodes, edges));
    setTplName("");
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
    const waiting = !!src && isGen(src.type) && !(src.data.gens?.length) && !(src.data.pending?.length);
    const running = !!src && isGen(src.type) && (src.data.pending?.length ?? 0) > 0;
    return { ...e, animated: running, className: waiting ? "cv-wire-wait" : "" };
  }), [edges, nodes]);

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
  const groups = NODE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length);

  return (
    <CanvasCtx.Provider value={{ focus, ask: setAsk, addAfter: (id, r) => openAdd(id, "after", r), addBefore: (id, r) => openAdd(id, "before", r) }}>
      <div className={`cv-wrap ${full ? "is-full" : ""}`} ref={wrap} onWheelCapture={() => { flight.current++; }} onPointerDownCapture={() => { flight.current++; }}>
        <ReactFlow
          nodes={nodes} edges={shownEdges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onConnectEnd={onConnectEnd} isValidConnection={isValidConnection}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick} onMoveEnd={persist} onDelete={onDelete}
          defaultViewport={saved?.viewport ?? undefined} fitView={!saved?.viewport} fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15} maxZoom={2.5} zoomOnDoubleClick={false} deleteKeyCode={["Backspace", "Delete"]}
          colorMode={dark ? "dark" : "light"} proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="cv-panel">
            <div className="cv-top">
              <button type="button" className="cv-back" onClick={onBack} aria-label="Back to your canvases" title="All canvases"><ArrowLeft size={16} /></button>
              <input className="cv-name" value={name} maxLength={60} aria-label="Canvas name" onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
              <span className={`cv-status is-${status}`} aria-live="polite" title={status === "local" ? "Kept in this browser. It will be sent to your account on the next change." : undefined}>{status === "saving" ? "Saving…" : status === "local" ? "Saved on this device" : "Saved"}</span>
            </div>
            <div className="cv-btns">
              <button type="button" className="cv-add" aria-expanded={panel === "nodes"} aria-haspopup="dialog" onClick={() => openPanel("nodes")}><Plus size={16} /> Add node</button>
              <button type="button" className="cv-add" aria-expanded={panel === "templates"} aria-haspopup="dialog" onClick={() => openPanel("templates")}><LayoutTemplate size={16} /> Templates</button>
            </div>
            {panel === "nodes" && (
              <div className="cv-pop" role="dialog" aria-label="Nodes">
                <header><b>Nodes</b><button type="button" aria-label="Close" onClick={() => setPanel(null)}><X size={16} /></button></header>
                <label className="cv-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes..." aria-label="Search nodes" /></label>
                <div className="cv-pop-body">
                  {groups.map((g) => (
                    <section key={g.title}>
                      <h3>{g.title}</h3>
                      <div className="cv-grid">
                        {g.items.map((i) => (
                          <button key={i.id} type="button" className="cv-tile" title={i.blurb} onClick={() => i.kind && addNode(i.kind)}>
                            {ICONS[i.id]}<span>{i.label}</span>{!i.kind && <SoonTag className="cv-soon" />}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  {!groups.length && <p className="cv-none">No nodes match.</p>}
                </div>
              </div>
            )}
            {panel === "templates" && (
              <div className="cv-pop" role="dialog" aria-label="Templates">
                <header><b>Templates</b><button type="button" aria-label="Close" onClick={() => setPanel(null)}><X size={16} /></button></header>
                <div className="cv-pop-body">
                  <section>
                    <h3>Save this canvas</h3>
                    <div className="cv-save">
                      <input value={tplName} maxLength={40} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); }}
                        placeholder="Template name" aria-label="Template name" disabled={!nodes.length} />
                      <button type="button" disabled={!nodes.length} onClick={saveAsTemplate}>Save</button>
                    </div>
                    {!nodes.length && <p className="cv-none">Add some nodes first.</p>}
                  </section>
                  <section>
                    <h3>Use a template</h3>
                    <div className="cv-tpls">
                      {templates.map((t) => (
                        <div key={t.id} className="cv-tpl">
                          <button type="button" className="cv-tpl-use" onClick={() => applyTemplate(t)}>
                            <LayoutTemplate size={18} />
                            <span><b>{t.name}</b><small>{t.nodes.length} nodes{t.builtIn ? " · built in" : ""}</small></span>
                          </button>
                          {!t.builtIn && <button type="button" className="cv-tpl-del" aria-label={`Delete ${t.name}`} title="Delete template" onClick={() => setTemplates(deleteTemplate(t.id))}><Trash2 size={15} /></button>}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </Panel>
          <Panel position="top-right" className="cv-panel">
            <button type="button" className="cv-fit" onClick={() => setFull((f) => !f)} aria-pressed={full} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}>
              {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
          <Controls showInteractive={false} position="bottom-left" />
          {nodes.length > 0 && <MiniMap pannable zoomable position="bottom-right" className="cv-minimap" nodeColor="#8a857e" nodeStrokeWidth={0} />}
          {hint && nodes.length > 0 && <Panel position="bottom-center" className="cv-hint">Double-tap a node to zoom in on it</Panel>}
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
        {ask?.kind === "refs" && askNode && refsMax > 0 && (
          <ReferencePicker max={refsMax} picked={(askNode.data.refs ?? []).map((r) => ({ ...r, url: refFileUrl(r) }))} onClose={() => setAsk(null)}
            onChange={(next: RefPick[]) => patchNode(askNode.id, { refs: next.map((p) => ({ type: p.type, id: p.id, label: p.label })), note: undefined })} />
        )}
        {ask?.kind === "model" && askNode && models && (
          <ModelPicker models={models} value={modelOf(askNode.data)} onClose={() => setAsk(null)}
            onPick={(id) => { patchNode(askNode.id, { model: id }); try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch {} setAsk(null); }} />
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
