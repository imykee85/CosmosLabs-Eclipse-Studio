"use client";

import GrowArea from "@/components/GrowArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { NodeResizer, useEdges, useNodes, useReactFlow, type NodeProps } from "@xyflow/react";
import { ArrowUp, Check, Loader2 } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import { GROUP_COLORS, type CanvasNodeData, type CNode } from "@/lib/canvas";
import { composePrompt, inputsOf, listLines, picturesOf } from "@/lib/canvas-flow";
import { creditsText, fmtCredits } from "@/lib/credit-units";
import { imageCost, startImages, tierResolution } from "@/lib/image-render";
import { toolModel, toolPrompt, toolTier } from "@/lib/picture-tools";
import { readCurrentProject } from "@/lib/projects";
import { refreshCredits } from "@/lib/use-credits";
import { useModels } from "@/lib/use-models";
import { fetchAudioItem, startVoice, useVoiceModels, useVoices } from "@/lib/use-voice";
import { useCanvas } from "./CanvasContext";
import { BIG, Result, Shell } from "./nodes";

type Poll = "completed" | "failed" | "gone" | "pending";

// Follows work that keeps running on the server (a picture, a sound) until it is done: finished ids move from `pending` to `gens`.
function useFollow(id: string, pending: string[], check: (gid: string) => Promise<{ s: Poll; error?: string }>, every: number) {
  const { updateNodeData } = useReactFlow();
  const key = pending.join(",");
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const done: string[] = [], failed: string[] = [], gone: string[] = [];
      let why = "";
      await Promise.all(ids.map(async (gid) => {
        try {
          const r = await checkRef.current(gid);
          if (r.s === "completed") done.push(gid); else if (r.s === "failed") { failed.push(gid); why = r.error ?? "This could not be made."; } else if (r.s === "gone") gone.push(gid);
        } catch {}
      }));
      if (!live) return;
      const settled = new Set([...done, ...failed, ...gone]);
      if (settled.size) updateNodeData(id, (n) => {
        const d = n.data as CanvasNodeData;
        const finished = [...(d.gens ?? []), ...done.filter((x) => !(d.gens ?? []).includes(x))];
        return { pending: (d.pending ?? []).filter((x) => !settled.has(x)), gens: finished, pick: d.pick && finished.includes(d.pick) ? d.pick : finished[finished.length - 1], error: why || d.error };
      });
      if (live && settled.size < ids.length) timer = setTimeout(tick, every);
    };
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [key, id, every, updateNodeData]);
}

const imageCheck = async (gid: string) => {
  const res = await fetch(`/api/generations/${gid}`);
  const g = await res.json().catch(() => ({}));
  if (res.status === 404) return { s: "gone" as Poll };
  if (res.ok && g.status === "completed") return { s: "completed" as Poll };
  if (res.ok && g.status === "failed") return { s: "failed" as Poll, error: typeof g.error === "string" ? g.error : "This image could not be made." };
  return { s: "pending" as Poll };
};

