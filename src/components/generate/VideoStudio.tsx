"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Clapperboard, Image as ImageIcon, Layers, Loader2, Plus, Video, Volume2, VolumeX, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import AgentMenu from "../create/AgentMenu";
import MotionMenu, { type MotionMode } from "./MotionMenu";
import AgentWidget from "../create/AgentWidget";
import ReferencePicker, { type RefPick } from "../create/ReferencePicker";
import SoonTag from "../SoonTag";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import { readCurrentProject } from "@/lib/projects";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { uploadPicture } from "@/lib/use-uploads";
import { DEFAULT_VIDEO_MODEL, LONGEST_MODEL_LABEL, VIDEO_MODELS, videoModelById, type VideoModel } from "@/lib/video-models";
import "../create/create.css";
import "./generate.css";

// Video Studio (VIDEO step 3): the same layout as Image Studio, for video. A preview above, and below it a prompt box with the shape, length and quality of the clip,
// the model, an optional start frame and end frame (or reference pictures for the models that take them), sound, and the agent.
// Generation is NOT connected yet (see src/lib/video-models.ts): Generate explains that and the page keeps your settings.
const MODEL_KEY = "eclipse-video-model";
const PREVIEW_WIDTH: Record<string, number> = { "16:9": 304, "9:16": 134, "1:1": 215, "4:3": 262, "3:4": 168, "21:9": 340, "3:2": 280, "2:3": 160, "2:1": 330, auto: 304 };
const QUALITY_LABEL = (q: string) => q;
const secs = (n: number) => `${n} s`;
const frameUrl = (p: RefPick) => (p.type === "upload" ? `/api/uploads/${p.id}/file` : `/api/generations/${p.id}/file`);

type Target = "start" | "end" | "refs";

