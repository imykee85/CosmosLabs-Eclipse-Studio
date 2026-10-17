"use client";

import AgentIcon from "@/components/AgentIcon";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useEdges, useNodes, useReactFlow, type NodeProps } from "@xyflow/react";
import { ArrowUp, Check, Clapperboard, ChevronDown, Coins, Film, Image as ImageIcon, Layers, Lightbulb, Loader2, Maximize2, Minus, Mountain, Package, Palette, PersonStanding, Plus, Shirt, Sprout, StickyNote, Trash2, Type, User, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { AUTO } from "@/components/create/ModelPicker";
import { refFileUrl, STYLES, type CanvasNodeData, type CNode, type NodeKind } from "@/lib/canvas";
import { composePrompt, inPortsOf, inputsOf, isGen, outLabelOf, OUT_HANDLE, picturesOf, takesInputs, TITLES } from "@/lib/canvas-flow";
import { DEFAULT_VIDEO_MODEL, VIDEO_MODELS, capsFor, isLive, videoModelById, videoPrice, workflowFor } from "@/lib/video-models";
import { refreshCredits } from "@/lib/use-credits";
import { MAX_QTY, startImages, TIERS, tierResolution } from "@/lib/image-render";
import { readCurrentProject } from "@/lib/projects";
import { useAgent } from "@/lib/use-agent";
import { useModels } from "@/lib/use-models";
import { useCanvas } from "./CanvasContext";

const ICONS: Record<NodeKind, React.ReactNode> = {
  character: <User size={15} />, product: <Package size={15} />, scene: <Mountain size={15} />, text: <Type size={15} />, style: <Palette size={15} />,
  note: <StickyNote size={15} />, fullbody: <PersonStanding size={15} />, generator: <ImageIcon size={15} />,
  sheet: <Shirt size={15} />, image: <ImageIcon size={15} />, clip: <Film size={15} />, videogen: <Clapperboard size={15} />,
};
const BIG: Record<NodeKind, React.ReactNode> = {
  character: <User size={34} strokeWidth={1.3} />, product: <Package size={34} strokeWidth={1.3} />, scene: <Mountain size={34} strokeWidth={1.3} />, text: <Type size={34} strokeWidth={1.3} />, style: <Palette size={34} strokeWidth={1.3} />,
  note: <StickyNote size={34} strokeWidth={1.3} />, fullbody: <Wand2 size={34} strokeWidth={1.3} />, generator: <Wand2 size={34} strokeWidth={1.3} />,
  sheet: <Shirt size={34} strokeWidth={1.3} />, image: <ImageIcon size={34} strokeWidth={1.3} />, clip: <Film size={34} strokeWidth={1.3} />, videogen: <Clapperboard size={34} strokeWidth={1.3} />,
};

// Ports sit on the edges of the display card, first one near the top, evenly spaced; their labels show when the node is selected.
const PORT_TOP = 40, PORT_STEP = 30;

// A node: its title above, a big display card (what it holds or made), its controls underneath. Ports sit on the display card's edges.
function Shell({ id, kind, selected, className = "", display, controls, cardStyle }: { id: string; kind: NodeKind; selected?: boolean; className?: string; display: React.ReactNode; controls?: React.ReactNode; cardStyle?: React.CSSProperties }) {
  const { deleteElements } = useReactFlow();
  const { focus, addAfter, addBefore } = useCanvas();
  const edges = useEdges();
  const title = TITLES[kind];
  const ins = inPortsOf(kind);
  const out = outLabelOf(kind);
  const wired = new Set(edges.filter((e) => e.target === id).map((e) => e.targetHandle));
  const outWired = edges.some((e) => e.source === id);
  return (
    <div className={`cv-n cv-n-${kind} ${selected ? "is-selected" : ""} ${className}`}>
      <header className="cv-n-title">
        <span>{title}</span>
        <span className="cv-head-btns nodrag">
          <button type="button" aria-label={`Zoom to ${title}`} title="Zoom to this node" onClick={() => focus(id)}><Maximize2 size={12} /></button>
          <button type="button" className="cv-del" aria-label={`Delete ${title}`} title="Delete this node (you can undo)" onClick={() => deleteElements({ nodes: [{ id }] })}><Trash2 size={12} /></button>
        </span>
      </header>
      <div className="cv-n-card" style={cardStyle}>
        {display}
        {ins.map((p, i) => (
          <Fragment key={p.id}>
            <Handle id={p.id} type="target" position={Position.Left} className={`cv-handle ${wired.has(p.id) ? "is-on" : ""}`} style={{ top: PORT_TOP + i * PORT_STEP }} />
            <span className="cv-port-label cv-port-l" style={{ top: PORT_TOP + i * PORT_STEP }}>{p.label}</span>
          </Fragment>
        ))}
        {out && (
          <>
            <Handle id={OUT_HANDLE} type="source" position={Position.Right} className={`cv-handle ${outWired ? "is-on" : ""}`} style={{ top: PORT_TOP }} />
            <span className="cv-port-label cv-port-r" style={{ top: PORT_TOP }}>{out}</span>
          </>
        )}
        {takesInputs(kind) && <button type="button" className="cv-plus cv-plus-in nodrag" aria-label={`Add a node that feeds ${title}`} title="Add a node that feeds this one" onClick={(e) => addBefore(id, e.currentTarget.getBoundingClientRect())}><Plus size={14} /></button>}
        {out && <button type="button" className="cv-plus cv-plus-out nodrag" aria-label={`Add the next node after ${title}`} title="Add the next node, already connected" onClick={(e) => addAfter(id, e.currentTarget.getBoundingClientRect())}><Plus size={14} /></button>}
      </div>
      {controls && <div className="cv-n-controls">{controls}</div>}
    </div>
  );
}

function Ingredient({ id, data, selected, kind }: NodeProps<CNode> & { kind: "character" | "product" | "scene" }) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const label = TITLES[kind].toLowerCase();
  return (
    <Shell id={id} kind={kind} selected={selected}
      display={
        <div className="cv-disp">
          {data.ref ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={refFileUrl(data.ref)} alt={data.ref.label} />
              <span className="cv-disp-cap" title={data.ref.label}>{data.ref.label}</span>
              <button type="button" className="cv-pic-x nodrag" aria-label="Remove picture" title="Remove picture" onClick={() => updateNodeData(id, { ref: undefined })}><X size={13} /></button>
            </>
          ) : <div className="cv-disp-empty">{BIG[kind]}<span>No {label} selected</span></div>}
        </div>
      }
      controls={
        <>
          <button type="button" className="cv-ctl nodrag" onClick={() => ask({ kind: "picture", nodeId: id })}>{data.ref ? `Change ${label}` : `Select ${label}`}</button>
          <input className="cv-input nodrag" value={data.desc ?? ""} maxLength={200} placeholder={`Describe the ${label}...`} aria-label={`${TITLES[kind]} description`} onChange={(e) => updateNodeData(id, { desc: e.target.value })} />
        </>
      } />
  );
}

const CharacterNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="character" />;
const ProductNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="product" />;
const SceneNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="scene" />;

// Polish prompt: the text is rewritten into a fuller, clearer prompt for the generator it feeds (an image or a video); the person can keep editing it.
function TextNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes() as CNode[];
  const [polishing, setPolishing] = useState(false);
  const feedsVideo = edges.some((e) => e.source === id && nodes.find((n) => n.id === e.target)?.type === "videogen");
  async function polish() {
    const text = (data.text ?? "").trim();
    if (!text || polishing) return;
    setPolishing(true);
    updateNodeData(id, { error: undefined });
    try {
      const res = await fetch("/api/prompts/polish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: feedsVideo ? "video" : "image" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.text !== "string") throw new Error(typeof d.error === "string" ? d.error : "The prompt could not be polished. Please try again.");
      updateNodeData(id, { text: d.text.slice(0, 2000) });
    } catch (e) { updateNodeData(id, { error: e instanceof Error ? e.message : "The prompt could not be polished." }); }
    finally { setPolishing(false); refreshCredits(); }
  }
  return (
    <Shell id={id} kind="text" selected={selected}
      display={<div className="cv-disp"><textarea className="cv-disp-text nodrag nowheel" value={data.text ?? ""} maxLength={2000} placeholder="Describe the shot you imagine..." aria-label="Prompt" onChange={(e) => updateNodeData(id, { text: e.target.value })} /></div>}
      controls={<>
        <button type="button" className="cv-ctl nodrag" disabled={polishing || !(data.text ?? "").trim()} onClick={() => void polish()}>{polishing ? <Loader2 size={14} className="cv-spin" /> : <Lightbulb size={14} />} Polish prompt</button>
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </>} />
  );
}

// Image: a picture from the Library brought onto the canvas; it plugs into a generator's Ingredients or the video generator's Start frame.
function ImageNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  return (
    <Shell id={id} kind="image" selected={selected}
      display={
        <div className="cv-disp">
          {data.ref ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={refFileUrl(data.ref)} alt={data.ref.label} />
              <span className="cv-disp-cap" title={data.ref.label}>{data.ref.label}</span>
              <button type="button" className="cv-pic-x nodrag" aria-label="Remove picture" title="Remove picture" onClick={() => updateNodeData(id, { ref: undefined })}><X size={13} /></button>
            </>
          ) : <div className="cv-disp-empty">{BIG.image}<span>No picture selected</span></div>}
        </div>
      }
      controls={<button type="button" className="cv-ctl nodrag" onClick={() => ask({ kind: "picture", nodeId: id })}>{data.ref ? "Change picture" : "Select picture"}</button>} />
  );
}