// ---------- Assistant ----------
// Writes or rewrites text from an instruction, using the texts plugged into its Description port. What it writes is its output (it can be edited by hand) and
// goes on to any node that takes a description.
export function AssistantNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const material = inputs.filter((i) => i.port === "description" && i.text).map((i) => i.text!);
  const waiting = inputs.filter((i) => i.fromResult && !i.ready);
  const [busy, setBusy] = useState(false);
  const instruction = (data.instruction ?? "").trim();
  const canGo = !busy && (!!instruction || material.length > 0);
  async function run() {
    if (!canGo) return;
    setBusy(true);
    updateNodeData(id, { error: undefined });
    try {
      const res = await fetch("/api/canvas/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction, context: material }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.text !== "string") throw new Error(typeof d.error === "string" ? d.error : "The Assistant could not answer. Please try again.");
      updateNodeData(id, { text: d.text });
    } catch (e) { updateNodeData(id, { error: e instanceof Error ? e.message : "The Assistant could not answer." }); }
    finally { setBusy(false); refreshCredits(); }
  }
  return (
    <Shell id={id} kind="assistant" selected={selected}
      display={<div className="cv-disp">{busy ? <div className="cv-disp-empty"><Loader2 size={30} className="cv-spin" /><span>Writing…</span></div>
        : <textarea className="cv-disp-text nodrag nowheel" value={data.text ?? ""} maxLength={6000} placeholder="What the Assistant writes appears here. You can edit it." aria-label="Assistant result" onChange={(e) => updateNodeData(id, { text: e.target.value })} />}</div>}
      controls={<>
        <GrowArea className="cv-input cv-area nodrag nowheel" rows={3} value={data.instruction ?? ""} maxLength={4000} placeholder="What should it do? For example: rewrite this as a 10 second ad script" aria-label="Instruction"
          onChange={(e) => updateNodeData(id, { instruction: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
        <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={() => void run()}>{busy ? <><Loader2 size={15} className="cv-spin" /> Writing</> : <>Run <ArrowUp size={15} /></>}</button>
        {material.length > 0 && <p className="cv-nhint">Using {material.length} plugged-in {material.length === 1 ? "text" : "texts"}.</p>}
        {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </>} />
  );
}

// ---------- Voiceover, Sound effects, Music ----------
const SECONDS = { sfx: [0, 2, 3, 5, 8, 10, 15, 20, 30], music: [15, 30, 60, 90, 120, 180] };
const AUDIO_TEXT = { tts: "Write what to say…", sfx: "Describe the sound: rain on a tin roof, distant thunder…", music: "Describe the music: calm piano, slow tempo, warm…" };

function AudioNode({ id, data, selected, mode }: NodeProps<CNode> & { mode: "tts" | "sfx" | "music" }) {
  const { updateNodeData } = useReactFlow();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const kind = mode === "tts" ? "voiceover" : mode;
  const { models } = useVoiceModels();
  const list = (models ?? []).filter((m) => m.kinds.includes(mode));
  const model = list.find((m) => m.id === data.amodel) ?? list.find((m) => m.ready) ?? list[0] ?? null;
  const { voices } = useVoices(mode === "tts" && model ? model.id : null);
  const voice = voices?.find((v) => v.voiceId === data.voice) ?? voices?.[0] ?? null;
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const wired = inputs.filter((i) => i.port === "description" && i.text).map((i) => i.text!);
  const waiting = inputs.filter((i) => i.fromResult && !i.ready);
  const text = [(data.prompt ?? "").trim(), ...wired].filter(Boolean).join(mode === "tts" ? "\n\n" : ". ");
  const pending = data.pending ?? [];
  const gens = data.gens ?? [];
  const busy = pending.length > 0;
  const [submitting, setSubmitting] = useState(false);
  const picked = data.pick && gens.includes(data.pick) ? data.pick : gens[gens.length - 1];
  const seconds = data.seconds ?? (mode === "music" ? 30 : 0);
  useFollow(id, pending, async (gid) => {
    const a = await fetchAudioItem(gid);
    if (!a) return { s: "gone" };
    return a.status === "completed" ? { s: "completed" } : a.status === "failed" ? { s: "failed", error: a.error ?? "This sound could not be made." } : { s: "pending" };
  }, 3000);
  const tooLong = !!model && mode === "tts" && text.length > model.maxChars;
  const needsVoice = mode === "tts" && !!model && !model.voiceOptional && !voice;
  const canGo = !!model && model.ready && !!text && !busy && !submitting && waiting.length === 0 && !tooLong && !needsVoice;
  async function run() {
    if (!canGo || !model) return;
    setSubmitting(true);
    updateNodeData(id, { error: undefined });
    const r = await startVoice({
      kind: mode, model: model.id, text, projectId: readCurrentProject()?.id ?? undefined,
      ...(mode === "tts" ? { voiceId: voice?.voiceId, voiceName: voice?.name } : {}),
      ...(mode !== "tts" && seconds ? { durationSec: seconds } : {}),
      ...(mode === "music" ? { instrumental: !!data.instrumental } : {}),
    });
    setSubmitting(false);
    if (!r.ok) { updateNodeData(id, { error: r.error }); return; }
    updateNodeData(id, { pending: [...pending, r.item.id] });
    refreshCredits();
  }
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onRun = (e: Event) => { if ((e as CustomEvent<{ id: string }>).detail?.id === id) void runRef.current(); };
    window.addEventListener("eclipse-node-run", onRun);
    return () => window.removeEventListener("eclipse-node-run", onRun);
  }, [id]);
  const label = mode === "tts" ? "Voiceover" : mode === "sfx" ? "Sound effects" : "Music";
  return (
    <Shell id={id} kind={kind} selected={selected}
      display={<div className="cv-disp">
        {busy ? <div className="cv-disp-empty"><Loader2 size={30} className="cv-spin" /><span>Making your {mode === "tts" ? "voiceover" : mode === "sfx" ? "sound" : "music"}…</span></div>
          : picked ? <div className="cv-audio nodrag"><audio key={picked} src={`/api/audio/${picked}/file`} controls preload="metadata" /></div>
          : <div className="cv-disp-empty">{BIG[kind]}<span>Ready to generate</span></div>}
      </div>}
      controls={<>
        {gens.length > 1 && (
          <div className="cv-thumbs" aria-label="Takes made">
            {gens.map((g, i) => <button key={g} type="button" className={`cv-chip nodrag ${g === picked ? "is-on" : ""}`} aria-pressed={g === picked} onClick={() => updateNodeData(id, { pick: g })}>Take {i + 1}</button>)}
          </div>
        )}
        <GrowArea className="cv-input cv-area nodrag nowheel" rows={3} value={data.prompt ?? ""} placeholder={AUDIO_TEXT[mode]} aria-label={`${label} text`}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
        {list.length > 0 && (
          <label className="cv-chip cv-sel cv-wide nodrag"><span className="cv-muted">Model:</span>
            <select value={model?.id ?? ""} aria-label={`${label} model`} onChange={(e) => updateNodeData(id, { amodel: e.target.value, voice: undefined, voiceName: undefined })}>
              {list.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        )}
        {mode === "tts" && (
          <label className="cv-chip cv-sel cv-wide nodrag"><span className="cv-muted">Voice:</span>
            <select value={voice?.voiceId ?? ""} aria-label="Voice" disabled={!voices?.length} onChange={(e) => updateNodeData(id, { voice: e.target.value, voiceName: voices?.find((v) => v.voiceId === e.target.value)?.name })}>
              {!voices?.length && <option value="">{voices ? "No voices yet" : "Loading…"}</option>}
              {(voices ?? []).map((v) => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}
            </select>
          </label>
        )}
        {mode !== "tts" && (
          <div className="cv-controls nodrag">
            <label className="cv-chip cv-sel"><span className="sr-only">Length</span>
              <select value={seconds} aria-label="Length" onChange={(e) => updateNodeData(id, { seconds: Number(e.target.value) })}>
                {SECONDS[mode].filter((s) => !model?.options.maxSeconds || s <= model.options.maxSeconds).map((s) => <option key={s} value={s}>{s ? `${s} s` : "Auto length"}</option>)}
              </select>
            </label>
            {mode === "music" && <button type="button" className={`cv-chip ${data.instrumental ? "is-on" : ""}`} aria-pressed={!!data.instrumental} onClick={() => updateNodeData(id, { instrumental: !data.instrumental })}>{data.instrumental ? <Check size={13} /> : null} No vocals</button>}
          </div>
        )}
        <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={() => void run()}>
          {submitting ? <><Loader2 size={15} className="cv-spin" /> Starting</> : busy ? <><Loader2 size={15} className="cv-spin" /> Making it</> : <>Generate <ArrowUp size={15} /></>}
        </button>
        {model && !model.ready && <p className="cv-nhint">{model.label} is not available yet.</p>}
        {tooLong && model && <p className="cv-error" role="alert">{model.label} takes up to {model.maxChars.toLocaleString()} characters; this is {text.length.toLocaleString()}.</p>}
        {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </>} />
  );
}
export const VoiceoverNode = (p: NodeProps<CNode>) => <AudioNode {...p} mode="tts" />;
export const SfxNode = (p: NodeProps<CNode>) => <AudioNode {...p} mode="sfx" />;
export const MusicNode = (p: NodeProps<CNode>) => <AudioNode {...p} mode="music" />;

// ---------- Image editor and Upscaler ----------
// Both are picture edits: the picture plugged into Ingredients goes in, a new picture comes out (the original is kept). They use the best editing model this
// account can run, the same way Image Studio's picture tools do, and are priced like any image.
function PictureTool({ id, data, selected, tool }: NodeProps<CNode> & { tool: "editor" | "upscaler" }) {
  const { updateNodeData } = useReactFlow();
  const { ask } = useCanvas();
  const nodes = useNodes() as CNode[];
  const edges = useEdges();
  const models = useModels({ edit: true });
  const inputs = useMemo(() => inputsOf(nodes, edges, id), [nodes, edges, id]);
  const pics = useMemo(() => picturesOf(inputs), [inputs]);
  const waiting = inputs.filter((i) => i.fromResult && !i.ready);
  const model = useMemo(() => (models ? toolModel(models, tool === "upscaler" ? "upscale" : "relight") : null), [models, tool]);
  const tier = model ? toolTier(model, tool === "upscaler" ? "upscale" : "relight") : "1k";
  const own = (data.prompt ?? "").trim();
  const composed = tool === "upscaler" ? toolPrompt("upscale") : composePrompt("generator", own, inputs, pics.slice(0, model?.maxReferences ?? 1), Number.POSITIVE_INFINITY);
  const pending = data.pending ?? [];
  const gens = data.gens ?? [];
  const busy = pending.length > 0;
  const [submitting, setSubmitting] = useState(false);
  const picked = data.pick && gens.includes(data.pick) ? data.pick : gens[0];
  useFollow(id, pending, imageCheck, 2500);
  const price = model ? imageCost(model, model.resolutions.length ? tierResolution(model.resolutions, tier) : undefined, 1) : null;
  const needText = tool === "editor" && !own && !inputs.some((i) => i.port === "description" && i.text);
  const canGo = !!model && pics.length > 0 && !needText && !busy && !submitting && waiting.length === 0;
  async function run() {
    if (!canGo || !model) return;
    setSubmitting(true);
    updateNodeData(id, { error: undefined });
    try {
      const { results } = await startImages({ models: models ?? [], model, auto: false, prompt: composed, ratio: "auto", tier, qty: 1, refs: pics.slice(0, Math.max(1, model.maxReferences)).map((p) => ({ type: p.pic.type, id: p.pic.id })), seedOn: false, seedNum: null, projectId: readCurrentProject()?.id });
      const r = results[0];
      if (!r?.ok || !r.id) throw new Error(r?.error ?? "Something went wrong. Please try again.");
      updateNodeData(id, { pending: [r.id], gens: [], pick: undefined });
    } catch (e) { updateNodeData(id, { error: e instanceof Error ? e.message : "Something went wrong. Please try again." }); }
    finally { setSubmitting(false); refreshCredits(); }
  }
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onRun = (e: Event) => { if ((e as CustomEvent<{ id: string }>).detail?.id === id) void runRef.current(); };
    window.addEventListener("eclipse-node-run", onRun);
    return () => window.removeEventListener("eclipse-node-run", onRun);
  }, [id]);
  const verb = tool === "upscaler" ? "Upscale" : "Edit picture";
  return (
    <Shell id={id} kind={tool} selected={selected} className="cv-gen"
      display={<div className="cv-disp">
        {busy ? <div className="cv-disp-empty"><Loader2 size={30} className="cv-spin" /><span>{tool === "upscaler" ? "Upscaling…" : "Editing your picture…"}</span></div>
          : picked ? <Result gid={picked} ratio="auto" on onOpen={() => ask({ kind: "details", genId: picked })} />
          : <div className="cv-disp-empty">{BIG[tool]}<span>{pics.length ? "Ready" : "Plug in a picture"}</span></div>}
      </div>}
      controls={<>
        {tool === "editor" && (
          <GrowArea className="cv-input cv-area nodrag nowheel" rows={3} value={data.prompt ?? ""} placeholder="What should change? For example: make the jacket red" aria-label="Instruction"
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
        )}
        <button type="button" className="cv-go nodrag" disabled={!canGo} onClick={() => void run()}>
          {submitting ? <><Loader2 size={15} className="cv-spin" /> Starting</> : busy ? <><Loader2 size={15} className="cv-spin" /> Working</> : price != null ? <>{verb} <span className="cv-cost" title={creditsText(price)}><CoinIcon size={13} />{fmtCredits(price)}</span></> : <>{verb} <ArrowUp size={15} /></>}
        </button>
        {!pics.length && <p className="cv-nhint">Plug a picture into Ingredients (an Image node or another generator).</p>}
        {models && !model && <p className="cv-error" role="alert">No picture-editing model is available on this account.</p>}
        {needText && pics.length > 0 && <p className="cv-nhint">Say what should change, or plug in a text.</p>}
        {waiting.length > 0 && <p className="cv-nhint">{waiting[0].why}</p>}
        {data.error && <p className="cv-error" role="alert">{data.error}</p>}
      </>} />
  );
}
export const EditorNode = (p: NodeProps<CNode>) => <PictureTool {...p} tool="editor" />;
export const UpscalerNode = (p: NodeProps<CNode>) => <PictureTool {...p} tool="upscaler" />;

// ---------- List ----------
// One item per line. A generator or video generator it feeds runs once per line, after asking to confirm how many.
export function ListNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData } = useReactFlow();
  const n = listLines(data.text).length;
  return (
    <Shell id={id} kind="list" selected={selected}
      display={<div className="cv-disp"><textarea className="cv-disp-text nodrag nowheel" value={data.text ?? ""} maxLength={6000} placeholder={"One item per line:\nA red dress\nA blue suit\nA green coat"} aria-label="List items" onChange={(e) => updateNodeData(id, { text: e.target.value })} /></div>}
      controls={<p className="cv-nhint">{n ? `${n} ${n === 1 ? "item" : "items"}. A generator it feeds runs once per item.` : "Write one item per line."}</p>} />
  );
}

// ---------- Group ----------
// A coloured, titled frame behind other nodes. Dragging it moves the nodes that sit inside it (the canvas does that); resize it from its corners.
export function GroupNode({ id, data, selected }: NodeProps<CNode>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const color = GROUP_COLORS[data.color ?? "slate"] ?? GROUP_COLORS.slate;
  return (
    <div className={`cv-group ${selected ? "is-selected" : ""}`} style={{ ["--gc" as string]: color }}>
      <NodeResizer isVisible={!!selected} minWidth={200} minHeight={140} lineClassName="cv-group-line" handleClassName="cv-group-handle" />
      <header className="cv-group-head">
        <input className="cv-group-title nodrag" value={data.title ?? ""} maxLength={40} placeholder="Group name" aria-label="Group name" onChange={(e) => updateNodeData(id, { title: e.target.value })} />
        <span className="cv-group-tools nodrag">
          {Object.entries(GROUP_COLORS).map(([name, c]) => <button key={name} type="button" className={`cv-swatch ${data.color === name || (!data.color && name === "slate") ? "is-on" : ""}`} style={{ background: c }} aria-label={`Colour ${name}`} onClick={() => updateNodeData(id, { color: name })} />)}
          <button type="button" className="cv-group-del" aria-label="Remove group (the nodes stay)" title="Remove the group (the nodes stay)" onClick={() => deleteElements({ nodes: [{ id }] })}>×</button>
        </span>
      </header>
    </div>
  );
}
