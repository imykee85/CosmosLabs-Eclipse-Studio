"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ArrowUp, Check, ChevronDown, Clapperboard, Coins, Image as ImageIcon, Film, Layers, Loader2, Plus, Settings, Video, Volume2, VolumeX, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import AgentMenu from "../create/AgentMenu";
import MotionMenu, { type MotionMode } from "./MotionMenu";
import VideoSettingsMenu from "./VideoSettingsMenu";
import AgentWidget from "../create/AgentWidget";
import ReferencePicker, { type ClipPick, type RefPick } from "../create/ReferencePicker";
import PromptEdge, { type EdgeMessage } from "../create/PromptEdge";
import { cleanPicks, pickUrl, readDraft, writeDraft } from "@/lib/draft";
import RenderDetails from "../library/RenderDetails";
import OrderedRefs, { type RefItem } from "./OrderedRefs";
import StyleLibrary from "./StyleLibrary";
import SoonTag from "../SoonTag";
import VideoModelPicker from "./VideoModelPicker";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import { readCurrentProject } from "@/lib/projects";
import { useRenders, type Render } from "@/lib/use-renders";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { uploadPicture } from "@/lib/use-uploads";
import { DEFAULT_VIDEO_MODEL, LONGEST_MODEL_LABEL, VIDEO_MODELS, capsFor, isLive, videoModelById, videoPrice, workflowFor, type VideoModel } from "@/lib/video-models";
import "../create/create.css";
import "./generate.css";

// Video Studio (VIDEO step 3): the same layout as Image Studio, for video. A preview above, and below it a prompt box with the shape, length and quality of the clip,
// the model, an optional start frame and end frame, sound, a fixed seed, and the agent. EVERY control comes from the model registry (src/lib/video-models.ts):
// one the chosen model (or the chosen way of using it) cannot take is greyed out, never hidden. Models not connected yet are listed greyed with a Soon tag.
// A video takes minutes: Generate starts it and the video keeps running at the provider; this page (and the Gallery) asks how it is going every few seconds.
const MODEL_KEY = "eclipse-video-model";
const PREVIEW_WIDTH: Record<string, number> = { "16:9": 304, "9:16": 134, "1:1": 215, "4:3": 262, "3:4": 168, "21:9": 340, "3:2": 280, "2:3": 160, "2:1": 330, auto: 304 };
const secs = (n: number) => `${n} s`;
const frameUrl = (p: RefPick) => (p.type === "upload" ? `/api/uploads/${p.id}/file` : `/api/generations/${p.id}/file`);
const clock = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

type Target = "start" | "end" | "refs";
type Config = { creditsOn: boolean; paused: boolean; ready: boolean };

