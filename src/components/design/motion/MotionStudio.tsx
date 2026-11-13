"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Clock, Columns2, Download, Loader2, MessageSquarePlus, Mic, MonitorPlay, Music, Palette, Pencil, Plus, Settings2, Layers, LayoutTemplate, Shuffle,
  Square, Star, Trash2, Wand2, X, Zap, ShieldCheck, ArrowUp, Film,
} from "lucide-react";
import GrowArea from "@/components/GrowArea";
import AtlasChip from "../AtlasChip";
import ReferencePicker, { type ClipPick, type RefPick } from "@/components/create/ReferencePicker";
import { useAgentHost } from "@/lib/agent-chat";
import { useModels } from "@/lib/use-models";
import { useVoiceModels, useVoices } from "@/lib/use-voice";
import type { PublicModel } from "@/lib/models";
import { liveVideoModels, makeAsset, videoModelFor } from "@/lib/design/motion/assets";
import MotionPlayer, { type PlayerHandle } from "./MotionPlayer";
import { BrandKitDialog, DownloadDialog } from "./MotionDialogs";
import { uploadPicture } from "@/lib/use-uploads";
import { useDictation } from "@/lib/use-dictation";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { paletteOf, type LoadSpec } from "@/lib/design/motion/client";
import {
  ASPECT_HINT, DEFAULT_SETTINGS, DURATIONS, MAX_CLIPS, MOTION_ASPECTS, MOTION_MODELS, NO_DEFAULTS, RUNNING, STEP_OF, SUGGESTIONS, TEMPLATES,
  type BrandKitItem, type MotionDefaults, type MotionAspect, type MotionComment, type MotionItem, type MotionSettings, type MotionStatus, type MotionSummary, type MotionVersionItem,
} from "@/lib/design/motion/spec";
import "./motion.css";

const SETTINGS_KEY = "eclipse-motion-settings";
const json = async (r: Response) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) });
async function call(url: string, body?: unknown, method = "POST") {
  try { return await json(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })); }
  catch { return { ok: false, status: 0, body: { error: "Could not reach Eclipse. Check your connection." } }; }
}
const errOf = (r: { ok: boolean; body: { error?: string; code?: string } }) => (r.ok || r.body.code === "UPGRADE" || r.body.code === "SUBSCRIBE" ? null : r.body.error ?? "Something went wrong.");

