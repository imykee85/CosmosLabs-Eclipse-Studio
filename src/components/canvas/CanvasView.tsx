"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, getNodesBounds, getViewportForBounds, MiniMap, Panel, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type NodeMouseHandler,
} from "@xyflow/react";
import { Clapperboard, Film, LayoutTemplate, Mountain, Package, Palette, PersonStanding, Minimize2, Plus, Search, Shirt, StickyNote, Trash2, Type, User, X, Image as ImageIcon, Maximize2 } from "lucide-react";
import { deleteTemplate, instantiate, loadCanvas, loadTemplates, newNode, NODE_GROUPS, saveCanvas, saveTemplate, type CanvasTemplate, type CNode, type NodeKind } from "@/lib/canvas";
import { CanvasCtx } from "./CanvasContext";
import { nodeTypes } from "./nodes";
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

function Inner({ projectId }: { projectId: string }) {
  const saved = useMemo(() => loadCanvas(projectId), [projectId]);
  const initial = useMemo(() => saved ?? { nodes: [] as CNode[], edges: [] as Edge[] }, [saved]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [panel, setPanel] = useState<null | "nodes" | "templates">(null);
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<CanvasTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const lastTap = useRef({ id: "", t: 0 });
  const dark = useAppDark();
  const { screenToFlowPosition, getNode, getNodes, getViewport, setViewport } = useReactFlow();

  // Save after changes (nodes, wires, camera), a moment after the last one.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveCanvas(projectId, nodes, edges, getViewport()), 400);
  }, [projectId, nodes, edges, getViewport]);
  useEffect(() => { persist(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [persist]);

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
    setPanel(null);
    const now = Date.now();
    if (lastTap.current.id === "pane" && now - lastTap.current.t < DOUBLE_TAP_MS) { lastTap.current = { id: "", t: 0 }; overview(); }
    else lastTap.current = { id: "pane", t: now };
  }, [overview]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.target}-${Date.now().toString(36)}` }, es)), [setEdges]);
  // Wires only run from an input node into a generator (a full-body generator can also feed the image generator).
  const isValidConnection = useCallback((c: Connection | Edge) => {
    const s = getNode(c.source), t = getNode(c.target);
    const into = t?.type === "generator" || t?.type === "fullbody";
    return !!s && !!t && s.id !== t.id && into && s.type !== "generator" && s.type !== "note" && !(s.type === "fullbody" && t.type === "fullbody");
  }, [getNode]);

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

  const q = query.trim().toLowerCase();
  const groups = NODE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length);

  return (
    <CanvasCtx.Provider value={{ focus }}>
      <div className={`cv-wrap ${full ? "is-full" : ""}`} ref={wrap} onWheelCapture={() => { flight.current++; }} onPointerDownCapture={() => { flight.current++; }}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={isValidConnection}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick} onMoveEnd={persist}
          defaultViewport={saved?.viewport ?? undefined} fitView={!saved?.viewport} fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15} maxZoom={2.5} zoomOnDoubleClick={false} deleteKeyCode={["Backspace", "Delete"]}
          colorMode={dark ? "dark" : "light"} proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="cv-panel">
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
                          <button key={i.id} type="button" className="cv-tile" disabled={!i.kind} title={i.kind ? i.blurb : "Coming soon"} onClick={() => i.kind && addNode(i.kind)}>
                            {ICONS[i.id]}<span>{i.label}</span>{!i.kind && <em>Soon</em>}
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
      </div>
    </CanvasCtx.Provider>
  );
}

export default function CanvasView({ projectId }: { projectId: string }) {
  return <ReactFlowProvider><Inner projectId={projectId} /></ReactFlowProvider>;
}