export default function VideoStudio() {
  const urlPrompt = useSearchParams().get("prompt");
  const [prompt, setPrompt] = useState(urlPrompt ?? "");
  const [modelId, setModelId] = useState(DEFAULT_VIDEO_MODEL);
  const pickerModel = videoModelById(modelId);
  // Motion transfer (the Motion chip) has its own engines, kept out of the model picker: Kling Motion Control (2.6 or 3.0, Standard or Pro) or Genjutsu.
  const [motion, setMotion] = useState<MotionMode | null>(null);
  const [mcEngine, setMcEngine] = useState<"kling3" | "kling26" | "genjutsu">("kling3");
  const [mcTier, setMcTier] = useState<"pro" | "std">("pro");
  const [mcOrient, setMcOrient] = useState<"video" | "image">("video");
  const [mcSound, setMcSound] = useState(true);
  const [styleOpen, setStyleOpen] = useState(false);
  const [mcScene, setMcScene] = useState(false);          // Scene control: not sent anywhere yet (its API field is not in our reference)
  const [mcSceneFrom, setMcSceneFrom] = useState<"video" | "image">("video");
  const mc = motion === "subject";
  const model = mc ? videoModelById(mcEngine === "genjutsu" ? "genjutsu_motion" : `kling_mc_${mcEngine === "kling3" ? "3" : "26"}_${mcTier}`) : pickerModel;
  const live = isLive(model);
  const [ratio, setRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("");
  const [sound, setSound] = useState(true);
  const [seedLocked, setSeedLocked] = useState(false);
  const [seedText, setSeedText] = useState("");
  const [negative, setNegative] = useState("");
  const [creative, setCreative] = useState<number | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
  const [start, setStart] = useState<RefPick | null>(null);
  const [end, setEnd] = useState<RefPick | null>(null);
  const [refs, setRefs] = useState<RefPick[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [pickingModel, setPickingModel] = useState(false);
  const [vrefs, setVrefs] = useState<ClipPick[]>([]);        // reference clips: the person's own finished videos
  // The box survives a refresh: text, settings, start and end frames, pictures, clips and the Motion choice are kept as they change and put back on the next visit.
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    const d = readDraft<{ prompt: string; ratio: string; duration: number; quality: string; sound: boolean; start: unknown; end: unknown; refs: unknown; vrefs: unknown; motion: MotionMode | null; mcEngine: "kling3" | "kling26" | "genjutsu"; mcTier: "pro" | "std"; mcOrient: "video" | "image"; mcSound: boolean }>("generate");
    if (d) {
      if (!urlPrompt && typeof d.prompt === "string") setPrompt(d.prompt);
      if (typeof d.ratio === "string") setRatio(d.ratio);
      if (typeof d.duration === "number" && d.duration > 0 && d.duration <= 60) setDuration(d.duration);
      if (typeof d.quality === "string") setQuality(d.quality);
      if (typeof d.sound === "boolean") setSound(d.sound);
      const one = (v: unknown) => cleanPicks(v ? [v] : [], 1)[0];
      const st = one(d.start), en = one(d.end);
      if (st) setStart({ type: st.type, id: st.id, label: st.label, url: pickUrl(st) });
      if (en) setEnd({ type: en.type, id: en.id, label: en.label, url: pickUrl(en) });
      setRefs(cleanPicks(d.refs, 30).map((r) => ({ type: r.type, id: r.id, label: r.label, url: pickUrl(r) })));
      setVrefs(cleanPicks(d.vrefs, 10).map((r) => ({ type: r.type, id: r.id, label: r.label, url: pickUrl(r), sec: r.sec ?? null })));
      if (d.motion === "subject" || d.motion === "scene") setMotion(d.motion);
      if (d.mcEngine === "kling3" || d.mcEngine === "kling26" || d.mcEngine === "genjutsu") setMcEngine(d.mcEngine);
      if (d.mcTier === "pro" || d.mcTier === "std") setMcTier(d.mcTier);
      if (d.mcOrient === "video" || d.mcOrient === "image") setMcOrient(d.mcOrient);
      if (typeof d.mcSound === "boolean") setMcSound(d.mcSound);
    }
    setDraftReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftReady) return;
    const pick = (p: RefPick | null) => (p ? { type: p.type, id: p.id, label: p.label } : null);
    writeDraft("generate", {
      prompt, ratio, duration, quality, sound, start: pick(start), end: pick(end),
      refs: refs.map(pick), vrefs: vrefs.map((v) => ({ type: v.type, id: v.id, label: v.label, sec: v.sec ?? null })),
      motion, mcEngine, mcTier, mcOrient, mcSound,
    });
  }, [draftReady, prompt, ratio, duration, quality, sound, start, end, refs, vrefs, motion, mcEngine, mcTier, mcOrient, mcSound]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ id: string; ratio: string } | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The way the model is used decides what it offers: a start frame makes it image-to-video (its own length range, no shape choice, an end frame on some models).
  const wf = workflowFor(model, !!start, refs.length > 0 || vrefs.length > 0);
  const caps = capsFor(model, wf);

  // This project's videos. A running one is followed (the list asks the status route every few seconds and fills the video in when it is done).
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setProjectId(readCurrentProject()?.id ?? null); }, []);
  const { renders, reload } = useRenders(projectId === undefined ? null : projectId, 40);
  const videos = (renders ?? []).filter((g) => g.kind === "video");
  const active: Render | null = (activeId ? videos.find((g) => g.id === activeId) : videos.find((g) => g.status === "pending")) ?? null;
  const done = videos.filter((g) => g.status === "completed" && !g.deletedAt).slice(0, 5); // the five most recent, like Image Studio

  useEffect(() => { fetch("/api/video/config").then((r) => (r.ok ? r.json() : null)).then((c) => c && setConfig(c)).catch(() => {}); }, []);
  useEffect(() => { if (active?.status !== "pending") return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [active?.status]);

  // The agent: choose one (chip) and switch it on; its card is the chat.
  const agent = useAgent();
  const [agentAnchor, setAgentAnchor] = useState<DOMRect | null>(null);
  const [motionAnchor, setMotionAnchor] = useState<DOMRect | null>(null);
  const agentChip = useRef<HTMLButtonElement>(null);
  // The one message on the top edge of the prompt box (an error, else a notice); it is also what the agent sees there.
  const edge: EdgeMessage = error ? { kind: "error", text: error } : note ? { kind: "note", text: note } : null;
  useAgentHost({
    page: "video",
    context: () => ({
      prompt, ratio, model: model.label,
      settings: [
        mc ? `Motion transfer (${mcEngine}), orientation from the ${mcOrient}` : "",
        `Length: ${duration} s`,
        quality ? `Quality: ${quality}` : "",
        `Sound: ${mc ? (mcSound ? "kept from the clip" : "off") : sound ? "on" : "off"}`,
        seedLocked ? `Fixed seed on${seedText ? `: ${seedText}` : ""}` : "",
        negative.trim() ? `Leave out: ${negative.trim().slice(0, 100)}` : "",
        `Agent: ${agent.agent ?? "none"}${agent.agent ? (agent.on ? " (on)" : " (off)") : ""}`,
      ].filter(Boolean),
      message: edge?.text,
      pictures: [
        ...(start ? [{ type: start.type, id: start.id, role: "start frame" }] : []),
        ...(end ? [{ type: end.type, id: end.id, role: "end frame" }] : []),
        ...refs.map((r, i) => ({ type: r.type, id: r.id, role: mc ? "subject picture" : `reference ${i + 1}` })),
      ],
      videos: [
        ...vrefs.map((v, i) => ({ id: v.id, label: v.label, role: mc ? "motion clip" : `reference clip ${i + 1}` })),
        ...(active && active.status === "completed" && !vrefs.some((v) => v.id === active.id) ? [{ id: active.id, label: active.prompt.slice(0, 50), role: "shown in the preview" }] : []),
      ],
      clips: vrefs.map((v, i) => `${mc ? "motion clip" : `reference clip ${i + 1}`}: ${v.label}${v.sec ? ` (${Math.round(v.sec)} s)` : ""}`),
    }),
    setPrompt, generate: async () => "Your prompt is ready in the box. Press Generate when the settings look right.",
    // A frame Atlas captured: the start frame, or an ingredient when the model takes pictures that way.
    useFrame: (f, as) => {
      const pic: RefPick = { type: "upload", id: f.id, label: f.label, url: `/api/uploads/${f.id}/file` };
      if (mc) return "Motion mode takes its picture from the Ingredients popup.";
      if (as === "start") {
        if (!model.startFrame) return `${model.label} can't take a start frame.`;
        setStart(pic); return "";
      }
      if (caps.refMax > 0) { setRefs((l) => [...l, pic].slice(0, caps.refMax)); return ""; }
      if (model.startFrame) { setStart(pic); return ""; }
      return `${model.label} can't take pictures.`;
    } });

  useEffect(() => { try { const m = localStorage.getItem(MODEL_KEY); if (m && VIDEO_MODELS.some((x) => x.id === m && !x.hidden)) setModelId(m); } catch {} }, []);
  // Keep every setting one the chosen model accepts in this way of using it.
  useEffect(() => {
    if (caps.ratios.length && ratio !== "auto" && !caps.ratios.includes(ratio)) setRatio(caps.defaultRatio);
    if (!caps.durations.includes(duration)) setDuration(caps.defaultDuration);
    if (caps.qualities.length ? !caps.qualities.includes(quality) : quality !== "") setQuality(caps.defaultQuality);
    if (!caps.endFrame) setEnd(null);
    if (!caps.seed) { setSeedLocked(false); setSeedText(""); }
    if (caps.negativePrompt == null) setNegative("");
    if (!caps.cfgScale) setCreative(null);
    if (!model.startFrame) setStart(null);
    if (!caps.refMax) setRefs([]); else setRefs((r) => r.slice(0, caps.refMax));
    if (!caps.refVideoMax) setVrefs([]); else setVrefs((r) => r.slice(0, caps.refVideoMax));
  }, [model, wf]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickModel(m: VideoModel) {
    setModelId(m.id);
    setPickingModel(false);
    setNote("");
    try { localStorage.setItem(MODEL_KEY, m.id); } catch {}
  }

  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setError("Only PNG, JPEG and WebP pictures can be uploaded."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setError("That picture is larger than 50 MB. Please use a smaller one."); return; }
    setUploading(true);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setError("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      if (!r.item) return;
      const pic: RefPick = { type: "upload", id: r.item.id, url: r.item.imageUrl, label: r.item.name };
      // The + adds to the reference pictures once there are some; otherwise it gives a start frame; a model with no start frame takes it as a reference picture; one with neither says so.
      if (refs.length > 0 && caps.refMax) setRefs((l) => [...l, pic].slice(0, caps.refMax));
      else if (model.startFrame) setStart(pic);
      else if (caps.refMax > 0) setRefs((l) => [...l, pic].slice(0, caps.refMax));
      else setNote(`${model.label} makes video from text only. Choose a model that takes a start frame or pictures.`);
    } finally { setUploading(false); }
  }

  function openPicker(t: Target) { setNote(""); setTarget(t); }
  const picked = target === "start" || (target === "refs" && mc) ? (start ? [start] : []) : target === "end" ? (end ? [end] : []) : refs;
  function onPicked(next: RefPick[]) {
    if (target === "start" || (target === "refs" && mc)) setStart(next[next.length - 1] ?? null); // Motion: the picture is who or what appears
    else if (target === "end") setEnd(next[next.length - 1] ?? null);
    else setRefs(next);
  }

  const seedNumber = seedText.trim() === "" ? undefined : Number(seedText);
  const seedBad = seedLocked && !!caps.seed && seedNumber != null && (!Number.isInteger(seedNumber) || seedNumber < caps.seed.min || seedNumber > caps.seed.max);
  const hasSound = live && caps.audio && sound;
  // Motion transfer is priced by the length of the motion clip (cut to 30 s), which is recorded on the clip.
  const clipSec = vrefs[0]?.sec ?? null;
  const priceSeconds = mc ? (clipSec != null ? Math.min(Math.ceil(clipSec), 30) : null) : duration;
  const price = live && config?.creditsOn && priceSeconds != null ? videoPrice(model, caps.qualities.length ? quality : undefined, priceSeconds, mc ? false : hasSound) : null;
  const motionReady = !mc || (!!start && vrefs.length === 1);
  const canGo = (!!prompt.trim() || (live && !caps.promptRequired)) && motionReady;

  const generate = useCallback(async (confirm = false): Promise<void> => {
    setError(""); setNote("");
    if (!live) { setNote(`${model.label} isn't connected yet. Pick one of the models without a Soon tag.`); return; }
    if (config?.paused) { setError("Video generation is paused right now. Please try again later."); return; }
    if (caps.promptRequired && !prompt.trim()) { setError("Describe the clip first."); return; }
    if (seedBad) { setError(`The seed must be a whole number from ${caps.seed!.min.toLocaleString("en-US")} to ${caps.seed!.max.toLocaleString("en-US")}.`); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(), model: model.id, duration, projectId: readCurrentProject()?.id ?? undefined,
          resolution: caps.qualities.length ? quality : undefined, aspectRatio: caps.ratios.length ? ratio : undefined, audio: caps.audio ? sound : undefined,
          ...(caps.seed && seedLocked ? { lockSeed: true, ...(seedNumber != null ? { seed: seedNumber } : {}) } : {}),
          negativePrompt: caps.negativePrompt != null && negative.trim() ? negative.trim() : undefined, cfgScale: caps.cfgScale && creative != null ? creative : undefined,
          start: start ? { type: start.type, id: start.id } : undefined, end: end ? { type: end.type, id: end.id } : undefined, refs: refs.length ? refs.map((r) => ({ type: r.type, id: r.id })) : undefined, videoRefs: vrefs.length ? vrefs.map((v) => ({ id: v.id })) : undefined, motion: mc ? { orientation: mcOrient, keepSound: mcSound } : undefined, confirm: confirm || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.needsConfirm) {
        // A dear render asks first (the server enforces this too).
        if (window.confirm(`This video costs ${data.cost} credits. Start it?`)) { setSubmitting(false); return generate(true); }
        return;
      }
      if (!res.ok) { setError(data.error ?? "Could not start the video. Please try again."); return; }
      setActiveId(data.id);
      setNote(data.seedNote ?? "");
      if (config?.creditsOn) fetch("/api/credits").catch(() => {}); // the held price shows in the balance
      await reload();
    } catch { setError("Could not reach the server. Check your connection and try again."); }
    finally { setSubmitting(false); }
  }, [live, model.label, config?.paused, config?.creditsOn, caps, prompt, seedBad, model.id, mc, mcOrient, mcSound, duration, quality, ratio, sound, seedLocked, seedNumber, negative, creative, start, end, refs, vrefs, reload]);

  async function cancel(g: Render) {
    setCancelling(g.id); setError("");
    try {
      const res = await fetch(`/api/generations/${g.id}/cancel`, { method: "POST" });
      if (res.ok) {
        const item = await res.json().catch(() => null);
        setNote(item?.status === "failed" ? "Canceled. No credits were used." : "Cancel requested. If the video is still made, it will appear in your Gallery.");
      } else setError("Could not cancel this video.");
      await reload();
    } finally { setCancelling(null); }
  }

  const known = active?.status === "completed" && natural?.id === active.id ? natural.ratio : null;
  const stageShape = known ?? active?.aspectRatio ?? (caps.ratios.length ? ratio : "16:9");
  const stageRatio = (stageShape === "auto" ? "16:9" : stageShape).replace(":", " / ");
  const width = known ? Math.min(340, Math.round(304 * (Number(known.split(":")[0]) / Number(known.split(":")[1])))) : PREVIEW_WIDTH[stageShape] ?? 304;
  // What is chosen, laid out in the person's order (the order they added things, then whatever they dragged). The tags say what each one is for
  // and the server is told by role (start, end, ingredients, clips, motion), so the layout never changes what the engine does.
  const entries = useMemo<RefItem[]>(() => {
    const out: RefItem[] = [];
    if (start) out.push({ key: `s:${start.type}:${start.id}`, kind: "pic", src: frameUrl(start), tag: mc ? "Picture" : "Start", label: start.label, title: mc ? `Picture: ${start.label}. Who or what appears in the result.` : `Start frame: ${start.label}`, onRemove: () => setStart(null) });
    if (end) out.push({ key: `e:${end.type}:${end.id}`, kind: "pic", src: frameUrl(end), tag: "End", label: end.label, title: `End frame: ${end.label}`, onRemove: () => setEnd(null) });
    refs.forEach((r, i) => out.push({ key: `r:${r.type}:${r.id}`, kind: "pic", src: frameUrl(r), tag: String(i + 1), label: r.label, title: `Picture ${i + 1}: ${r.label}`, onRemove: () => setRefs((l) => l.filter((x) => !(x.type === r.type && x.id === r.id))) }));
    vrefs.forEach((v, i) => out.push({ key: `v:${v.id}`, kind: "vid", src: v.url, tag: mc ? "Motion" : `V${i + 1}`, label: v.label, title: mc ? `Motion video: ${v.label}. Its movement is copied.` : `Video ${i + 1}: ${v.label}`, onRemove: () => setVrefs((l) => l.filter((x) => x.id !== v.id)) }));
    return out;
  }, [start, end, refs, vrefs, mc]);
  const [order, setOrder] = useState<string[]>([]);
  const entryKeys = entries.map((e) => e.key).join("|");
  useEffect(() => { const ks = entryKeys ? entryKeys.split("|") : []; setOrder((o) => { const kept = o.filter((k) => ks.includes(k)); const next = [...kept, ...ks.filter((k) => !kept.includes(k))]; return next.join("|") === o.join("|") ? o : next; }); }, [entryKeys]);
  const shown = [...entries].sort((a, b) => { const ia = order.indexOf(a.key), ib = order.indexOf(b.key); return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib); });
  // Dragging changes the order; pictures and clips keep their own numbering (picture 1, 2, ... and V1, V2, ...) in the order they now sit.
  function reorder(keys: string[]) {
    setOrder(keys);
    const at = (k: string) => { const i = keys.indexOf(k); return i < 0 ? 1e6 : i; };
    setRefs((l) => [...l].sort((a, b) => at(`r:${a.type}:${a.id}`) - at(`r:${b.type}:${b.id}`)));
    setVrefs((l) => [...l].sort((a, b) => at(`v:${a.id}`) - at(`v:${b.id}`)));
  }
  const aspectLocked = live && caps.ratios.length === 0;
  // The settings icon shows a dot when a setting inside it is in use.
  const settingsInUse = (seedLocked && !!caps.seed) || (caps.negativePrompt != null && !!negative.trim()) || (caps.cfgScale && creative != null);

  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1 className="pg-title">Video Studio</h1>
        <p>Describe the clip you imagine.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage vs-stage" style={{ aspectRatio: stageRatio, maxWidth: Math.max(width, 240) }}>
          {!active ? (
            <div className="cr-empty"><Clapperboard size={34} strokeWidth={1.4} /><p>Your video appears here</p></div>
          ) : active.status === "pending" ? (
            <div className="cr-empty vs-wait" role="status" aria-live="polite">
              <Loader2 size={30} className="cr-spin" />
              <p>Making your video… <b>{clock(now - new Date(active.createdAt).getTime())}</b></p>
              <button type="button" className="vs-cancel" disabled={cancelling === active.id} onClick={() => cancel(active)}>{cancelling === active.id ? "Canceling…" : "Cancel"}</button>
            </div>
          ) : active.status === "failed" ? (
            <div className="cr-empty vs-wait" role="alert"><AlertCircle size={30} strokeWidth={1.5} /><p>{active.error ?? "This video could not be made."}</p></div>
          ) : active.imageUrl ? (
            <video key={active.id} src={active.imageUrl} controls playsInline loop preload="auto" aria-label={active.prompt}
              onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setNatural({ id: active.id, ratio: `${v.videoWidth}:${v.videoHeight}` }); }} />
          ) : null}
        </div>
        {done.length > 0 && (
          <div className="cr-earlier" aria-label="Your five most recent videos">
            {done.map((g) => (
              <button key={g.id} type="button" className={active?.id === g.id ? "is-on" : ""} aria-pressed={active?.id === g.id} onClick={() => setActiveId(g.id)} title={g.prompt}>
                <video src={`${g.imageUrl}#t=0.1`} muted loop autoPlay playsInline preload="auto" />
              </button>
            ))}
            <Link href="/gallery" className="cr-seeall" aria-label="See all in your Gallery" title="See all in your Gallery"><ArrowRight size={16} /></Link>
          </div>
        )}
        {active?.status === "completed" && <RenderDetails g={active} collapsible onDeleted={() => { setActiveId(null); void reload(); }} onStarted={() => void reload()} />}
      </section>

      <div className="cr-dock">
        <PromptEdge message={edge} />
        <form className="cr-box" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
          <label htmlFor="vs-prompt" className="sr-only">Describe the clip you imagine</label>
          <div className="cr-field">
            <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadFromDevice(e.target.files?.[0]); e.target.value = ""; }} />
            <textarea id="vs-prompt" ref={box} rows={2} maxLength={caps.promptMax} placeholder={(wf === "i2v" || wf === "ref" || wf === "motion") && !caps.promptRequired ? (wf === "motion" ? "Optional: describe the look or setting, e.g. studio lighting…" : wf === "ref" ? "Optional: describe how to use the pictures, e.g. picture 1 walks into the room…" : "Optional: describe how the picture should move…") : "Describe the clip you imagine…"} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }} />
          </div>
          {shown.length > 0 && <OrderedRefs items={shown} onReorder={reorder} />}
          {mc && (
            <div className="vs-motion" role="group" aria-label="Motion transfer">
              <label><span>Engine</span>
                <select value={mcEngine} onChange={(e) => { setMcEngine(e.target.value as typeof mcEngine); setQuality(""); }}>
                  <option value="kling3">Kling 3.0 Motion Control</option>
                  <option value="kling26">Kling 2.6 Motion Control</option>
                  <option value="genjutsu">Genjutsu Motion transfer</option>
                </select>
              </label>
              {mcEngine === "genjutsu" && (
                <button type="button" className="vs-style-row" onClick={() => setStyleOpen(true)}>
                  <span>Style <SoonTag /></span><em>None</em><ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
                </button>
              )}
              {mcEngine !== "genjutsu" && (
                <>
                  <div className="vs-opt" role="group" aria-label="Scene control" title="Where the background comes from: the picture or the motion video">
                    <div className="vs-opt-head">
                      <span>Scene control <SoonTag /></span>
                      <button type="button" role="switch" aria-checked={mcScene} aria-label="Scene control" className={`cr-switch ${mcScene ? "is-on" : ""}`} onClick={() => { setMcScene((v) => !v); setNote("Scene control isn't connected yet, so it changes nothing for now."); }}><i /></button>
                    </div>
                    <select value={mcSceneFrom} disabled={!mcScene} onChange={(e) => setMcSceneFrom(e.target.value as "video" | "image")} aria-label="Where the background comes from"><option value="video">From the video</option><option value="image">From the picture</option></select>
                  </div>
                  <label title="character_orientation. From the video suits complex movements; from the picture supports camera moves better."><span>Orientation</span>
                    <select value={mcOrient} onChange={(e) => setMcOrient(e.target.value as "video" | "image")}><option value="video">From the video</option><option value="image">From the picture</option></select>
                  </label>
                  <label className="vs-motion-check"><input type="checkbox" checked={mcSound} onChange={(e) => setMcSound(e.target.checked)} /><span>Keep the clip&rsquo;s sound</span></label>
                </>
              )}
            </div>
          )}
          <div className="cr-tools">
            {!mc && (
            <div className="cr-row cr-row-a">
              <button type="button" className={`cr-chip vs-sound ${sound && caps.audio ? "" : "is-muted"}`} disabled={!caps.audio} aria-pressed={sound} aria-label={sound ? "Sound on. Tap to mute." : "Muted. Tap to turn sound on."} title={!caps.audio ? `${model.label} has no sound setting` : sound ? "Sound on. Tap to mute." : "Muted. Tap to turn sound on."} onClick={() => setSound((v) => !v)}>
                {sound && caps.audio ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <label className="cr-chip cr-select" title={aspectLocked ? "With a start frame the aspect ratio follows your picture" : "Aspect ratio of the clip"}><span className="sr-only">Aspect ratio</span>
                <select value={caps.ratios.length ? ratio : ""} onChange={(e) => setRatio(e.target.value)} aria-label="Aspect ratio" disabled={!caps.ratios.length}>
                  {caps.ratios.length ? <><option value="auto">Auto</option>{caps.ratios.filter((r) => r !== "auto").map((r) => <option key={r} value={r}>{r}</option>)}</> : <option value="">Follows picture</option>}
                </select>
              </label>
              <label className="cr-chip cr-select"><span className="sr-only">Length</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Length of the clip" disabled={!caps.durations.length} title={mc ? "The length follows the motion clip" : undefined}>{caps.durations.map((d) => <option key={d} value={d}>{secs(d)}</option>)}</select>
              </label>
              <label className="cr-chip cr-select" title={caps.qualities.length ? "Video quality" : "This model has one fixed quality"}><span className="sr-only">Quality</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Video quality" disabled={!caps.qualities.length}>
                  {caps.qualities.length ? caps.qualities.map((q) => <option key={q} value={q}>{q}</option>) : <option value="">Fixed</option>}
                </select>
              </label>
              <button type="button" className="cr-chip cr-modelbtn vs-model" aria-label="Video model" aria-haspopup="dialog" disabled={mc} title={mc ? "Motion uses its own engine: change it in the Motion panel" : pickerModel.blurb} onClick={() => setPickingModel(true)}>
                <span className="cr-mlabel">Model:</span><span className="cr-mname"><span className="vs-mshown">{pickerModel.label}</span><span className="vs-msizer" aria-hidden="true">{LONGEST_MODEL_LABEL}</span></span><ChevronDown size={14} />
              </button>
            </div>
            )}
            <div className="cr-row cr-row-top">
              <div className="vs-main">
              {mc ? (
                <label className="cr-chip cr-select" title="Quality of the result"><span className="sr-only">Quality</span>
                  {mcEngine === "genjutsu" ? (
                    <select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Video quality">{caps.qualities.map((q) => <option key={q} value={q}>{q}</option>)}</select>
                  ) : (
                    <select value={mcTier} onChange={(e) => setMcTier(e.target.value as "pro" | "std")} aria-label="Video quality"><option value="pro">Pro</option><option value="std">Standard</option></select>
                  )}
                </label>
              ) : (
                <>
              <button type="button" className="cr-chip" disabled={!model.startFrame || (!mc && (refs.length > 0 || vrefs.length > 0))} title={!model.startFrame ? `${model.label} has no start frame` : mc ? "Choose the picture that should move" : refs.length > 0 || vrefs.length > 0 ? "Use either a start frame or Ingredients, not both" : "Choose the first frame of the clip"} onClick={() => openPicker("start")}><ImageIcon size={14} /> Start frame{start ? " (1)" : ""}</button>
              <button type="button" className="cr-chip" disabled={!caps.endFrame} title={caps.endFrame ? "Choose the last frame of the clip" : start ? `${model.label} has no end frame` : "An end frame needs a start frame first"} onClick={() => openPicker("end")}><ImageIcon size={14} /> End frame{end ? " (1)" : ""}</button>
                </>
              )}
              <button type="button" className="cr-chip" disabled={(!caps.refMax && !caps.refVideoMax && !mc) || (!mc && (!!start || !!end))} title={!caps.refMax && !caps.refVideoMax && !mc ? `${model.label} takes no reference pictures or videos yet` : mc ? "Choose a picture (who or what appears) and the video whose movement should be copied" : start || end ? "Use either a start frame or Ingredients, not both" : `Choose up to ${caps.refMax} pictures${caps.refVideoMax ? ` and ${caps.refVideoMax} of your videos` : ""} the video should work from`} onClick={() => openPicker("refs")}><Layers size={14} /> Ingredients{refs.length + vrefs.length + (mc && start ? 1 : 0) ? ` (${refs.length + vrefs.length + (mc && start ? 1 : 0)})` : ""}</button>
              <button type="button" className={`cr-chip ${motion ? "is-on" : ""}`} aria-haspopup="menu" aria-pressed={!!motion} title="Copy the movement of a reference clip" onClick={(e) => setMotionAnchor(e.currentTarget.getBoundingClientRect())}><Video size={14} /> Motion{motion ? `: ${motion === "subject" ? "subject" : "3D scene"}` : ""}</button>
              <div className="cr-grp">
                <button ref={agentChip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}><AgentIcon size={14} /> <span className="cr-aname">{agent.agent ?? "Atlas"}</span></button>
                <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help with this prompt" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agent.active ? "is-on" : ""}`}
                  onClick={() => { if (!agent.agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } agent.setOn(!agent.on); }}><i /></button>
              </div>
              </div>
              <button type="button" className={`cr-chip vs-gear ${settingsInUse ? "is-on" : ""}`} aria-label="Settings" aria-haspopup="dialog" title="Seed, leave out and prompt strength" onClick={(e) => setSettingsAnchor(e.currentTarget.getBoundingClientRect())}><Settings size={16} />{settingsInUse && <i className="vs-dot" />}</button>
            </div>
            <button type="submit" className="cr-go" disabled={!canGo || submitting || seedBad}>
              {submitting ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate {price != null ? <span className="cr-cost" title={`About ${price} credits (provisional price)`}><Coins size={14} />{price}</span> : <ArrowUp size={16} />} {!live && <SoonTag />}</>}
            </button>
          </div>
        </form>
      </div>

      {target && <ReferencePicker max={target === "refs" ? (mc ? 1 : caps.refMax) : 1} picked={picked} onChange={onPicked} onClose={() => setTarget(null)} videoMax={target === "refs" ? caps.refVideoMax : 0} pickedVideos={vrefs} onVideosChange={setVrefs} videosOnly={target === "refs" && !mc && !caps.refMax} note={target === "refs" && mc ? "Choose a picture (who or what appears in the result) and one of your finished videos (its movement is copied). One of each, in either order." : undefined} />}
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
      {motionAnchor && <MotionMenu anchor={motionAnchor} selected={motion} onPick={(m) => {
        if (m === "scene") { setMotion(null); setNote("3D scene isn't connected yet."); return; }
        setMotion(m); setVrefs([]); setStart(null);
        setNote("");
      }} onClose={() => setMotionAnchor(null)} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent.agent} onPick={(n) => agent.setAgent(n)} onClose={() => setAgentAnchor(null)} />}
      {settingsAnchor && <VideoSettingsMenu anchor={settingsAnchor} label={model.label} seed={caps.seed} seedLocked={seedLocked} onSeedLocked={setSeedLocked} seedText={seedText} onSeedText={setSeedText} seedBad={seedBad} negMax={caps.negativePrompt} negative={negative} onNegative={setNegative} cfg={caps.cfgScale} creative={creative} onCreative={setCreative} onClose={() => setSettingsAnchor(null)} />}
      {styleOpen && <StyleLibrary onClose={() => setStyleOpen(false)} />}
      {pickingModel && <VideoModelPicker value={modelId} onPick={pickModel} onClose={() => setPickingModel(false)} />}
    </div>
  );
}