export default function VideoStudio() {
  const [prompt, setPrompt] = useState(useSearchParams().get("prompt") ?? "");
  const [modelId, setModelId] = useState(DEFAULT_VIDEO_MODEL);
  const model = videoModelById(modelId);
  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("");
  const [sound, setSound] = useState(true);
  const [start, setStart] = useState<RefPick | null>(null);
  const [end, setEnd] = useState<RefPick | null>(null);
  const [refs, setRefs] = useState<RefPick[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [pickingModel, setPickingModel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The agent: choose one (chip) and switch it on; its card is the chat.
  const agent = useAgent();
  const [agentAnchor, setAgentAnchor] = useState<DOMRect | null>(null);
  const [motionAnchor, setMotionAnchor] = useState<DOMRect | null>(null);
  const [motion, setMotion] = useState<MotionMode | null>(null);
  const agentChip = useRef<HTMLButtonElement>(null);
  useAgentHost({ page: "video", context: () => ({ prompt, ratio, model: model.label }), setPrompt, generate: async () => "Video generation isn't connected yet. Your prompt is ready in the box." });

  useEffect(() => { try { const m = localStorage.getItem(MODEL_KEY); if (m && VIDEO_MODELS.some((x) => x.id === m)) setModelId(m); } catch {} }, []);
  // Keep every setting one the chosen model accepts.
  useEffect(() => {
    if (!model.ratios.includes(ratio)) setRatio(model.ratios.includes("16:9") ? "16:9" : model.ratios[0]);
    if (!model.durations.includes(duration)) setDuration(model.durations.includes(5) ? 5 : model.durations[0]);
    if (model.qualities.length ? !model.qualities.includes(quality) : quality !== "") setQuality(model.qualities.length ? model.qualities[Math.min(1, model.qualities.length - 1)] : "");
    if (!model.startFrame) setStart(null);
    if (!model.endFrame) setEnd(null);
    if (model.refImages === 0) setRefs([]); else setRefs((r) => r.slice(0, model.refImages));
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickModel(m: VideoModel) {
    setModelId(m.id);
    setPickingModel(false);
    try { localStorage.setItem(MODEL_KEY, m.id); } catch {}
  }

  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setError("Only PNG, JPEG and WebP pictures can be uploaded."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setError("That picture is larger than 25 MB. Please use a smaller one."); return; }
    setUploading(true);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setError("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      if (!r.item) return;
      const pic: RefPick = { type: "upload", id: r.item.id, url: r.item.imageUrl, label: r.item.name };
      // The + gives a start frame; a model with no start frame takes it as a reference picture; one with neither says so.
      if (model.startFrame) setStart(pic);
      else if (model.refImages > 0) setRefs((l) => [...l, pic].slice(0, model.refImages));
      else setNote(`${model.label} makes video from text only. Choose a model that takes a start frame or pictures.`);
    } finally { setUploading(false); }
  }

  function openPicker(t: Target) { setNote(""); setTarget(t); }
  const picked = target === "start" ? (start ? [start] : []) : target === "end" ? (end ? [end] : []) : refs;
  function onPicked(next: RefPick[]) {
    if (target === "start") setStart(next[next.length - 1] ?? null);
    else if (target === "end") setEnd(next[next.length - 1] ?? null);
    else setRefs(next);
  }

  function generate() {
    if (!prompt.trim()) return;
    setError("");
    setNote("Video generation isn't connected yet. Your prompt and settings are ready, and Generate switches on as soon as the video models are connected.");
  }

  const width = PREVIEW_WIDTH[ratio] ?? 304;
  const stageRatio = (ratio === "auto" ? "16:9" : ratio).replace(":", " / ");
  const framesShown = !!start || !!end || refs.length > 0;
  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1 className="pg-title">Video Studio</h1>
        <p>Describe the clip you imagine.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage" style={{ aspectRatio: stageRatio, maxWidth: width }}>
          <div className="cr-empty"><Clapperboard size={34} strokeWidth={1.4} /><p>Your video appears here</p></div>
        </div>
      </section>

      <div className="cr-dock">
        <form className="cr-box" onSubmit={(e) => { e.preventDefault(); generate(); }}>
          <label htmlFor="vs-prompt" className="sr-only">Describe the clip you imagine</label>
          <div className="cr-field">
            <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadFromDevice(e.target.files?.[0]); e.target.value = ""; }} />
            <textarea id="vs-prompt" ref={box} rows={2} maxLength={5000} placeholder="Describe the clip you imagine…" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } }} />
          </div>
          {framesShown && (
            <div className="cr-refs" aria-label="Pictures for this clip">
              {start && <FrameThumb pic={start} tag="Start" onRemove={() => setStart(null)} />}
              {end && <FrameThumb pic={end} tag="End" onRemove={() => setEnd(null)} />}
              {refs.map((r, i) => <FrameThumb key={`${r.type}-${r.id}`} pic={r} tag={String(i + 1)} onRemove={() => setRefs((l) => l.filter((x) => !(x.type === r.type && x.id === r.id)))} />)}
            </div>
          )}
          <div className="cr-tools">
            <div className="cr-row cr-row-a">
              <button type="button" className={`cr-chip vs-sound ${sound && model.sound === "toggle" ? "" : "is-muted"}`} disabled={model.sound !== "toggle"} aria-pressed={sound} aria-label={sound ? "Sound on. Tap to mute." : "Muted. Tap to turn sound on."} title={model.sound !== "toggle" ? `${model.label} has no sound setting` : sound ? "Sound on. Tap to mute." : "Muted. Tap to turn sound on."} onClick={() => setSound((v) => !v)}>
                {sound && model.sound === "toggle" ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <label className="cr-chip cr-select"><span className="sr-only">Aspect ratio</span>
                <select value={ratio} onChange={(e) => setRatio(e.target.value)} aria-label="Aspect ratio">{model.ratios.map((r) => <option key={r} value={r}>{r === "auto" ? "Auto" : r}</option>)}</select>
              </label>
              <label className="cr-chip cr-select"><span className="sr-only">Length</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Length of the clip">{model.durations.map((d) => <option key={d} value={d}>{secs(d)}</option>)}</select>
              </label>
              <label className="cr-chip cr-select" title={model.qualities.length ? "Video quality" : "This model has one fixed quality"}><span className="sr-only">Quality</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Video quality" disabled={!model.qualities.length}>
                  {model.qualities.length ? model.qualities.map((q) => <option key={q} value={q}>{QUALITY_LABEL(q)}</option>) : <option value="">Fixed</option>}
                </select>
              </label>
              <button type="button" className="cr-chip cr-modelbtn vs-model" aria-label="Video model" aria-haspopup="dialog" title={model.blurb} onClick={() => setPickingModel(true)}>
                <span className="cr-mlabel">Model:</span><span className="cr-mname"><span className="vs-mshown">{model.label}</span><span className="vs-msizer" aria-hidden="true">{LONGEST_MODEL_LABEL}</span></span><ChevronDown size={14} />
              </button>
            </div>
            <div className="cr-row cr-row-top">
              <button type="button" className="cr-chip" disabled={!model.startFrame} title={model.startFrame ? "Choose the first frame of the clip" : `${model.label} has no start frame`} onClick={() => openPicker("start")}><ImageIcon size={14} /> Start frame{start ? " (1)" : ""}</button>
              <button type="button" className="cr-chip" disabled={!model.endFrame} title={model.endFrame ? "Choose the last frame of the clip" : `${model.label} has no end frame`} onClick={() => openPicker("end")}><ImageIcon size={14} /> End frame{end ? " (1)" : ""}</button>
              <button type="button" className="cr-chip" disabled={model.refImages === 0} title={model.refImages > 0 ? "Choose pictures the model should work from" : `${model.label} takes no reference pictures`} onClick={() => openPicker("refs")}><Layers size={14} /> Ingredients{refs.length ? ` (${refs.length})` : ""}</button>
              <button type="button" className={`cr-chip ${motion ? "is-on" : ""}`} aria-haspopup="menu" aria-pressed={!!motion} title="Copy the movement of a reference clip" onClick={(e) => setMotionAnchor(e.currentTarget.getBoundingClientRect())}><Video size={14} /> Motion{motion ? `: ${motion === "subject" ? "subject" : "3D scene"}` : ""}</button>
              <div className="cr-grp">
                <button ref={agentChip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}><AgentIcon size={14} /> <span className="cr-aname">{agent.agent ?? "Agents"}</span></button>
                <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help with this prompt" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agent.active ? "is-on" : ""}`}
                  onClick={() => { if (!agent.agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } agent.setOn(!agent.on); }}><i /></button>
              </div>
            </div>
            <button type="submit" className="cr-go" disabled={!prompt.trim()}>Generate <ArrowUp size={16} /> <SoonTag /></button>
          </div>
        </form>
        {note && <p className="cr-hint" role="status">{note}</p>}
        {error && <p className="cr-error" role="alert">{error}</p>}
        <p className="cr-hint cr-keys">Press Ctrl or Cmd + Enter to generate.</p>
      </div>

      {target && <ReferencePicker max={target === "refs" ? model.refImages : 1} picked={picked} onChange={onPicked} onClose={() => setTarget(null)} />}
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
      {motionAnchor && <MotionMenu anchor={motionAnchor} selected={motion} onPick={(m) => { setMotion(m); setNote(m ? "Motion transfer is set up, but adding a reference clip isn't connected yet." : ""); }} onClose={() => setMotionAnchor(null)} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent.agent} onPick={(n) => agent.setAgent(n)} onClose={() => setAgentAnchor(null)} />}
      {pickingModel && <VideoModelPicker value={modelId} onPick={pickModel} onClose={() => setPickingModel(false)} />}
    </div>
  );
}