function useKits() {
  const [kits, setKits] = useState<BrandKitItem[]>([]);
  const reload = useCallback(async () => { const r = await call("/api/design/brand-kits", undefined, "GET"); if (r.ok) setKits(r.body.items ?? []); }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { kits, reload };
}

export default function MotionStudio() {
  const [open, setOpen] = useState<string | null>(null);
  const { kits, reload: reloadKits } = useKits();
  const [recreate, setRecreate] = useState<{ prompt: string; settings: MotionSettings } | null>(null);
  if (open) return <MotionEditor id={open} kits={kits} reloadKits={reloadKits} onBack={() => setOpen(null)} onRecreate={(r) => { setRecreate(r); setOpen(null); }} />;
  return <MotionHome kits={kits} reloadKits={reloadKits} onOpen={setOpen} recreate={recreate} />;
}

/* ---------------- Home: the composer, templates and your motions ---------------- */

function MotionHome({ kits, reloadKits, onOpen, recreate }: { kits: BrandKitItem[]; reloadKits: () => Promise<void>; onOpen: (id: string) => void; recreate: { prompt: string; settings: MotionSettings } | null }) {
  const [items, setItems] = useState<MotionSummary[] | null>(null);
  useEffect(() => { void (async () => { const r = await call("/api/design/motion", undefined, "GET"); setItems(r.ok ? r.body.items ?? [] : []); })(); }, []);
  return (
    <section className="mt cr-wrap" aria-label="Motion">
      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage mt-stage" aria-live="polite">
          <div className="cr-empty"><MonitorPlay size={34} strokeWidth={1.4} /><p>Your motion appears here</p></div>
        </div>
      </section>
      <h3 className="mt-h3">Your motions</h3>
      {items === null ? <p className="mt-hint">Loading…</p> : items.length === 0 ? <p className="mt-hint">Nothing yet. Describe a motion below or start from a template.</p> : (
        <div className="mt-list">
          {items.map((m) => (
            <button key={m.id} type="button" className="mt-card" onClick={() => onOpen(m.id)}>
              <span className="mt-card-art" style={{ aspectRatio: m.aspect.replace(":", " / ") }}><MonitorPlay size={22} />{m.status && RUNNING.has(m.status) && <Loader2 size={14} className="mt-spin" />}</span>
              <b>{m.title}</b><em>{m.aspect} · {m.versions} version{m.versions === 1 ? "" : "s"} · {timeAgo(m.updatedAt)}</em>
            </button>
          ))}
        </div>
      )}
      <Composer kits={kits} reloadKits={reloadKits} onStarted={onOpen} initial={recreate} />
    </section>
  );
}

function readSettings(): MotionSettings { try { const o = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"); return { ...DEFAULT_SETTINGS, ...o, defaults: { ...NO_DEFAULTS, ...(o.defaults ?? {}) }, refs: [], clips: [] }; } catch { return DEFAULT_SETTINGS; } }
const fileUrl = (id: string) => `/api/generations/${id}/file`;
type Making = { key: string; kind: "image" | "video"; label: string };
const describeSettings = (s: MotionSettings, kit: BrandKitItem | null) => [
  `Aspect ratio: ${s.aspect}`, `Length: ${s.duration === "auto" ? "Auto (the agent picks)" : `${s.duration}s`}${s.loop ? ", loops" : ""}`,
  `Sound: ${[s.audio.sfx && "sound effects", s.audio.music && "music", s.audio.voice && "voiceover"].filter(Boolean).join(", ") || "none"}`,
  `Brand kit: ${kit?.name ?? "none"}`, `Motion writer: ${MOTION_MODELS.find((m) => m.id === s.model)?.name ?? "Eclipse Pro"}`,
  `Clip model for make_asset: ${videoModelFor(s.defaults)?.label ?? "none available"}`, `Picture model for make_asset: ${s.defaults.image ?? "Auto"}`,
];

function Composer({ kits, reloadKits, onStarted, initial }: { kits: BrandKitItem[]; reloadKits: () => Promise<void>; onStarted: (id: string) => void; initial: { prompt: string; settings: MotionSettings } | null }) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [s, setS] = useState<MotionSettings>(() => initial?.settings ?? readSettings());
  const [pics, setPics] = useState<RefPick[]>([]);
  const [menu, setMenu] = useState<null | "aspect" | "duration" | "audio" | "settings" | "templates">(null);
  const [picker, setPicker] = useState(false), [kitOpen, setKitOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [clips, setClips] = useState<ClipPick[]>(() => (initial?.settings.clips ?? []).map((c) => ({ type: "render" as const, id: c.id, url: "", label: c.label ?? "Clip", sec: c.duration ?? null })));
  const [making, setMaking] = useState<Making[]>([]);
  const [busy, setBusy] = useState(false), [writing, setWriting] = useState(false), [error, setError] = useState<string | null>(null);
  const models = useModels() ?? [];
  const dict = useDictation(prompt, setPrompt, setError);
  useEffect(() => { try { const { refs: _r, clips: _c, ...keep } = s; void _r; void _c; localStorage.setItem(SETTINGS_KEY, JSON.stringify(keep)); } catch { /* ignore */ } }, [s]);
  useEffect(() => {
    const on = (e: Event) => { const tp = (e as CustomEvent).detail as (typeof TEMPLATES)[number]; setPrompt(tp.prompt); setS((x) => ({ ...x, aspect: tp.aspect, duration: tp.duration, loop: tp.id === "loop" })); window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener("eclipse-motion-template", on); return () => window.removeEventListener("eclipse-motion-template", on);
  }, []);
  const kit = kits.find((k) => k.id === s.brandKitId) ?? null;
  const audioOn = s.audio.music || s.audio.voice || s.audio.sfx;

  async function fromDevice(f: File) {
    if (!f.type.startsWith("image/")) { setError("Add a picture here."); return; }
    setError(null); setUploading((n) => n + 1);
    try {
      const r = await uploadPicture(f, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      if (!r.item) return;
      const it = r.item;
      setPics((l) => [...l, { type: "upload" as const, id: it.id, url: it.imageUrl, label: it.name }].slice(0, 8));
    } finally { setUploading((n) => n - 1); }
  }
  async function writeIt() {
    setWriting(true); setError(null);
    const r = await call("/api/design/motion/write", { idea: prompt, duration: s.duration === "auto" ? null : s.duration });
    setWriting(false);
    if (r.ok) setPrompt(r.body.text); else setError(errOf(r));
  }
  async function go(text = prompt): Promise<string> {
    if (text.trim().length < 3) return "Describe the motion first.";
    if (busy) return "A motion is already starting.";
    setBusy(true); setError(null);
    const r = await call("/api/design/motion", { prompt: text, settings: { ...s, refs: pics.map((p) => ({ type: p.type, id: p.id, label: p.label })), clips: clips.map((c) => ({ id: c.id, label: c.label, duration: c.sec ?? undefined })) }, projectId: readCurrentProject()?.id ?? null });
    setBusy(false);
    if (r.ok) { onStarted(r.body.id); return ""; }
    const why = errOf(r); setError(why); return why ?? "It needs a plan upgrade.";
  }
  // Atlas on this screen: it sees the composer and makes the pictures and clips the motion needs (each after the person presses its button).
  useAgentHost({
    page: "design",
    context: () => ({ prompt, settings: ["Tab: Motion (composing a new motion)", ...describeSettings(s, kit)], pictures: pics.map((p, i) => ({ type: p.type, id: p.id, role: `motion picture @${i + 1}` })), clips: clips.map((c, i) => `V${i + 1}: ${c.label}`) }),
    setPrompt,
    generate: (o) => go(o.prompt ?? prompt),
    make: async (o) => {
      if (o.kind === "image" ? pics.length >= 8 : clips.length >= MAX_CLIPS) return o.kind === "image" ? "This motion already has 8 pictures. Remove one first." : `This motion already has ${MAX_CLIPS} clips. Remove one first.`;
      const key = Math.random().toString(36).slice(2);
      setMaking((l) => [...l, { key, kind: o.kind, label: o.prompt.slice(0, 40) }]);
      void makeAsset({ kind: o.kind, prompt: o.prompt, ratio: o.ratio ?? s.aspect, defaults: s.defaults, models, projectId: readCurrentProject()?.id ?? null }).then((r) => {
        setMaking((l) => l.filter((x) => x.key !== key));
        if (!r.ok) { setError(r.error); return; }
        if (r.asset.kind === "image") setPics((l) => [...l, { type: "render" as const, id: r.asset.id, url: fileUrl(r.asset.id), label: r.asset.label }].slice(0, 8));
        else setClips((l) => [...l, { type: "render" as const, id: r.asset.id, url: "", label: r.asset.label, sec: r.asset.sec ?? null }].slice(0, MAX_CLIPS));
      });
      return "";
    },
  });
  const toggle = (k: typeof menu) => setMenu((m) => (m === k ? null : k));
  return (
    <div className="cr-dock">
    {error && <p className="ds-error" role="alert">{error}</p>}
    <form className="cr-box mt-composer" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      {(pics.length > 0 || clips.length > 0 || making.length > 0) && (
        <div className="mt-pics">{pics.map((p, i) => (
          <span key={p.id} className="mt-pic">{/* eslint-disable-next-line @next/next/no-img-element -- plain img like the rest of the app */}<img src={p.url} alt={p.label} /><em>@{i + 1}</em>
            <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => setPics(pics.filter((x) => x.id !== p.id))}><X size={11} /></button></span>
        ))}{clips.map((c, i) => (
          <span key={c.id} className="mt-pic is-clip" title={c.label}><video src={`${fileUrl(c.id)}#t=0.1`} muted playsInline preload="metadata" aria-label={c.label} /><em>V{i + 1}</em>
            <button type="button" aria-label={`Remove clip ${i + 1}`} onClick={() => setClips(clips.filter((x) => x.id !== c.id))}><X size={11} /></button></span>
        ))}{making.map((x) => (
          <span key={x.key} className="mt-pic is-making" role="status" title={x.label}><Loader2 size={15} className="mt-spin" /><em>{x.kind === "video" ? "Clip" : "Picture"}</em></span>
        ))}</div>
      )}
      <div className="cr-field">
        <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." onClick={() => fileInput.current?.click()}>{uploading > 0 ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) void fromDevice(f); e.target.value = ""; }} />
        <GrowArea className="mt-text" rows={2} maxLines={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A 10-second logo reveal for a coffee brand, warm tones, steam rising…" aria-label="Describe your motion"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void go(); } }} />
      </div>
      <div className="cr-tools">
        <div className="cr-row cr-row-a">
          <label className="cr-chip cr-select">
            <span className="sr-only">Aspect ratio</span>
            <select value={s.aspect} onChange={(e) => setS({ ...s, aspect: e.target.value as MotionSettings["aspect"] })} aria-label="Aspect ratio">
              {MOTION_ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <div className="mt-pop-wrap">
          <button type="button" className="cr-chip" aria-expanded={menu === "duration"} onClick={() => toggle("duration")}><Clock size={14} />{s.duration === "auto" ? "Auto" : `${s.duration}s`}{s.loop && <span className="mt-loopdot">∞</span>}</button>
          {menu === "duration" && <div className="mt-pop mt-pop-wide" role="dialog" aria-label="Duration">
            <b className="mt-pop-h">Duration</b>
            <button type="button" className={`mt-auto${s.duration === "auto" ? " is-on" : ""}`} onClick={() => setS({ ...s, duration: "auto" })}><b>Auto</b><em>Picks the length for you</em></button>
            <em className="mt-pop-sub">Or choose a length</em>
            <div className="mt-seg">{DURATIONS.map((d) => <button key={d} type="button" className={s.duration === d ? "is-on" : ""} onClick={() => setS({ ...s, duration: d })}>{d < 60 ? `${d}s` : "1 min"}</button>)}</div>
            <label className="mt-switch"><span><b>Loop</b><em>The end matches the start, so it repeats without a seam.</em></span><input type="checkbox" checked={s.loop} onChange={(e) => setS({ ...s, loop: e.target.checked })} /></label>
          </div>}
        </div>
          <div className="mt-pop-wrap">
          <button type="button" className={`cr-chip${audioOn ? " is-on" : ""}`} aria-expanded={menu === "audio"} onClick={() => toggle("audio")}><Music size={14} />Audio</button>
          {menu === "audio" && <div className="mt-pop mt-pop-wide" role="dialog" aria-label="Audio">
            <b className="mt-pop-h">Audio</b><em className="mt-pop-sub">Turn one off and the agent never adds it.</em>
            {(["sfx", "music", "voice"] as const).map((k) => (
              <label key={k} className="mt-switch"><span><b>{k === "sfx" ? "Sound effects" : k === "music" ? "Music" : "Voiceover"}</b></span><input type="checkbox" checked={s.audio[k]} onChange={(e) => setS({ ...s, audio: { ...s.audio, [k]: e.target.checked } })} /></label>
            ))}
          </div>}
        </div>
          <button type="button" className={`cr-chip${kit ? " is-on" : ""}`} onClick={() => setKitOpen(true)}><Palette size={14} />{kit ? kit.name : "Brand kit"}</button>
        </div>
        <div className="cr-row">
          <button type="button" className="cr-chip" title="Use pictures and clips from your Ingredients, Assets or earlier work" onClick={() => setPicker(true)}><Layers size={14} /> Ingredients{pics.length + clips.length ? ` (${pics.length + clips.length})` : ""}</button>
          <div className="mt-pop-wrap">
            <button type="button" className="cr-chip" aria-expanded={menu === "templates"} onClick={() => toggle("templates")}><LayoutTemplate size={14} /> Templates</button>
            {menu === "templates" && <div className="mt-pop mt-pop-wide" role="menu" aria-label="Templates">
              <b className="mt-pop-h">Start from a template</b>
              {TEMPLATES.map((tp) => (
                <button key={tp.id} type="button" role="menuitem" onClick={() => { setPrompt(tp.prompt); setS((x) => ({ ...x, aspect: tp.aspect, duration: tp.duration, loop: tp.id === "loop" })); setMenu(null); }}>
                  <span><b>{tp.name}</b><em>{tp.aspect} · {tp.duration}s</em></span>
                </button>
              ))}
            </div>}
          </div>
          <button type="button" className="cr-chip" disabled={writing || !prompt.trim()} title="Turns your idea into a full description" onClick={writeIt}>{writing ? <Loader2 size={14} className="cr-spin" /> : <Wand2 size={14} />} Write it for me</button>
          <AtlasChip />
          <div className="mt-pop-wrap">
          <button type="button" className="cr-chip" aria-label="Motion settings" aria-expanded={menu === "settings"} onClick={() => toggle("settings")}><Settings2 size={16} /></button>
          {menu === "settings" && <div className="mt-pop mt-pop-wide mt-pop-right" role="dialog" aria-label="Motion settings">
            <b className="mt-pop-h">Agent model</b>
            {MOTION_MODELS.map((m) => <button key={m.id} type="button" className={`mt-opt${s.model === m.id ? " is-on" : ""}`} onClick={() => setS({ ...s, model: m.id })}><b>{m.name}</b><em>{m.blurb}</em>{s.model === m.id && <Check size={14} />}</button>)}
            <b className="mt-pop-h">Permissions</b>
            <button type="button" className={`mt-opt${s.approval === "ask" ? " is-on" : ""}`} onClick={() => setS({ ...s, approval: "ask" })}><ShieldCheck size={15} /><span><b>Ask first</b><em>Asks before paid sound (music, voiceover, sound effects). The motion itself is made right away.</em></span>{s.approval === "ask" && <Check size={14} />}</button>
            <button type="button" className={`mt-opt${s.approval === "auto" ? " is-on" : ""}`} onClick={() => setS({ ...s, approval: "auto" })}><Zap size={15} /><span><b>Auto approve</b><em>Makes everything the motion needs without asking. The cost shows on the version.</em></span>{s.approval === "auto" && <Check size={14} />}</button>
            <DefaultsPicker d={s.defaults} models={models} onChange={(defaults) => setS({ ...s, defaults })} />
          </div>}
        </div>
          <button type="button" className={`cr-chip${dict.listening ? " is-on" : ""}`} aria-label={dict.listening ? "Stop dictation" : "Dictate"} onClick={dict.toggle}><Mic size={14} /></button>
        </div>
        <button type="submit" className="cr-go" disabled={busy || prompt.trim().length < 3}>{busy ? <Loader2 size={16} className="cr-spin" /> : null}Generate</button>
      </div>
      {picker && <ReferencePicker max={8} picked={pics} onChange={setPics} videoMax={MAX_CLIPS} pickedVideos={clips} onVideosChange={setClips} onClose={() => setPicker(false)} />}
      {kitOpen && <BrandKitDialog kits={kits} reload={reloadKits} chosen={s.brandKitId} onChoose={(id) => { setS({ ...s, brandKitId: id }); setKitOpen(false); }} onClose={() => setKitOpen(false)} />}
    </form>
    </div>
  );
}

/* ---------------- Editor: preview, versions, edits, comments, remix, download ---------------- */

function useMotion(id: string) {
  const [m, setM] = useState<MotionItem | null>(null), [missing, setMissing] = useState(false);
  const load = useCallback(async () => { const r = await call(`/api/design/motion/${id}`, undefined, "GET"); if (r.ok) setM(r.body); else if (r.status === 404) setMissing(true); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const busy = (m?.versions ?? []).some((v) => RUNNING.has(v.status));
  useEffect(() => { if (!busy) return; const t = setTimeout(() => void load(), document.hidden ? 15000 : 3000); return () => clearTimeout(t); }, [busy, m, load]);
  return { m, missing, reload: load };
}

const STEPS = ["Plan", "Write", "Review", "Finish"];
const STATUS_TEXT: Record<MotionStatus, string> = { planning: "Planning the motion", writing: "Writing the composition", reviewing: "Reviewing the motion", approval: "Waiting for your approval", finishing: "Adding the sound", ready: "Ready", failed: "Failed", stopped: "Stopped" };

function MotionEditor({ id, kits, reloadKits, onBack, onRecreate }: { id: string; kits: BrandKitItem[]; reloadKits: () => Promise<void>; onBack: () => void; onRecreate: (r: { prompt: string; settings: MotionSettings }) => void }) {
  const { m, missing, reload } = useMotion(id);
  const [sel, setSel] = useState<string | null>(null), [compare, setCompare] = useState<string | null>(null);
  const [tab, setTab] = useState<"versions" | "details">("versions");
  const [text, setText] = useState(""), [commenting, setCommenting] = useState(false), [pin, setPin] = useState<{ t: number; x: number; y: number } | null>(null), [pinText, setPinText] = useState("");
  const [remix, setRemix] = useState(false), [download, setDownload] = useState(false), [kitOpen, setKitOpen] = useState<null | "add">(null);
  const [error, setError] = useState<string | null>(null), [note, setNote] = useState<string | null>(null), [busy, setBusy] = useState(false), [renaming, setRenaming] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false), [time, setTime] = useState<number | null>(null);
  const player = useRef<PlayerHandle>(null);
  const [making, setMaking] = useState<Making[]>([]);
  const models = useModels() ?? [];

  const versions = useMemo(() => m?.versions ?? [], [m]);
  const v = versions.find((x) => x.id === sel) ?? versions[0] ?? null;
  const other = compare ? versions.find((x) => x.id === compare) ?? null : null;
  const kit = kits.find((k) => k.id === m?.settings.brandKitId) ?? null;
  useEffect(() => { if (!sel && versions[0]) setSel(versions[0].id); }, [versions, sel]);
  // A new version appears at the top: follow it.
  const newest = versions[0]?.id;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => { if (newest && seen.current && newest !== seen.current) setSel(newest); seen.current = newest; }, [newest]);

  const specOf = useCallback((x: MotionVersionItem | null): LoadSpec | null => (x?.code && m ? { code: x.code, aspect: x.aspect, duration: x.duration, loop: m.settings.loop, palette: paletteOf(kit), images: [...m.settings.refs, ...(kit?.logos ?? [])], clips: m.settings.clips } : null), [m, kit]);
  const spec = useMemo(() => specOf(v), [v, specOf]);
  const spec2 = useMemo(() => specOf(other), [other, specOf]);

  // Atlas while editing: it sees the edit box and this motion, can send an edit, and can make pictures and clips that are added to the motion.
  useAgentHost({
    page: "design",
    context: () => ({ prompt: text, settings: [`Tab: Motion, editing "${m?.title ?? "a motion"}" version ${v?.n ?? 1}${v?.plan ? `. Its plan: ${v.plan.slice(0, 600)}` : ""}`, ...(m ? describeSettings(m.settings, kit) : [])], pictures: (m?.settings.refs ?? []).map((p, i) => ({ type: p.type, id: p.id, role: `motion picture @${i + 1}` })), clips: (m?.settings.clips ?? []).map((c, i) => `V${i + 1}: ${c.label ?? "clip"}`) }),
    setPrompt: setText,
    generate: async (o) => {
      if (!v?.code) return "Wait for this version to finish first.";
      const t = (o.prompt ?? text).trim();
      if (!t && !(v.comments ?? []).some((c) => !c.used)) return "Describe the change first.";
      await newVersion({ action: "edit", from: v.id, text: t });
      return "";
    },
    make: async (o) => {
      if (!m) return "The motion is still loading.";
      if (o.kind === "image" ? m.settings.refs.length >= 8 : m.settings.clips.length >= MAX_CLIPS) return o.kind === "image" ? "This motion already has 8 pictures." : `This motion already has ${MAX_CLIPS} clips.`;
      const key = Math.random().toString(36).slice(2);
      setMaking((l) => [...l, { key, kind: o.kind, label: o.prompt.slice(0, 40) }]);
      void makeAsset({ kind: o.kind, prompt: o.prompt, ratio: o.ratio ?? v?.aspect ?? m.settings.aspect, defaults: m.settings.defaults, models, projectId: readCurrentProject()?.id ?? null }).then(async (r) => {
        setMaking((l) => l.filter((x) => x.key !== key));
        if (!r.ok) { setError(r.error); return; }
        // Read the motion again so two assets finishing close together are both kept.
        const cur = await call(`/api/design/motion/${id}`, undefined, "GET");
        const st = (cur.ok ? cur.body.settings : m.settings) as MotionSettings;
        const settings = r.asset.kind === "image" ? { refs: [...st.refs, { type: "render", id: r.asset.id, label: r.asset.label }] } : { clips: [...st.clips, { id: r.asset.id, label: r.asset.label }] };
        const u = await call(`/api/design/motion/${id}`, { settings }, "PATCH");
        if (!u.ok) { setError(errOf(u)); return; }
        await reload();
        setNote(r.asset.kind === "image" ? `Added picture @${st.refs.length + 1}. Ask for a change to use it.` : `Added clip V${st.clips.length + 1}. Ask for a change to use it.`);
      });
      return "";
    },
  });

  if (missing) return <section className="mt"><button type="button" className="mt-back" onClick={onBack}><ArrowLeft size={16} />Motion</button><p className="mt-hint">This motion was deleted.</p></section>;
  if (!m || !v) return <section className="mt"><p className="mt-hint"><Loader2 size={15} className="mt-spin" /> Loading…</p></section>;

  const unused = v.comments.filter((c) => !c.used);
  async function act(body: object, vid = v!.id) { const r = await call(`/api/design/motion/${id}/versions/${vid}`, body); if (!r.ok) setError(errOf(r)); await reload(); return r; }
  async function newVersion(body: object) {
    setBusy(true); setError(null);
    const r = await call(`/api/design/motion/${id}/versions`, body);
    setBusy(false);
    if (r.ok) { setText(""); setSel(r.body.versionId); await reload(); } else setError(errOf(r));
  }
  const send = () => newVersion({ action: "edit", from: v.id, text });
  async function addComment() {
    if (!pin || !pinText.trim()) return;
    const r = await act({ action: "comment", ...pin, text: pinText.trim() });
    if (r.ok) { setPin(null); setPinText(""); setCommenting(false); }
  }

  return (
    <section className="mt mt-editor" aria-label="Motion editor">
      <div className="mt-top">
        <button type="button" className="mt-back" onClick={onBack} aria-label="Back to Motion"><ArrowLeft size={16} /></button>
        {renaming === null ? <button type="button" className="mt-title" onClick={() => setRenaming(m.title)}>{m.title}<Pencil size={13} /></button>
          : <input className="mt-rename" autoFocus value={renaming} aria-label="Motion name" onChange={(e) => setRenaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }}
              onBlur={async () => { const t = renaming.trim(); setRenaming(null); if (t && t !== m.title) { await call(`/api/design/motion/${id}`, { title: t }, "PATCH"); await reload(); } }} />}
        <span className="mt-grow" />
        <button type="button" className={`mt-icon${v.starred ? " is-on" : ""}`} aria-label={v.starred ? "Unstar" : "Star"} onClick={() => act({ action: v.starred ? "unstar" : "star" })}><Star size={15} /></button>
        <div className="mt-pop-wrap">
          <button type="button" className="mt-chip" aria-expanded={remix} onClick={() => setRemix(!remix)}><Shuffle size={14} />Remix<ChevronDown size={13} /></button>
          {remix && <div className="mt-pop mt-pop-wide mt-pop-right" role="menu" aria-label="Remix">
            <button type="button" className="mt-opt" onClick={() => { setRemix(false); onRecreate({ prompt: m.prompt, settings: m.settings }); }}><span><b>Recreate</b><em>Loads the prompt, files and settings into the composer to tweak and run again.</em></span></button>
            <b className="mt-pop-h">Adapt to another format</b><em className="mt-pop-sub">Every shot is recomposed for the new frame, as a new branch.</em>
            <div className="mt-formats">{MOTION_ASPECTS.map((a) => <button key={a} type="button" disabled={a === v.aspect || !v.code} onClick={() => { setRemix(false); void newVersion({ action: "adapt", from: v.id, aspect: a }); }}><span className="mt-ar" style={{ aspectRatio: a.replace(":", " / ") }} />{a}</button>)}</div>
            <button type="button" className="mt-opt" disabled={!v.code} onClick={async () => { setRemix(false); const r = await call("/api/design/brand-kits", { fromVersion: v.id }); if (r.ok) { await reloadKits(); setNote(`Brand kit "${r.body.name}" is ready. Choose it in Brand kit for your next motion.`); } else setError(errOf(r)); }}><span><b>Create brand kit from this motion</b><em>Saves its colours and motion style as a new kit, with this motion as an example.</em></span></button>
            <button type="button" className="mt-opt" disabled={!v.code} onClick={() => { setRemix(false); setKitOpen("add"); }}><span><b>Add to brand kit</b><em>Makes it an example in a kit: new motions follow how it moves.</em></span></button>
          </div>}
        </div>
        <button type="button" className="mt-go" disabled={!v.code} onClick={() => { player.current?.pause(); setDownload(true); }}><Download size={14} />Download</button>
      </div>

      <div className="mt-body">
        <div className="mt-main">
          <div className={`mt-players${other ? " is-two" : ""}`}>
            <div>
              {other && <span className="mt-tag">v{v.n}</span>}
              <MotionPlayer ref={player} spec={spec} audio={v.audio} comments={v.comments} commenting={commenting} onPin={(p) => { setPin(p); setPinText(""); }}
                playing={playing} onPlaying={setPlaying} onTime={(t) => other && setTime(t)} />
            </div>
            {other && <div><span className="mt-tag">v{other.n}</span><MotionPlayer spec={spec2} audio={other.audio} compact syncTime={time} playing={false} onPlaying={() => {}} /><button type="button" className="mt-link" onClick={() => setCompare(null)}><X size={13} />Close comparison</button></div>}
          </div>
          {pin && (
            <div className="mt-pinform">
              <b>Comment at {pin.t.toFixed(1)}s</b>
              <GrowArea rows={2} value={pinText} onChange={(e) => setPinText(e.target.value)} placeholder="Change the typography colour…" aria-label="Comment" autoFocus />
              <div className="mt-row"><span className="mt-grow" /><button type="button" className="mt-chip" onClick={() => setPin(null)}>Cancel</button><button type="button" className="mt-go" disabled={!pinText.trim()} onClick={addComment}>Comment</button></div>
            </div>
          )}
          {making.length > 0 && <div className="mt-pics">{making.map((x) => <span key={x.key} className="mt-pic is-making" role="status" title={x.label}><Loader2 size={15} className="mt-spin" /><em>{x.kind === "video" ? "Clip" : "Picture"}</em></span>)}</div>}
          {RUNNING.has(v.status) && <Progress v={v} onStop={() => act({ action: "stop" })} />}
          {v.status === "approval" && v.audio && <Approval v={v} onApprove={() => act({ action: "approve" })} onDecline={() => act({ action: "decline" })} onChange={() => { setText("Change the sound: "); }} />}
          {(v.status === "failed" || v.status === "stopped") && <div className="mt-card-note is-bad"><b>{STATUS_TEXT[v.status]}</b><span>{v.error}</span><button type="button" className="mt-chip" onClick={() => newVersion({ action: "retry", from: v.id })}>Try again</button></div>}

          <div className="mt-chips">{SUGGESTIONS.map((sg) => <button key={sg} type="button" className="mt-chip" disabled={!v.code || busy} onClick={() => (sg === "Try 9:16" ? newVersion({ action: "adapt", from: v.id, aspect: "9:16" }) : setText(sg))}>{sg}</button>)}</div>
          <div className="mt-composer mt-editbar">
            <div className="mt-row">
              <span className="mt-badge"><Pencil size={12} />Editing v{v.n}</span>
              {unused.length > 0 && <span className="mt-badge is-red"><MessageSquarePlus size={12} />With {unused.length} comment{unused.length === 1 ? "" : "s"}</span>}
              <span className="mt-grow" />
              <span className="mt-hint">{m.settings.approval === "auto" ? "Auto approve" : "Ask first"}</span>
            </div>
            <GrowArea className="mt-text" rows={1} maxLines={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Describe a change to v${v.n}…`} aria-label="Describe a change"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
            <div className="mt-row">
              <button type="button" className={`mt-chip${commenting ? " is-on" : ""}`} aria-pressed={commenting} disabled={!v.code} onClick={() => { setCommenting(!commenting); setPlaying(false); }}><MessageSquarePlus size={14} />{commenting ? "Click the preview" : "Comment"}</button>
              <span className="mt-grow" />
              <button type="button" className="mt-go" disabled={busy || !v.code || (!text.trim() && !unused.length)} onClick={send}>{busy ? <Loader2 size={14} className="mt-spin" /> : <ArrowUp size={14} />}Edit v{v.n}</button>
            </div>
          </div>
          {error && <p className="mt-error" role="alert">{error}</p>}
          {note && <p className="mt-note" role="status">{note}</p>}
        </div>

        <aside className="mt-side" aria-label="Versions">
          <div className="mt-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "versions"} className={tab === "versions" ? "is-on" : ""} onClick={() => setTab("versions")}>Versions</button>
            <button role="tab" aria-selected={tab === "details"} className={tab === "details" ? "is-on" : ""} onClick={() => setTab("details")}>Details</button>
          </div>
          {tab === "versions" ? (
            <ol className="mt-versions">
              {versions.map((x) => (
                <li key={x.id} className={x.id === v.id ? "is-on" : ""}>
                  <button type="button" className="mt-vbtn" onClick={() => { setSel(x.id); setCommenting(false); setPin(null); }}>
                    <span className="mt-vn">v{x.n}{x.starred && <Star size={11} />}</span>
                    <span className="mt-vlabel">{x.label || "Untitled"}</span>
                    <em>{RUNNING.has(x.status) || x.status === "approval" ? STATUS_TEXT[x.status] : x.status === "ready" ? `${x.duration}s · ${x.aspect}` : STATUS_TEXT[x.status]}{x.credits ? ` · ${x.credits} credits` : ""} · {timeAgo(x.createdAt)}</em>
                  </button>
                  <div className="mt-vacts">
                    {x.id !== v.id && x.code && <button type="button" aria-label={`Compare with v${x.n}`} onClick={() => setCompare(compare === x.id ? null : x.id)}><Columns2 size={13} /></button>}
                    <button type="button" aria-label={`Delete v${x.n}`} onClick={async () => { if (confirm(`Delete v${x.n}?`)) { await act({ action: "delete" }, x.id); if (sel === x.id) setSel(null); } }}><Trash2 size={13} /></button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-details">
              <dl><dt>Version</dt><dd>v{v.n}</dd><dt>Aspect ratio</dt><dd>{v.aspect}</dd><dt>Length</dt><dd>{v.duration}s{m.settings.loop ? " · loops" : ""}</dd><dt>Model</dt><dd>{MOTION_MODELS.find((x) => x.id === m.settings.model)?.name}</dd><dt>Brand kit</dt><dd>{kit?.name ?? "None"}</dd><dt>Credits</dt><dd>{v.credits}</dd></dl>
              {v.plan && <><b>Plan</b><p className="mt-plan">{v.plan}</p></>}
              <b>Prompt</b><p className="mt-plan">{m.prompt}</p>
              {unused.length > 0 && <><b>Comments</b><ul className="mt-comments">{unused.map((c: MotionComment) => <li key={c.id}><button type="button" onClick={() => player.current?.seek(c.t)}>{c.t.toFixed(1)}s</button>{c.text}<button type="button" aria-label="Remove comment" onClick={() => act({ action: "uncomment", commentId: c.id })}><X size={12} /></button></li>)}</ul></>}
              <button type="button" className="mt-link is-bad" onClick={async () => { if (confirm("Delete this motion and every version?")) { await call(`/api/design/motion/${id}`, undefined, "DELETE"); onBack(); } }}><Trash2 size={13} />Delete motion</button>
            </div>
          )}
        </aside>
      </div>
      {download && <DownloadDialog title={m.title} version={v} clips={m.settings.clips} host={() => player.current?.host() ?? null} onClose={() => setDownload(false)} />}
      {kitOpen && <BrandKitDialog kits={kits} reload={reloadKits} chosen={null} addVersion={v.id} onChoose={() => { setKitOpen(null); setNote("Added to the brand kit as an example."); }} onClose={() => setKitOpen(null)} />}
    </section>
  );
}

function Progress({ v, onStop }: { v: MotionVersionItem; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((now - new Date(v.createdAt).getTime()) / 1000));
  const step = STEP_OF[v.status];
  return (
    <div className="mt-progress" role="status">
      <b><Loader2 size={14} className="mt-spin" />{STATUS_TEXT[v.status]}</b>
      <em>{v.status === "finishing" ? "Usually under a minute" : "Usually 1 to 4 min"}</em>
      <div className="mt-steps">{STEPS.map((s, i) => <span key={s} className={i < step ? "is-done" : i === step ? "is-now" : ""}><i />{s}</span>)}</div>
      <div className="mt-row"><span className="mt-hint">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span><span className="mt-grow" />{v.status !== "finishing" && <button type="button" className="mt-chip" onClick={onStop}><Square size={12} />Stop</button>}</div>
    </div>
  );
}

function Approval({ v, onApprove, onDecline, onChange }: { v: MotionVersionItem; onApprove: () => void; onDecline: () => void; onChange: () => void }) {
  const parts = (["music", "voice", "sfx"] as const).filter((k) => v.audio?.[k]);
  const total = parts.reduce((n, k) => n + (v.audio?.[k]?.credits ?? 0), 0);
  return (
    <div className="mt-approve" role="region" aria-label="Generations to approve">
      <b><ShieldCheck size={15} />Generations to approve</b>
      <ul>{parts.map((k) => <li key={k}><span>{k === "sfx" ? "Sound effects" : k === "music" ? "Music" : "Voiceover"}</span><em>{v.audio![k]!.prompt}</em>{v.audio![k]!.credits != null && <i>{v.audio![k]!.credits} credits</i>}</li>)}</ul>
      <div className="mt-row"><button type="button" className="mt-chip" onClick={onDecline}>Skip sound</button><button type="button" className="mt-chip" onClick={onChange}>Ask for changes</button><span className="mt-grow" /><button type="button" className="mt-go" onClick={onApprove}>Approve and generate{total ? ` · ${total} credits` : ""}</button></div>
    </div>
  );
}

/** Which models Atlas uses when it makes pictures and clips for a motion, and who speaks the voiceover. */
function DefaultsPicker({ d, models, onChange }: { d: MotionDefaults; models: PublicModel[]; onChange: (d: MotionDefaults) => void }) {
  const { models: voiceModels } = useVoiceModels();
  const tts = (voiceModels ?? []).filter((m) => m.kinds.includes("tts") && m.ready);
  const { voices } = useVoices(d.voiceModel);
  const video = liveVideoModels();
  return (
    <>
      <b className="mt-pop-h">Defaults</b>
      <em className="mt-pop-sub">Used when Atlas makes pictures and clips for a motion, and for the voiceover.</em>
      <label className="mt-field"><span>Pictures</span>
        <select value={d.image ?? ""} aria-label="Default picture model" onChange={(e) => onChange({ ...d, image: e.target.value || null })}>
          <option value="">Auto</option>{models.filter((m) => !m.requiresReference).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select></label>
      <label className="mt-field"><span>Clips</span>
        <select value={d.video ?? ""} aria-label="Default video model" onChange={(e) => onChange({ ...d, video: e.target.value || null })}>
          <option value="">Eclipse picks</option>{video.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select></label>
      <label className="mt-field"><span>Voice model</span>
        <select value={d.voiceModel ?? ""} aria-label="Default voice model" onChange={(e) => onChange({ ...d, voiceModel: e.target.value || null, voiceId: null, voiceName: null })}>
          <option value="">Eclipse picks</option>{tts.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select></label>
      {d.voiceModel && (
        <label className="mt-field"><span>Voice</span>
          <select value={d.voiceId ?? ""} aria-label="Default voice" onChange={(e) => { const v = (voices ?? []).find((x) => x.voiceId === e.target.value); onChange({ ...d, voiceId: v?.voiceId ?? null, voiceName: v?.name ?? null }); }}>
            <option value="">{voices === null ? "Loading voices…" : "First voice"}</option>{(voices ?? []).slice(0, 100).map((v) => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}
          </select></label>
      )}
    </>
  );
}
