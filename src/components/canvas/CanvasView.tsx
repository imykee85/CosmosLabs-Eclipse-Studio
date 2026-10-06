"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, getNodesBounds, getViewportForBounds, MiniMap, Panel, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type NodeMouseHandler,
} from "@xyflow/react";
import { Mountain, Package, Palette, PersonStanding, Plus, Type, User, Image as ImageIcon, Maximize2 } from "lucide-react";
import { defaultGraph, loadCanvas, newNode, NODE_CATALOG, saveCanvas, type CNode, type NodeKind } from "@/lib/canvas";
import { CanvasCtx } from "./CanvasContext";
import { nodeTypes } from "./nodes";
import "./canvas.css";

const ICONS: Record<NodeKind, React.ReactNode> = {
  text: <Type size={16} />, character: <User size={16} />, product: <Package size={16} />, scene: <Mountain size={16} />, style: <Palette size={16} />, fullbody: <PersonStanding size={16} />, generator: <ImageIcon size={16} />,
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
  const initial = useMemo(() => saved ?? defaultGraph(), [saved]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [menu, setMenu] = useState(false);
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
    setMenu(false);
    const now = Date.now();
    if (lastTap.current.id === "pane" && now - lastTap.current.t < DOUBLE_TAP_MS) { lastTap.current = { id: "", t: 0 }; overview(); }
    else lastTap.current = { id: "pane", t: now };
  }, [overview]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.target}-${Date.now().toString(36)}` }, es)), [setEdges]);
  // Wires only run from an input node into a generator (a full-body generator can also feed the image generator).
  const isValidConnection = useCallback((c: Connection | Edge) => {
    const s = getNode(c.source), t = getNode(c.target);
    const into = t?.type === "generator" || t?.type === "fullbody";
    return !!s && !!t && s.id !== t.id && into && s.type !== "generator" && !(s.type === "fullbody" && t.type === "fullbody");
  }, [getNode]);

  function addNode(kind: NodeKind) {
    const r = wrap.current?.getBoundingClientRect();
    const centre = r ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
    const jitter = () => (Math.random() - 0.5) * 80;
    const n = newNode(kind, { x: centre.x - 130 + jitter(), y: centre.y - 90 + jitter() });
    setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), { ...n, selected: true }]);
    setMenu(false);
  }

  return (
    <CanvasCtx.Provider value={{ focus }}>
      <div className="cv-wrap" ref={wrap} onWheelCapture={() => { flight.current++; }} onPointerDownCapture={() => { flight.current++; }}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={isValidConnection}
          onNodeClick={onNodeClick} onPaneClick={onPaneClick} onMoveEnd={persist}
          defaultViewport={saved?.viewport ?? undefined} fitView={!saved?.viewport} fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15} maxZoom={2.5} zoomOnDoubleClick={false} deleteKeyCode={["Backspace", "Delete"]}
          colorMode={dark ? "dark" : "light"} proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="cv-panel">
            <button type="button" className="cv-add" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}><Plus size={16} /> Add node</button>
            {menu && (
              <div className="cv-menu" role="menu">
                {NODE_CATALOG.map((c) => (
                  <button key={c.kind} type="button" role="menuitem" onClick={() => addNode(c.kind)}>
                    <span className="cv-menu-ico">{ICONS[c.kind]}</span>
                    <span><b>{c.label}</b><small>{c.blurb}</small></span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <Panel position="top-right" className="cv-panel">
            <button type="button" className="cv-fit" onClick={overview} aria-label="Show everything" title="Show everything"><Maximize2 size={15} /></button>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" className="cv-minimap" nodeColor="#8a857e" nodeStrokeWidth={0} />
          {hint && <Panel position="bottom-center" className="cv-hint">Double-tap a node to zoom in on it</Panel>}
        </ReactFlow>
      </div>
    </CanvasCtx.Provider>
  );
}

export default function CanvasView({ projectId }: { projectId: string }) {
  return <ReactFlowProvider><Inner projectId={projectId} /></ReactFlowProvider>;
}
