"use client";

import { useEffect } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Image as ImageIcon, Lightbulb, Loader2, Maximize2, Mountain, Package, Palette, PersonStanding, StickyNote, Type, User, X } from "lucide-react";
import { buildPrompt, STYLES, type CNode, type NodeKind } from "@/lib/canvas";
import { readCurrentProject } from "@/lib/projects";
import { MODEL_STORAGE_KEY, rememberedModel, useModels } from "@/lib/use-models";
import { useCanvas } from "./CanvasContext";

const META: Record<NodeKind, { title: string; icon: React.ReactNode }> = {
  character: { title: "Character", icon: <User size={15} /> },
  product: { title: "Product", icon: <Package size={15} /> },
  scene: { title: "Scene", icon: <Mountain size={15} /> },
  text: { title: "Text prompt", icon: <Type size={15} /> },
  style: { title: "Style", icon: <Palette size={15} /> },
  note: { title: "Note", icon: <StickyNote size={15} /> },
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
      {kind !== "note" && <Handle type="source" position={Position.Right} className="cv-handle" />}
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
        <button type="button" className="cv-btn">Choose from Library</button>
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
        <button type="button" className="cv-btn"><Lightbulb size={14} /> Polish prompt</button>
      </div>
    </Shell>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="note" selected={selected} className="cv-wide">
      <div className="cv-body">
        <textarea className="cv-input cv-area nodrag nowheel" rows={3} value={data.text ?? ""} maxLength={1000} placeholder="Write a note for yourself..." aria-label="Note"
          onChange={(e) => updateNodeData(id, { text: e.target.value })} />
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
  const models = useModels();
  const model = models ? (models.find((m) => m.id === data.model) ?? rememberedModel(models) ?? null) : null;
  const wanted = data.ratio ?? (kind === "fullbody" ? "9:16" : "4:5");
  // A shape the chosen model cannot make is replaced in the picker (never silently at send time).
  const ratio = model && !model.ratios.includes(wanted) ? model.ratios[0] : wanted;
  function pickModel(m: string) {
    updateNodeData(id, { model: m });
    try { localStorage.setItem(MODEL_STORAGE_KEY, m); } catch {}
  }

  const busy = Boolean(data.pendingId);

  // The render runs on the server, so it keeps going if you leave the canvas (or close the browser). Here we follow the
  // running one until it finishes, and refresh a finished one's image link, which expires after ten minutes.
  const followId = data.pendingId ?? data.genId;
  useEffect(() => {
    if (!followId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/generations/${followId}`);
        const g = await res.json().catch(() => ({}));
        if (!live) return;
        if (res.status === 404) { updateNodeData(id, { pendingId: undefined, genId: undefined }); return; }
        if (res.ok && g.status === "completed") { updateNodeData(id, { imageUrl: g.imageUrl, genId: followId, pendingId: undefined, error: undefined }); return; }
        if (res.ok && g.status === "failed") { updateNodeData(id, { pendingId: undefined, error: g.error ?? "This image could not be made." }); return; }
      } catch {}
      if (live) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [followId, id, updateNodeData]);

  async function run() {
    if (!model) return;
    const prompt = buildPrompt(getNodes() as CNode[], getEdges(), id);
    if (!prompt) { updateNodeData(id, { error: "Wire in a text prompt, or describe an ingredient, first." }); return; }
    updateNodeData(id, { error: undefined });
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspectRatio: ratio, model: model?.id, projectId: readCurrentProject()?.id }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 503 ? "Generating is switched off in preview mode." : out.error ?? "Something went wrong. Please try again.");
      updateNodeData(id, { pendingId: out.id, genId: undefined });
    } catch (e) {
      updateNodeData(id, { error: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    }
  }

  return (
    <Shell id={id} kind={kind} selected={selected} className="cv-gen">
      <div className="cv-body">
        <div className="cv-stage" style={{ aspectRatio: ratio.replace(":", " / ") }}>
          {busy ? <div className="cv-empty"><Loader2 size={26} className="cv-spin" /><span>Creating your image...</span></div>
            : data.imageUrl ? <ResultImg src={data.imageUrl} />
            : <div className="cv-empty"><ImageIcon size={28} strokeWidth={1.4} /><span>{kind === "fullbody" ? "Full-body look appears here" : "Ready to generate"}</span></div>}
        </div>
        <select className="cv-input nodrag" value={model?.id ?? ""} aria-label="Image model" onChange={(e) => pickModel(e.target.value)}>
          {(models ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <div className="cv-row">
          <select className="cv-input nodrag" value={ratio} aria-label="Aspect ratio" onChange={(e) => updateNodeData(id, { ratio: e.target.value })}>
            {(model?.ratios ?? [ratio]).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="cv-go nodrag" disabled={busy || !model} onClick={run}>{busy ? "Generating" : "Generate"}</button>
        </div>
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </div>
    </Shell>
  );
}

export const GeneratorNode = (p: NodeProps<CNode>) => <Generator {...p} kind="generator" />;
export const FullBodyNode = (p: NodeProps<CNode>) => <Generator {...p} kind="fullbody" />;

export const nodeTypes = { character: CharacterNode, product: ProductNode, scene: SceneNode, text: TextNode, style: StyleNode, note: NoteNode, fullbody: FullBodyNode, generator: GeneratorNode };
