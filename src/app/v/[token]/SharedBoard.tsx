"use client";

import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { GROUP_COLORS, type CanvasNodeData, type CNode } from "@/lib/canvas";
import { inPortsOf, isAudioNode, isVideoGen, makesPicture, OUT_HANDLE, outLabelOf, TITLES, listLines } from "@/lib/canvas-flow";

export type SharedNode = { id: string; type: string; position: { x: number; y: number }; width?: number; height?: number; zIndex?: number; data: CanvasNodeData };
export type SharedEdge = { id: string; source: string; sourceHandle: string | null; target: string; targetHandle: string | null };

const PORT_TOP = 40, PORT_STEP = 30;

function View({ id, type, data, token }: { id: string; type: string; data: CanvasNodeData; token: string }) {
  const media = (mid: string) => `/api/public/canvas/${token}/${mid}`;
  const gens = data.gens ?? [];
  const picked = data.pick && gens.includes(data.pick) ? data.pick : isVideoGen(type) || isAudioNode(type) ? gens[gens.length - 1] : gens[0];
  const text = type === "list" ? listLines(data.text).join("\n") : data.text || data.prompt || data.instruction || data.desc || (type === "style" && data.style && data.style !== "None" ? data.style : "");
  const ins = inPortsOf(type);
  const out = outLabelOf(type);
  return (
    <div className="sv-node" data-testid={`sv-${id}`}>
      <header>{TITLES[type as keyof typeof TITLES] ?? "Node"}</header>
      <div className="sv-card">
        {data.ref ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={media(data.ref.id)} alt={data.ref.label} />
          : data.clip ? <video src={media(data.clip.id)} controls muted playsInline preload="metadata" />
          : picked && isVideoGen(type) ? <video src={media(picked)} controls playsInline preload="metadata" />
          : picked && makesPicture(type) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={media(picked)} alt="Result" />
          : picked && isAudioNode(type) ? <audio src={media(picked)} controls preload="metadata" />
          : text ? <p>{text}</p>
          : <span className="sv-empty">Empty</span>}
        {ins.map((p, i) => <Handle key={p.id} id={p.id} type="target" position={Position.Left} className="sv-handle" style={{ top: PORT_TOP + i * PORT_STEP }} isConnectable={false} />)}
        {out && <Handle id={OUT_HANDLE} type="source" position={Position.Right} className="sv-handle" style={{ top: PORT_TOP }} isConnectable={false} />}
      </div>
      {type === "character" || type === "product" || type === "scene" ? (data.desc ? <small>{data.desc}</small> : null) : (makesPicture(type) || isVideoGen(type)) && data.prompt ? <small>{data.prompt}</small> : null}
    </div>
  );
}

function GroupView({ data }: NodeProps<CNode>) {
  return (
    <div className="sv-group" style={{ ["--gc" as string]: GROUP_COLORS[data.color ?? "slate"] ?? GROUP_COLORS.slate }}>
      <b>{data.title}</b>
    </div>
  );
}

export default function SharedBoard({ token, nodes, edges }: { token: string; nodes: SharedNode[]; edges: SharedEdge[] }) {
  const nodeTypes = useMemo(() => {
    const types = Array.from(new Set(nodes.map((n) => n.type).filter((t) => t !== "group")));
    return { group: GroupView, ...Object.fromEntries(types.map((t) => [t, (p: NodeProps<CNode>) => <View id={p.id} type={t} data={p.data} token={token} />])) };
  }, [nodes, token]);
  return (
    <ReactFlowProvider>
      <ReactFlow nodes={nodes as unknown as CNode[]} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2} colorMode="dark" proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeColor="#8a857e" nodeStrokeWidth={0} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
