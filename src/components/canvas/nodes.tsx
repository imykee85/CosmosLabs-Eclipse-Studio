"use client";

import SoonTag from "@/components/SoonTag";
import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useEdges, useNodes, useReactFlow, type NodeProps } from "@xyflow/react";
import { AlertTriangle, ArrowUp, Check, ChevronDown, Coins, Image as ImageIcon, Layers, Lightbulb, Loader2, Maximize2, Minus, Mountain, Package, Palette, PersonStanding, Plus, Shuffle, Sprout, StickyNote, Trash2, Type, User, Wand2, X } from "lucide-react";
import { AUTO } from "@/components/create/ModelPicker";
import { refFileUrl, STYLES, type CanvasNodeData, type CNode, type NodeKind } from "@/lib/canvas";
import { composePrompt, givesText, inputsOf, isGen, picturesOf, TITLES } from "@/lib/canvas-flow";
import { MAX_QTY, startImages, TIERS, tierResolution } from "@/lib/image-render";
import { readCurrentProject } from "@/lib/projects";
import { useModels } from "@/lib/use-models";
import { useCanvas } from "./CanvasContext";

const ICONS: Record<NodeKind, React.ReactNode> = {
  character: <User size={15} />, product: <Package size={15} />, scene: <Mountain size={15} />, text: <Type size={15} />, style: <Palette size={15} />,
  note: <StickyNote size={15} />, fullbody: <PersonStanding size={15} />, generator: <ImageIcon size={15} />,
};

function Shell({ id, kind, data, selected, className = "", children }: { id: string; kind: NodeKind; data: CanvasNodeData; selected?: boolean; className?: string; children: React.ReactNode }) {
  const { deleteElements } = useReactFlow();
  const { focus, addAfter, addBefore } = useCanvas();
  const title = TITLES[kind];
  const gen = isGen(kind);
  const gives = givesText({ id, type: kind, position: { x: 0, y: 0 }, data });
  return (
    <div className={`cv-node cv-${kind} ${selected ? "is-selected" : ""} ${className}`}>
      {gen && <Handle type="target" position={Position.Left} className="cv-handle" />}
      {gen && <button type="button" className="cv-plus cv-plus-in nodrag" aria-label={`Add a node that feeds ${title}`} title="Add a node that feeds this one" onClick={(e) => addBefore(id, e.currentTarget.getBoundingClientRect())}><Plus size={14} /></button>}
      <header className="cv-head">
        <span className="cv-title">{ICONS[kind]}{title}</span>
        <span className="cv-head-btns nodrag">
          <button type="button" aria-label={`Zoom to ${title}`} title="Zoom to this node" onClick={() => focus(id)}><Maximize2 size={13} /></button>
          <button type="button" className="cv-del" aria-label={`Delete ${title}`} title="Delete this node (you can undo)" onClick={() => deleteElements({ nodes: [{ id }] })}><Trash2 size={13} /></button>
        </span>
      </header>
      {children}
      {kind !== "note" && <p className="cv-gives" title="What this node hands to the node it is wired into">Gives: <b>{gives}</b></p>}
      {kind !== "note" && <Handle type="source" position={Position.Right} className="cv-handle" />}
      {kind !== "note" && <button type="button" className="cv-plus cv-plus-out nodrag" aria-label={`Add the next node after ${title}`} title="Add the next node, already connected" onClick={(e) => addAfter(id, e.currentTarget.getBoundingClientRect())}><Plus size={14} /></button>}
    </div>
  );
}

function Ingredient({ id, data, selected, kind }: NodeProps<CNode> & { kind: "character" | "product" | "scene" }) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const label = TITLES[kind].toLowerCase();
  return (
    <Shell id={id} kind={kind} data={data} selected={selected}>
      <div className="cv-body">
        <div className="cv-slot">
          {data.ref ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cv-pic" src={refFileUrl(data.ref)} alt={data.ref.label} />
              <span className="cv-pic-name" title={data.ref.label}>{data.ref.label}</span>
              <button type="button" className="cv-pic-x nodrag" aria-label="Remove picture" title="Remove picture" onClick={() => updateNodeData(id, { ref: undefined })}><X size={13} /></button>
            </>
          ) : <>{ICONS[kind]}<span>{data.desc?.trim() ? data.desc : `No ${label} selected`}</span></>}
        </div>
        <input className="cv-input nodrag" value={data.desc ?? ""} maxLength={200} placeholder={`Describe the ${label}...`} aria-label={`${TITLES[kind]} description`}
          onChange={(e) => updateNodeData(id, { desc: e.target.value })} />
        <button type="button" className="cv-btn nodrag" onClick={() => ask({ kind: "picture", nodeId: id })}>{data.ref ? "Change picture" : "Choose from Library"}</button>
      </div>
    </Shell>
  );
}

const CharacterNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="character" />;
const ProductNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="product" />;
const SceneNode = (p: NodeProps<CNode>) => <Ingredient {...p} kind="scene" />;

function TextNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="text" data={data} selected={selected} className="cv-wide">
      <div className="cv-body">
        <textarea className="cv-input cv-area nodrag nowheel" rows={4} value={data.text ?? ""} maxLength={2000} placeholder="Describe the shot you imagine..." aria-label="Prompt"
          onChange={(e) => updateNodeData(id, { text: e.target.value })} />
        <button type="button" className="cv-btn"><Lightbulb size={14} /> Polish prompt <SoonTag /></button>
      </div>
    </Shell>
  );
}

function NoteNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="note" data={data} selected={selected} className="cv-wide">
      <div className="cv-body">
        <textarea className="cv-input cv-area nodrag nowheel" rows={3} value={data.text ?? ""} maxLength={1000} placeholder="Write a note for yourself..." aria-label="Note"
          onChange={(e) => updateNodeData(id, { text: e.target.value })} />
      </div>
    </Shell>
  );
}

function StyleNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  return (
    <Shell id={id} kind="style" data={data} selected={selected}>
      <div className="cv-body">
        <div className="cv-slot">{ICONS.style}<span>{data.style && data.style !== "None" ? data.style : "No style selected"}</span></div>
        <select className="cv-input nodrag" value={data.style ?? "None"} aria-label="Style" onChange={(e) => updateNodeData(id, { style: e.target.value })}>
          {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </Shell>
  );
}

