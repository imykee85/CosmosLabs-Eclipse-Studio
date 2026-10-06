"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Image as ImageIcon, Lightbulb, Loader2, Maximize2, Mountain, Package, Palette, PersonStanding, Type, User, X } from "lucide-react";
import { buildPrompt, RATIOS, STYLES, type CNode, type NodeKind } from "@/lib/canvas";
import { useCanvas } from "./CanvasContext";

const META: Record<NodeKind, { title: string; icon: React.ReactNode }> = {
  character: { title: "Character", icon: <User size={15} /> },
  product: { title: "Product", icon: <Package size={15} /> },
  scene: { title: "Scene", icon: <Mountain size={15} /> },
  text: { title: "Text prompt", icon: <Type size={15} /> },
  style: { title: "Style", icon: <Palette size={15} /> },
  fullbody: { title: "Full-body generator", icon: <PersonStanding size={15} /> },
  generator: { title: "Image generator", icon: <ImageIcon size={15} /> },
};

function Shell({ id, kind, selected, className = "", children }: { id: string; kind: NodeKind; selected?: boolean; className?: string; children: React.ReactNode }) {
  const { deleteElements } = useReactFlow();
  const { focus } = useCanvas();
  const m = META[kind];
  return (
    <div className={`cv-node cv-${kind} ${selected ? "is-selected" : ""} ${className}`}>
      {(kind === "generator" || kind === "fullbody") && <Handle type="target" position={Position.Left} className="cv-handle" />}
      <header className="cv-head">
        <span className="cv-title">{m.icon}{m.title}</span>
        <span className="cv-head-btns nodrag">
          <button type="button" aria-label={`Zoom to ${m.title}`} title="Zoom to this node" onClick={() => focus(id)}><Maximize2 size={13} /></button>
          {selected && <button type="button" aria-label={`Delete ${m.title}`} title="Delete node" onClick={() => deleteElements({ nodes: [{ id }] })}><X size={14} /></button>}
        </span>
      </header>
      {children}
      <Handle type="source" position={Position.Right} className="cv-handle" />
    </div>
  );
}

function Ingredient({ id, data, selected, kind }: NodeProps<CNode> & { kind: "character" | "product" | "scene" }) {
  const { updateNodeData } = useReactFlow();
  const label = META[kind].title.toLowerCase();
  return (
    <Shell id={id} kind={kind} selected={selected}>
      <div className="cv-body">
        <div className="cv-slot">{META[kind].icon}<span>{data.desc?.trim() ? data.desc : `No ${label} selected`}</span></div>
        <input className="cv-input nodrag" value={data.desc ?? ""} maxLength={200} placeholder={`Describe the ${label}...`} aria-label={`${META[kind].title} description`}
          onChange={(e) => updateNodeData(id, { desc: e.target.value })} />
        <button type="button" className="cv-btn" disabled title="Picking from your Library is coming soon">Choose from Library <em>Soon</em></button>
      </div>
    </Shell>
  );
}

export const CharacterNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="character" />;
export const ProductNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="product" />;
export const SceneNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="scene" />;

export function TextNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="text" selected={selected} className="cv-wide">
      <div className="cv-body">
        <textarea className="cv-input cv-area nodrag nowheel" rows={4} value={data.text ?? ""} maxLength={2000} placeholder="Describe the shot you imagine..." aria-label="Prompt"
          onChange={(e) => updateNodeData(id, { text: e.target.value })} />
        <button type="button" className="cv-btn" disabled title="Polishing prompts is coming soon"><Lightbulb size={14} /> Polish prompt <em>Soon</em></button>
      </div>
    </Shell>
  );
}

export function StyleNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="style" selected={selected}>
      <div className="cv-body">
        <div className="cv-slot">{META.style.icon}<span>{data.style && data.style !== "None" ? data.style : "No style selected"}</span></div>
        <select className="cv-input nodrag" value={data.style ?? "None"} aria-label="Style" onChange={(e) => updateNodeData(id, { style: e.target.value })}>
          {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </Shell>
  );
}

function ResultImg({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Generated result" />;
}

function Generator({ id, data, selected, kind }: NodeProps<CNode> & { kind: "generator" | "fullbody" }) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();
  const ratio = data.ratio ?? (kind === "fullbody" ? "9:16" : "4:5");

  async function run() {
    const prompt = buildPrompt(getNodes() as CNode[], getEdges(), id);
    if (!prompt) { updateNodeData(id, { error: "Wire in a text prompt, or describe an ingredient, first." }); return; }
    updateNodeData(id, { busy: true, error: undefined });
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspectRatio: ratio }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 503 ? "Generating is switched off in preview mode." : out.error ?? "Something went wrong. Please try again.");
      updateNodeData(id, { busy: false, imageUrl: out.imageUrl });
    } catch (e) {
      updateNodeData(id, { busy: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    }
  }

  return (
    <Shell id={id} kind={kind} selected={selected} className="cv-gen">
      <div className="cv-body">
        <div className="cv-stage nodrag" style={{ aspectRatio: ratio.replace(":", " / ") }}>
          {data.busy ? <div className="cv-empty"><Loader2 size={26} className="cv-spin" /><span>Creating your image...</span></div>
            : data.imageUrl ? <ResultImg src={data.imageUrl} />
            : <div className="cv-empty"><ImageIcon size={28} strokeWidth={1.4} /><span>{kind === "fullbody" ? "Full-body look appears here" : "Ready to generate"}</span></div>}
        </div>
        <div className="cv-row nodrag">
          <select className="cv-input" value={ratio} aria-label="Aspect ratio" onChange={(e) => updateNodeData(id, { ratio: e.target.value })}>
            {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="cv-go" disabled={data.busy} onClick={run}>{data.busy ? "Generating" : "Generate"}</button>
        </div>
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </div>
    </Shell>
  );
}

export const GeneratorNode = (p: NodeProps<CNode>) => <Generator {...p} kind="generator" />;
export const FullBodyNode = (p: NodeProps<CNode>) => <Generator {...p} kind="fullbody" />;

export const nodeTypes = { character: CharacterNode, product: ProductNode, scene: SceneNode, text: TextNode, style: StyleNode, fullbody: FullBodyNode, generator: GeneratorNode };