// Video: one of the person's own finished videos; it plugs into the video generator's Clips port as a reference clip.
function ClipNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  return (
    <Shell id={id} kind="clip" selected={selected}
      display={
        <div className="cv-disp">
          {data.clip ? (
            <>
              <video src={`/api/generations/${data.clip.id}/file`} muted loop playsInline autoPlay preload="metadata" className="cv-clip" />
              <span className="cv-disp-cap" title={data.clip.label}>{data.clip.label}</span>
              <button type="button" className="cv-pic-x nodrag" aria-label="Remove clip" title="Remove clip" onClick={() => updateNodeData(id, { clip: undefined })}><X size={13} /></button>
            </>
          ) : <div className="cv-disp-empty">{BIG.clip}<span>No clip selected</span></div>}
        </div>
      }
      controls={<button type="button" className="cv-ctl nodrag" onClick={() => ask({ kind: "clip", nodeId: id })}>{data.clip ? "Change clip" : "Select clip"}</button>} />
  );
}

function NoteNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="note" selected={selected}
      display={<div className="cv-disp"><textarea className="cv-disp-text nodrag nowheel" value={data.text ?? ""} maxLength={1000} placeholder="Write a note for yourself..." aria-label="Note" onChange={(e) => updateNodeData(id, { text: e.target.value })} /></div>} />
  );
}

function StyleNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const set = data.style && data.style !== "None";
  return (
    <Shell id={id} kind="style" selected={selected}
      display={<div className="cv-disp"><div className="cv-disp-empty">{BIG.style}<span>{set ? data.style : "No style selected"}</span></div></div>}
      controls={
        <select className="cv-ctl cv-ctl-select nodrag" value={data.style ?? "None"} aria-label="Style" onChange={(e) => updateNodeData(id, { style: e.target.value })}>
          {STYLES.map((s) => <option key={s} value={s}>{s === "None" ? "Select style" : s}</option>)}
        </select>
      } />
  );
}