// One finished image of a generator. A render that was deleted since (or cannot be read) shows a quiet "removed" tile instead of a broken picture.
function Result({ gid, ratio, on, onPick, onOpen, small }: { gid: string; ratio: string; on: boolean; onPick?: () => void; onOpen: () => void; small?: boolean }) {
  const [gone, setGone] = useState(false);
  return (
    <div className={`cv-res ${small ? "is-small" : ""} ${on ? "is-on" : ""}`} style={{ aspectRatio: ratio.replace(":", " / ") }}>
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

// The image generator is Image Studio's prompt box on the canvas: the same prompt, shape, number of images, quality, model (Auto picks for each image), reference
// pictures, fixed seed and price, started the same way (src/lib/image-render.ts). On top of that it reads what is wired into it and shows what it receives
// and what it will send; the picture it makes is what it gives to the next node.
function Generator({ id, data, selected, kind }: NodeProps<CNode> & { kind: "generator" | "fullbody" }) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const models = useModels({ edit: true });

  const ratioWanted = data.ratio ?? (kind === "fullbody" ? "9:16" : "4:5");
  const qty = Math.min(MAX_QTY, Math.max(1, data.qty ?? 1));
  const tier = data.tier ?? "1k";
  const modelId = data.model && (data.model === AUTO || models?.some((m) => m.id === data.model)) ? data.model : AUTO;
  const seedOn = !!data.seedOn;
  const seedText = data.seed ?? "";

  // What is wired in, and the pictures the model will read, in order.
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const pics = useMemo(() => picturesOf(inputs, data.refs ?? []), [inputs, data.refs]);
  const refList = pics.map((p) => ({ type: p.pic.type, id: p.pic.id }));
  const waiting = inputs.filter((i) => i.role === "result" && !i.ready);

  // Auto resolves to one real model: a verified one that can take as many pictures as there are (never an edit-only model).
  const autoModel = (() => {
    const ok = (models ?? []).filter((m) => !m.requiresReference && m.maxReferences >= pics.length);
    return ok.find((m) => m.verified) ?? ok[0] ?? null;
  })();
  const model = modelId === AUTO ? autoModel : models?.find((m) => m.id === modelId) ?? null;
  // A shape the chosen model cannot make is replaced in the picker (never silently at send time).
  const ratio = model && !model.ratios.includes(ratioWanted) ? model.ratios[0] : ratioWanted;
  const tierOk = !model || !model.resolutions.length || !!tierResolution(model.resolutions, tier);
  useEffect(() => {
    if (!model || !model.resolutions.length || tierResolution(model.resolutions, tier)) return;
    const first = TIERS.find((t) => tierResolution(model.resolutions, t.id));
    if (first) updateNodeData(id, { tier: first.id });
  }, [model, tier, id, updateNodeData]);

  // Fixed seed: only models that have one can use it; a number outside a new model's range is cleared with a note (as in Image Studio).
  const seedSpec = model?.seed;
  const seedSupported = !!seedSpec?.supported;
  const seedLive = seedOn && seedSupported;
  const seedNum = /^\d+$/.test(seedText) ? Number(seedText) : null;
  const seedBad = seedLive && !!seedSpec && seedText !== "" && (seedNum == null || seedNum < seedSpec.min || seedNum > seedSpec.max);
  const lastSeedModel = useRef<string | null>(null);
  useEffect(() => {
    const mid = model?.id ?? null;
    if (mid === lastSeedModel.current) return;
    const first = lastSeedModel.current === null;
    lastSeedModel.current = mid;
    if (first || !seedSpec?.supported || seedNum == null) return;
    if (seedNum < seedSpec.min || seedNum > seedSpec.max) updateNodeData(id, { seed: "", note: "Seed reset: not valid for this model." });
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

  const randomizeSeed = () => { if (seedSpec) updateNodeData(id, { seed: String(seedSpec.min + Math.floor(Math.random() * (seedSpec.max - seedSpec.min + 1))), note: "" }); };

  const canGo = !!composed.trim() && !!model && !busy && !submitting && !needsRef && !tooMany && !seedBad && waiting.length === 0 && tierOk;

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

  const modelLabel = modelId === AUTO ? "Auto" : model?.label ?? "Model";
  const price = model?.credits != null && modelId !== AUTO ? model.credits * qty : null;
  const [showRecv, setShowRecv] = useState(true);
  const picked = data.pick && gens.includes(data.pick) ? data.pick : gens[0];

  return (
    <Shell id={id} kind={kind} data={data} selected={selected} className="cv-gen">
      <div className="cv-body">
        {/* What this node receives from the nodes wired into it. */}
        <div className="cv-recv nodrag">
          <button type="button" className="cv-recv-head" aria-expanded={showRecv} onClick={() => setShowRecv((v) => !v)}>
            <span>Receiving{inputs.length ? ` (${inputs.length})` : ""}</span><ChevronDown size={14} className={showRecv ? "is-up" : ""} />
          </button>
          {showRecv && (
            inputs.length === 0 ? <p className="cv-recv-none">Nothing is wired in. Use the + on the left, or drag a wire from another node, to feed this one.</p> : (
              <ul>
                {inputs.map((i) => (
                  <li key={i.nodeId} className={i.ready ? "" : "is-wait"}>
                    <span className="cv-recv-from">{i.ready ? <Check size={12} /> : <AlertTriangle size={12} />} {i.title}</span>
                    <span className="cv-recv-what">
                      {i.pic ? <>picture{i.text ? " + " : ""}</> : null}
                      {i.text ? <q>{i.text.length > 70 ? `${i.text.slice(0, 69)}…` : i.text}</q> : null}
                      {!i.ready ? <em>{i.why}</em> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
          {showRecv && pics.length > 0 && (
            <div className="cv-recv-pics" aria-label="Pictures sent to the model, in order">
              {pics.map((p) => (
                <span key={p.pic.id} className="cv-recv-pic" title={`Image ${p.n}: ${p.label}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refFileUrl(p.pic)} alt={p.label} /><i>{p.n}</i>
                </span>
              ))}
            </div>
          )}
        </div>

        <textarea className="cv-input cv-area nodrag nowheel" rows={3} value={data.prompt ?? ""} maxLength={Math.min(model?.maxPrompt ?? 2000, 5000)} placeholder={kind === "fullbody" ? "Describe the full-body look…" : "Describe the shot you imagine…"} aria-label="Prompt"
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />

        <div className="cv-controls nodrag">
          <label className="cv-chip cv-sel"><span className="sr-only">Aspect ratio</span>
            <select value={ratio} aria-label="Aspect ratio" onChange={(e) => updateNodeData(id, { ratio: e.target.value })}>
              {(model?.ratios ?? [ratio]).map((r) => <option key={r} value={r}>{r}</option>)}
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
          <button type="button" className="cv-chip" title="Pick reference pictures for this node (pictures from wired-in nodes are added automatically)"
            onClick={() => ask({ kind: "refs", nodeId: id })}><Layers size={13} /> References{(data.refs ?? []).length ? ` (${(data.refs ?? []).length})` : ""}</button>
          <span className="cv-grp">
            <span className="cv-chip cv-seed"><Sprout size={13} /> Fixed seed</span>
            <button type="button" role="switch" aria-checked={seedLive} aria-label="Fixed seed" disabled={!seedSupported} title={seedSupported ? "Fixed seed: similar results with the same seed" : "This model doesn't support seeds"} className={`cv-switch ${seedLive ? "is-on" : ""}`} onClick={() => updateNodeData(id, { seedOn: !seedOn })}><i /></button>
          </span>
        </div>
        {seedLive && seedSpec && (
          <div className="cv-controls nodrag">
            <label className="cv-seedfield"><span>Seed</span>
              <input inputMode="numeric" pattern="[0-9]*" aria-label="Seed number" value={seedText} placeholder={`${seedSpec.min.toLocaleString("en-US")} to ${seedSpec.max.toLocaleString("en-US")}`}
                onChange={(e) => updateNodeData(id, { seed: e.target.value.replace(/\D/g, "").slice(0, 10), note: "" })} />
            </label>
            <button type="button" className="cv-chip" onClick={randomizeSeed}><Shuffle size={13} /> Randomize</button>
          </div>
        )}

        <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={run}>
          {submitting ? <><Loader2 size={15} className="cv-spin" /> Starting</> : busy ? <><Loader2 size={15} className="cv-spin" /> Creating {pending.length === 1 ? "your image" : `${pending.length} images`}</> : price != null ? <>Generate <span className="cv-cost" title={`${price} credits`}><Coins size={13} />{price}</span></> : <>Generate <ArrowUp size={15} /></>}
        </button>

        {/* The picture(s) it made. The ticked one is what the next node receives. */}
        {(busy || gens.length > 0) && (
          <div className="cv-results">
            {busy && gens.length === 0 ? (
              <div className="cv-stage" style={{ aspectRatio: ratio.replace(":", " / ") }}><div className="cv-empty"><Loader2 size={24} className="cv-spin" /><span>Creating your image{pending.length > 1 ? "s" : ""}…</span></div></div>
            ) : picked ? (
              <>
                <Result gid={picked} ratio={ratio} on onOpen={() => ask({ kind: "details", genId: picked })} />
                {gens.length > 1 && (
                  <div className="cv-thumbs" aria-label="Images made">
                    {gens.map((g) => <Result key={g} gid={g} ratio={ratio} small on={g === picked} onPick={() => updateNodeData(id, { pick: g })} onOpen={() => ask({ kind: "details", genId: g })} />)}
                  </div>
                )}
                <p className="cv-recv-none">{gens.length > 1 ? "The ticked image goes to the next node. Tap the tick on another to change it." : "This image goes to the next node."}{busy ? " More are still being made." : ""}</p>
              </>
            ) : null}
          </div>
        )}
        {!seedSupported && model && <p className="cv-nhint">This model doesn&rsquo;t support seeds.</p>}
        {seedBad && seedSpec && <p className="cv-error" role="alert">Use a whole number from {seedSpec.min.toLocaleString("en-US")} to {seedSpec.max.toLocaleString("en-US")} for this model.</p>}
        {data.note && <p className="cv-nhint">{data.note}</p>}
        {needsRef && <p className="cv-nhint">{model?.label} edits a picture. Choose one with References, or wire in a node that gives a picture.</p>}
        {tooMany && model && <p className="cv-error" role="alert">{model.label} takes up to {model.maxReferences} reference {model.maxReferences === 1 ? "picture" : "pictures"}; {pics.length} are wired in or picked.{model.maxReferences === 0 ? " Choose a model that uses pictures, or remove them." : ""}</p>}
        {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
        {!composed.trim() && !busy && <p className="cv-nhint">Write a prompt here or wire in a text prompt to begin.</p>}
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </div>
    </Shell>
  );
}

const GeneratorNode = (p: NodeProps<CNode>) => <Generator {...p} kind="generator" />;
const FullBodyNode = (p: NodeProps<CNode>) => <Generator {...p} kind="fullbody" />;

export const nodeTypes = { character: CharacterNode, product: ProductNode, scene: SceneNode, text: TextNode, style: StyleNode, note: NoteNode, fullbody: FullBodyNode, generator: GeneratorNode };