function FrameThumb({ pic, tag, onRemove }: { pic: RefPick; tag: string; onRemove: () => void }) {
  return (
    <span className="cr-ref" title={`${tag}: ${pic.label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frameUrl(pic)} alt={pic.label} />
      <i className={`cr-ref-n ${tag.length > 1 ? "vs-tag" : ""}`}>{tag}</i>
      <button type="button" className="cr-ref-x" aria-label={`Remove ${pic.label}`} onClick={onRemove}><X size={12} /></button>
    </span>
  );
}

// The list of video models, grouped by maker. Drawn outside the prompt box so it covers the tab bar.
function VideoModelPicker({ value, onPick, onClose }: { value: string; onPick: (m: VideoModel) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const makers = [...new Set(VIDEO_MODELS.map((m) => m.maker))];
  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog vs-models" role="dialog" aria-modal="true" aria-label="Choose a video model" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Video models</h2>
        <div className="vs-list">
          {makers.map((mk) => (
            <div key={mk} className="vs-group">
              <h3>{mk}</h3>
              {VIDEO_MODELS.filter((m) => m.maker === mk).map((m) => (
                <button key={m.id} type="button" className={`vs-item ${m.id === value ? "is-on" : ""}`} aria-pressed={m.id === value} onClick={() => onPick(m)}>
                  <span><b>{m.label}</b><small>{m.blurb}</small><em>{m.durations[0]} to {m.durations[m.durations.length - 1]} s{m.qualities.length ? ` · ${m.qualities[0]} to ${m.qualities[m.qualities.length - 1]}` : ""}{m.sound === "toggle" ? " · sound" : ""}</em></span>
                  {m.id === value && <Check size={16} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