// One finished image of a generator. A render that was deleted since (or cannot be read) shows a quiet "removed" tile instead of a broken picture.
function Result({ gid, ratio, on, onPick, onOpen, small }: { gid: string; ratio: string; on: boolean; onPick?: () => void; onOpen: () => void; small?: boolean }) {
  const [gone, setGone] = useState(false);
  return (
    <div className={`cv-res ${small ? "is-small" : ""} ${on ? "is-on" : ""}`} style={{ aspectRatio: (ratio === "auto" ? "1:1" : ratio).replace(":", " / ") }}>
      {gone ? <span className="cv-gone">Removed</span> : (
        <button type="button" className="cv-res-img nodrag" onClick={onOpen} title="Open with details" aria-label="Open this image with its details">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/generations/${gid}/file`} alt="Generated result" onError={() => setGone(true)} />
        </button>
      )}
      {onPick && <button type="button" className={`cv-res-pick nodrag ${on ? "is-on" : ""}`} onClick={onPick} aria-pressed={on} title={on ? "The next node receives this image" : "Use this one for the next node"} aria-label={on ? "Used by the next node" : "Use this image for the next node"}><Check size={12} /></button>}
    </div>
  );
}

// The image generator is Image Studio's prompt box on the canvas: the same prompt, shape, number of images, quality, model (Auto picks for each image), ingredients,
// fixed seed (a switch only: the seed of its first render is kept and reused) and price, started the same way (src/lib/image-render.ts). It reads what is plugged
// into its ports; the picture it makes (its Result port) is what it gives to the next node.
function Generator({ id, data, selected, kind }: NodeProps<CNode> & { kind: "generator" | "fullbody" | "sheet" }) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const models = useModels({ edit: true });
  const agent = useAgent();
  const agentChip = useRef<HTMLButtonElement>(null);

  const ratioWanted = data.ratio ?? (kind === "fullbody" ? "9:16" : kind === "sheet" ? "16:9" : "4:5");
  const qty = Math.min(MAX_QTY, Math.max(1, data.qty ?? 1));
  const tier = data.tier ?? "1k";
  const modelId = data.model && (data.model === AUTO || models?.some((m) => m.id === data.model)) ? data.model : AUTO;
  const seedOn = !!data.seedOn;
  const seedText = data.seed ?? "";

  // What is plugged in, and the pictures the model will read, in order.
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const pics = useMemo(() => picturesOf(inputs, data.refs ?? []), [inputs, data.refs]);
  const refList = pics.map((p) => ({ type: p.pic.type, id: p.pic.id }));
  const waiting = inputs.filter((i) => i.fromResult && !i.ready);

  // Auto resolves to one real model: a verified one that can take as many pictures as there are (never an edit-only model).
  const autoModel = (() => {
    const ok = (models ?? []).filter((m) => !m.requiresReference && m.maxReferences >= pics.length);
    return ok.find((m) => m.verified) ?? ok[0] ?? null;
  })();
  const model = modelId === AUTO ? autoModel : models?.find((m) => m.id === modelId) ?? null;
  // A shape the chosen model cannot make is replaced in the picker (never silently at send time).
  const ratio = model && ratioWanted !== "auto" && !model.ratios.includes(ratioWanted) ? model.ratios[0] : ratioWanted;
  const tierOk = !model || !model.resolutions.length || !!tierResolution(model.resolutions, tier);
  useEffect(() => {
    if (!model || !model.resolutions.length || tierResolution(model.resolutions, tier)) return;
    const first = TIERS.find((t) => tierResolution(model.resolutions, t.id));
    if (first) updateNodeData(id, { tier: first.id });
  }, [model, tier, id, updateNodeData]);

  // Fixed seed: only models that have one can use it. The number is never shown: the seed of the first render is kept and reused, and one that does not fit a
  // newly chosen model is dropped (the next render makes a new one).
  const seedSpec = model?.seed;
  const seedSupported = !!seedSpec?.supported;
  const seedLive = seedOn && seedSupported;
  const seedNum = /^\d+$/.test(seedText) ? Number(seedText) : null;
  const lastSeedModel = useRef<string | null>(null);
  useEffect(() => {
    const mid = model?.id ?? null;
    if (mid === lastSeedModel.current) return;
    const first = lastSeedModel.current === null;
    lastSeedModel.current = mid;
    if (first || !seedSpec?.supported || seedNum == null) return;
    if (seedNum < seedSpec.min || seedNum > seedSpec.max) updateNodeData(id, { seed: "" });
  }, [model, seedSpec, seedNum, id, updateNodeData]);

  const composed = useMemo(() => composePrompt(kind, data.prompt ?? "", inputs, pics, Math.min(model?.maxPrompt ?? 2000, 5000)), [kind, data.prompt, inputs, pics, model?.maxPrompt]);
  const needsRef = !!model?.requiresReference && pics.length === 0;
  const tooMany = !!model && pics.length > model.maxReferences;
  const pending = data.pending ?? [];
  const gens = data.gens ?? [];
  const busy = pending.length > 0;
  const [submitting, setSubmitting] = useState(false);

  // The renders run on the server, so they keep going if you leave the canvas (or close the browser). Here we follow the running ones until they finish.
  const pendingKey = pending.join(",");
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split(",") : [];
    if (!ids.length) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const done: string[] = [], failed: { id: string; error: string }[] = [], gone: string[] = [];
      await Promise.all(ids.map(async (gid) => {
        try {
          const res = await fetch(`/api/generations/${gid}`);
          const g = await res.json().catch(() => ({}));
          if (res.status === 404) gone.push(gid);
          else if (res.ok && g.status === "completed") done.push(gid);
          else if (res.ok && g.status === "failed") failed.push({ id: gid, error: typeof g.error === "string" ? g.error : "This image could not be made." });
        } catch {}
      }));
      if (!live) return;
      const settled = new Set([...done, ...failed.map((f) => f.id), ...gone]);
      if (settled.size) {
        updateNodeData(id, (n) => {
          const d = n.data as CanvasNodeData;
          const finished = [...(d.gens ?? []), ...done.filter((x) => !(d.gens ?? []).includes(x))];
          return { pending: (d.pending ?? []).filter((x) => !settled.has(x)), gens: finished, pick: d.pick && finished.includes(d.pick) ? d.pick : finished[0], error: failed[0]?.error ?? d.error };
        });
      }
      if (live && settled.size < ids.length) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [pendingKey, id, updateNodeData]);

  const canGo = !!composed.trim() && !!model && !busy && !submitting && !needsRef && !tooMany && waiting.length === 0 && tierOk;

  async function run() {
    if (!canGo || !model) return;
    setSubmitting(true);
    updateNodeData(id, { error: undefined, note: undefined });
    try {
      const { results, seed: firstSeed, note } = await startImages({ models: models ?? [], model, auto: modelId === AUTO, prompt: composed, ratio, tier, qty, refs: refList, seedOn, seedNum, projectId: readCurrentProject()?.id });
      const ids = results.filter((r) => r.ok && r.id).map((r) => r.id!);
      const failed = results.find((r) => !r.ok);
      if (!ids.length) throw new Error(failed?.error ?? "Something went wrong. Please try again.");
      updateNodeData(id, {
        pending: ids, gens: [], pick: undefined,
        ...(firstSeed != null ? { seed: String(firstSeed) } : {}),
        note: note ?? undefined,
        error: failed ? `${results.filter((r) => !r.ok).length} of ${qty} images could not be started: ${failed.error}` : undefined,
      });
    } catch (e) {
      updateNodeData(id, { error: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    } finally { setSubmitting(false); }
  }
  // The agent's "Generate" command (and anything else that wants this node to run) arrives as an event.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onRun = (e: Event) => { if ((e as CustomEvent<{ id: string }>).detail?.id === id) void runRef.current(); };
    window.addEventListener("eclipse-node-run", onRun);
    return () => window.removeEventListener("eclipse-node-run", onRun);
  }, [id]);

  const modelLabel = modelId === AUTO ? "Auto" : model?.label ?? "Model";
  const price = model?.credits != null && modelId !== AUTO ? model.credits * qty : null;
  const [showSend, setShowSend] = useState(false);
  const picked = data.pick && gens.includes(data.pick) ? data.pick : gens[0];
  const ingN = (data.refs ?? []).length;

  return (
    <Shell id={id} kind={kind} selected={selected} className="cv-gen" cardStyle={{ aspectRatio: (ratio === "auto" ? "1:1" : ratio).replace(":", " / ") }}
      display={
        <div className="cv-disp">
          {busy && gens.length === 0 ? (
            <div className="cv-disp-empty"><Loader2 size={30} className="cv-spin" /><span>Creating your image{pending.length > 1 ? "s" : ""}…</span></div>
          ) : picked ? (
            <Result gid={picked} ratio={ratio} on onOpen={() => ask({ kind: "details", genId: picked })} />
          ) : (
            <div className="cv-disp-empty">{BIG[kind]}<span>Ready to generate</span></div>
          )}
        </div>
      }
      controls={
        <>
          {gens.length > 1 && (
            <div className="cv-thumbs" aria-label="Images made">
              {gens.map((g) => <Result key={g} gid={g} ratio={ratio} small on={g === picked} onPick={() => updateNodeData(id, { pick: g })} onOpen={() => ask({ kind: "details", genId: g })} />)}
            </div>
          )}
          {gens.length > 1 && <p className="cv-nhint">The ticked image is the Result the next node receives.</p>}
          <textarea className="cv-input cv-area nodrag nowheel" rows={3} value={data.prompt ?? ""} maxLength={Math.min(model?.maxPrompt ?? 2000, 5000)} placeholder={kind === "fullbody" ? "Describe the full-body look…" : kind === "sheet" ? "Describe the character (or plug in a Character node)…" : "Describe the shot you imagine…"} aria-label="Prompt"
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
          <div className="cv-controls nodrag">
            <label className="cv-chip cv-sel"><span className="sr-only">Aspect ratio</span>
              <select value={ratio} aria-label="Aspect ratio" onChange={(e) => updateNodeData(id, { ratio: e.target.value })}>
                <option value="auto">Auto</option>
                {(model?.ratios ?? [ratio]).filter((r) => r !== "auto").map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div className="cv-qty" role="group" aria-label="Number of images">
              <button type="button" aria-label="Fewer images" disabled={qty <= 1} onClick={() => updateNodeData(id, { qty: Math.max(1, qty - 1) })}><Minus size={13} /></button>
              <span aria-live="polite">{qty}</span>
              <button type="button" aria-label="More images" disabled={qty >= MAX_QTY} onClick={() => updateNodeData(id, { qty: Math.min(MAX_QTY, qty + 1) })}><Plus size={13} /></button>
            </div>
            <label className="cv-chip cv-sel" title={model && !model.resolutions.length ? "This model has one fixed quality" : "Image quality"}><span className="sr-only">Image quality</span>
              <select value={tier} aria-label="Image quality" disabled={!model || !model.resolutions.length} onChange={(e) => updateNodeData(id, { tier: e.target.value })}>
                {TIERS.map((t) => <option key={t.id} value={t.id} disabled={!!model?.resolutions.length && !tierResolution(model.resolutions, t.id)}>{t.label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="cv-chip cv-modelbtn nodrag" aria-label="Image model" aria-haspopup="dialog" title={model?.blurb} onClick={() => ask({ kind: "model", nodeId: id })}>
            <span className="cv-muted">Model:</span>{modelId === AUTO && <Wand2 size={13} />}<b>{modelLabel}</b><ChevronDown size={13} />
          </button>
          <div className="cv-controls nodrag">
            <button type="button" className="cv-chip" title="Choose ingredients for this node (pictures plugged into its ports are added automatically)" onClick={() => ask({ kind: "refs", nodeId: id })}><Layers size={13} /> Ingredients{ingN ? ` (${ingN})` : ""}</button>
            <span className="cv-grp">
              <span className="cv-chip cv-seed"><Sprout size={13} /> Fixed seed</span>
              <button type="button" role="switch" aria-checked={seedLive} aria-label="Fixed seed" disabled={!seedSupported} title={seedSupported ? "Fixed seed: similar results with the same seed" : "This model doesn't support seeds"} className={`cv-switch ${seedLive ? "is-on" : ""}`} onClick={() => updateNodeData(id, { seedOn: !seedOn, seed: "" })}><i /></button>
            </span>
          </div>
          <div className="cv-controls nodrag">
            <span className="cv-grp">
              <button ref={agentChip} type="button" className="cv-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => ask({ kind: "agent", anchor: e.currentTarget.getBoundingClientRect() })}><AgentIcon size={13} /> <span>{agent.agent ?? "Atlas"}</span></button>
              <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help with this node" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cv-switch ${agent.active ? "is-on" : ""}`}
                onClick={() => { if (!agent.agent) { if (agentChip.current) ask({ kind: "agent", anchor: agentChip.current.getBoundingClientRect() }); return; } agent.setOn(!agent.on); }}><i /></button>
            </span>
          </div>
          <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={run}>
            {submitting ? <><Loader2 size={15} className="cv-spin" /> Generating</> : busy ? <><Loader2 size={15} className="cv-spin" /> Creating {pending.length === 1 ? "your image" : `${pending.length} images`}</> : price != null ? <>Generate <span className="cv-cost" title={`${price} credits`}><Coins size={13} />{price}</span></> : <>Generate <ArrowUp size={15} /></>}
          </button>
          <button type="button" className="cv-send-toggle nodrag" aria-expanded={showSend} onClick={() => setShowSend((v) => !v)}>What will be sent <ChevronDown size={12} className={showSend ? "is-up" : ""} /></button>
          {showSend && (
            <div className="cv-send nodrag">
              <p>{composed || "Nothing yet. Write a prompt or plug in a text prompt."}</p>
              {pics.length > 0 && (
                <div className="cv-recv-pics" aria-label="Ingredients sent to the model, in order">
                  {pics.map((p) => (
                    <span key={p.pic.id} className="cv-recv-pic" title={`Image ${p.n}: ${p.label}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={refFileUrl(p.pic)} alt={p.label} /><i>{p.n}</i>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!seedSupported && model && <p className="cv-nhint">This model doesn&rsquo;t support seeds.</p>}
          {data.note && <p className="cv-nhint">{data.note}</p>}
          {needsRef && <p className="cv-nhint">{model?.label} edits a picture. Choose one with Ingredients, or plug in a node that gives a picture.</p>}
          {tooMany && model && <p className="cv-error" role="alert">{model.label} takes up to {model.maxReferences} {model.maxReferences === 1 ? "ingredient" : "ingredients"}; {pics.length} are plugged in or chosen.{model.maxReferences === 0 ? " Choose a model that uses pictures, or remove them." : ""}</p>}
          {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
          {!composed.trim() && !busy && <p className="cv-nhint">Write a prompt here or plug in a text prompt to begin.</p>}
          {data.error && <p className="cv-error" role="alert">{data.error}</p>}
        </>
      } />
  );
}

const GeneratorNode = (p: NodeProps<CNode>) => <Generator {...p} kind="generator" />;
const FullBodyNode = (p: NodeProps<CNode>) => <Generator {...p} kind="fullbody" />;
const SheetNode = (p: NodeProps<CNode>) => <Generator {...p} kind="sheet" />;

// The video generator is Video Studio's prompt box on the canvas: prompt (own text plus wired-in prompts), model, length, aspect ratio, quality and sound,
// started through POST /api/video like Video Studio. A picture on Start frame makes it image-to-video; pictures on Ingredients and clips on Clips are
// references (reference-to-video, for models that take them). The video it makes (its Video port) can feed another video generator as a reference clip.
const LIVE_VIDEO = VIDEO_MODELS.filter((m) => isLive(m) && !m.hidden);
function VideoGenNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const start = inputs.find((i) => i.port === "start" && i.pic)?.pic ?? null;
  const refPics = picturesOf(inputs.filter((i) => i.port === "ingredients"));
  const clips = inputs.filter((i) => i.port === "clips" && i.clip).map((i) => i.clip!);
  const waiting = inputs.filter((i) => i.fromResult && !i.ready);
  const model = videoModelById(data.model ?? "") ?? videoModelById(DEFAULT_VIDEO_MODEL) ?? LIVE_VIDEO[0];
  const wf = workflowFor(model, !!start, refPics.length > 0 || clips.length > 0);
  const caps = capsFor(model, wf);
  const duration = data.duration && caps.durations.includes(data.duration) ? data.duration : caps.defaultDuration;
  const ratio = caps.ratios.length ? (data.ratio && caps.ratios.includes(data.ratio) ? data.ratio : caps.defaultRatio) : "";
  const quality = caps.qualities.length ? (data.quality && caps.qualities.includes(data.quality) ? data.quality : caps.defaultQuality) : "";
  const sound = caps.audio ? (data.sound ?? caps.audioDefault) : false;
  const own = (data.prompt ?? "").trim();
  const prompt = [own, ...inputs.filter((i) => i.port === "description" && i.text).map((i) => i.text!)].filter(Boolean).join(". ").slice(0, caps.promptMax);
  const pending = data.pending ?? [];
  const gens = data.gens ?? [];
  const busy = pending.length > 0;
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<{ creditsOn?: boolean } | null>(null);
  useEffect(() => { fetch("/api/video/config").then((r) => (r.ok ? r.json() : null)).then((c) => c && setConfig(c)).catch(() => {}); }, []);
  const tooManyRefs = refPics.length > caps.refMax || clips.length > caps.refVideoMax;
  const startUnusable = !!start && !model.startFrame;
  const price = config?.creditsOn ? videoPrice(model, quality || undefined, duration, sound) : null;
  const canGo = isLive(model) && (!!prompt || !caps.promptRequired) && !busy && !submitting && waiting.length === 0 && !tooManyRefs && !startUnusable;

  // A running video is followed through its status route until it is done (it keeps rendering on the server if you leave).
  const pendingKey = pending.join(",");
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split(",") : [];
    if (!ids.length) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const done: string[] = [], failed: string[] = [], gone: string[] = [];
      let why = "";
      await Promise.all(ids.map(async (gid) => {
        try {
          const res = await fetch(`/api/generations/${gid}/status`);
          const g = await res.json().catch(() => ({}));
          if (res.status === 404) gone.push(gid);
          else if (res.ok && g.status === "completed") done.push(gid);
          else if (res.ok && g.status === "failed") { failed.push(gid); why = typeof g.error === "string" ? g.error : "This video could not be made."; }
        } catch {}
      }));
      if (!live) return;
      const settled = new Set([...done, ...failed, ...gone]);
      if (settled.size) updateNodeData(id, (n) => {
        const d = n.data as CanvasNodeData;
        const finished = [...(d.gens ?? []), ...done.filter((x) => !(d.gens ?? []).includes(x))];
        return { pending: (d.pending ?? []).filter((x) => !settled.has(x)), gens: finished, pick: d.pick && finished.includes(d.pick) ? d.pick : finished[finished.length - 1], error: why || d.error };
      });
      if (live && settled.size < ids.length) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [pendingKey, id, updateNodeData]);

  async function run(confirm = false): Promise<void> {
    if (!canGo) return;
    setSubmitting(true);
    updateNodeData(id, { error: undefined });
    try {
      const res = await fetch("/api/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, model: model.id, duration, projectId: readCurrentProject()?.id ?? undefined,
          resolution: quality || undefined, aspectRatio: ratio || undefined, audio: caps.audio ? sound : undefined,
          start: start ? { type: start.type, id: start.id } : undefined,
          refs: !start && refPics.length ? refPics.map((p) => ({ type: p.pic.type, id: p.pic.id })) : undefined,
          videoRefs: !start && clips.length ? clips.map((c) => ({ id: c.id })) : undefined,
          confirm: confirm || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.needsConfirm) {
        setSubmitting(false);
        if (window.confirm(`This video costs ${d.cost} credits. Start it?`)) return run(true);
        return;
      }
      if (!res.ok || typeof d.id !== "string") throw new Error(typeof d.error === "string" ? d.error : "Could not start the video. Please try again.");
      updateNodeData(id, { pending: [...pending, d.id] });
      refreshCredits();
    } catch (e) { updateNodeData(id, { error: e instanceof Error ? e.message : "Could not start the video." }); }
    finally { setSubmitting(false); }
  }
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onRun = (e: Event) => { if ((e as CustomEvent<{ id: string }>).detail?.id === id) void runRef.current(); };
    window.addEventListener("eclipse-node-run", onRun);
    return () => window.removeEventListener("eclipse-node-run", onRun);
  }, [id]);

  const picked = data.pick && gens.includes(data.pick) ? data.pick : gens[gens.length - 1];
  const shape = (ratio && ratio !== "auto" ? ratio : "16:9").replace(":", " / ");
  return (
    <Shell id={id} kind="videogen" selected={selected} className="cv-gen" cardStyle={{ aspectRatio: shape }}
      display={
        <div className="cv-disp">
          {busy ? <div className="cv-disp-empty"><Loader2 size={30} className="cv-spin" /><span>Making your video…</span></div>
            : picked ? <video key={picked} src={`/api/generations/${picked}/file`} className="cv-clip nodrag" controls playsInline preload="metadata" />
            : <div className="cv-disp-empty">{BIG.videogen}<span>Ready to generate</span></div>}
        </div>
      }
      controls={
        <>
          {gens.length > 1 && (
            <div className="cv-thumbs" aria-label="Videos made">
              {gens.map((g, i) => <button key={g} type="button" className={`cv-chip nodrag ${g === picked ? "is-on" : ""}`} aria-pressed={g === picked} onClick={() => updateNodeData(id, { pick: g })}>Take {i + 1}</button>)}
            </div>
          )}
          <textarea className="cv-input cv-area nodrag nowheel" rows={3} value={data.prompt ?? ""} maxLength={caps.promptMax} placeholder="Describe the motion, the camera and what happens…" aria-label="Prompt"
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
          <label className="cv-chip cv-sel cv-wide nodrag"><span className="cv-muted">Model:</span>
            <select value={model.id} aria-label="Video model" onChange={(e) => updateNodeData(id, { model: e.target.value })}>
              {LIVE_VIDEO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <div className="cv-controls nodrag">
            <label className="cv-chip cv-sel"><span className="sr-only">Length</span>
              <select value={duration} aria-label="Length" onChange={(e) => updateNodeData(id, { duration: Number(e.target.value) })}>{caps.durations.map((d) => <option key={d} value={d}>{d} s</option>)}</select>
            </label>
            {caps.ratios.length > 0 && (
              <label className="cv-chip cv-sel"><span className="sr-only">Aspect ratio</span>
                <select value={ratio} aria-label="Aspect ratio" onChange={(e) => updateNodeData(id, { ratio: e.target.value })}>{caps.ratios.map((r) => <option key={r} value={r}>{r === "auto" ? "Auto" : r}</option>)}</select>
              </label>
            )}
            {caps.qualities.length > 0 && (
              <label className="cv-chip cv-sel"><span className="sr-only">Quality</span>
                <select value={quality} aria-label="Quality" onChange={(e) => updateNodeData(id, { quality: e.target.value })}>{caps.qualities.map((q) => <option key={q} value={q}>{q}</option>)}</select>
              </label>
            )}
            <button type="button" className="cv-chip" disabled={!caps.audio} aria-pressed={sound} aria-label={sound ? "Sound on" : "Sound off"} title={caps.audio ? (sound ? "Sound on" : "Sound off") : "This model makes no sound"} onClick={() => updateNodeData(id, { sound: !sound })}>{sound ? <Volume2 size={13} /> : <VolumeX size={13} />}</button>
          </div>
          <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={() => void run()}>
            {submitting ? <><Loader2 size={15} className="cv-spin" /> Starting</> : busy ? <><Loader2 size={15} className="cv-spin" /> Making your video</> : price != null ? <>Generate <span className="cv-cost" title={`${price} credits`}><Coins size={13} />{price}</span></> : <>Generate <ArrowUp size={15} /></>}
          </button>
          {startUnusable && <p className="cv-nhint">{model.label} can&rsquo;t take a start frame. Choose another model or unplug the picture.</p>}
          {tooManyRefs && <p className="cv-error" role="alert">{model.label} takes up to {caps.refMax} reference {caps.refMax === 1 ? "picture" : "pictures"} and {caps.refVideoMax} {caps.refVideoMax === 1 ? "clip" : "clips"}.</p>}
          {start && (refPics.length > 0 || clips.length > 0) && <p className="cv-nhint">With a start frame, the Ingredients and Clips are not sent.</p>}
          {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
          {picked && <button type="button" className="cv-ctl nodrag" onClick={() => ask({ kind: "details", genId: picked })}>Details</button>}
          {data.error && <p className="cv-error" role="alert">{data.error}</p>}
        </>
      } />
  );
}

export const nodeTypes = { character: CharacterNode, product: ProductNode, scene: SceneNode, text: TextNode, style: StyleNode, note: NoteNode, fullbody: FullBodyNode, generator: GeneratorNode, sheet: SheetNode, image: ImageNode, clip: ClipNode, videogen: VideoGenNode };
