"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Coins, Download, FileText, Loader2, Minus, Pause, Play, Plus, Search, Tag, Trash2 } from "lucide-react";
import SoonTag from "../SoonTag";
import Stage from "./Stage";
import TranscriptView from "./Transcript";
import { EffectsConsole, ModeTabs, MusicConsole, TranscribeConsole, type Mode } from "./Modes";
import VoiceCreator from "./VoiceCreator";
import VoicePicker from "./VoicePicker";
import SheetPortal from "./SheetPortal";
import { clock, orbStyle } from "./look";
import { useCredits } from "@/lib/use-credits";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { deleteOwnVoice, deleteVoice, startVoice, useVoiceJobs, useVoiceModels, useVoices, type AudioItem, type OwnVoice, type VoiceOption } from "@/lib/use-voice";
import "./voice.css";

// Voice Studio (AUDIO). A stage, not a form: the chosen voice sits in the middle of a ring that breathes, runs while a take is made and moves (with a red progress ring)
// while one plays. Voices are a strip of orbs to swipe through (the full list with search is one tap away), the takes are a quiet list under it, and everything you
// type and set lives in one console docked at the bottom. EVERY control comes from the audio registry (src/lib/audio/registry.ts): one the model cannot use is greyed.
const MODEL_KEY = "eclipse-voice-model";
const VOICE_KEY = "eclipse-voice-voice";
const DRAFT_KEY = "eclipse-draft-voice"; // cleared at sign-out with the other drafts
const MODE_KEY = "eclipse-voice-mode";
const KIND_LABEL = { tts: "Voice", stt: "Transcript", sfx: "Sound effect", music: "Music" } as const;
const MODE_HERO: Record<Exclude<Mode, "speak">, [string, string]> = { transcribe: ["Transcribe", "Turn a recording into text with times and speakers"], effects: ["Sound effects", "Describe a sound and get it"], music: ["Music", "Describe a track and get it"] };
const SPEEDS = [0.7, 0.8, 0.9, 1, 1.1, 1.2];

type Chosen = { id: string; name: string; facts?: string };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };
const notReady = (provider?: string) => `${provider ?? "This provider"} is not connected yet. Its voices appear once its key is set.`;
const voiceKey = (provider: string) => `${VOICE_KEY}-${provider}`; // voice ids belong to one provider, so the choice is kept per provider
const factsOf = (v: VoiceOption) => [v.accent, v.gender, v.age, v.descriptive].filter(Boolean).join(" · ") || undefined;

export default function VoiceStudio() {
  const { models: allModels, error: modelsError, costs, consentText } = useVoiceModels();
  const models = useMemo(() => allModels?.filter((m) => m.kind === "tts") ?? null, [allModels]);
  const [studioMode, setStudioMode] = useState<Mode>("speak");
  const { items, reload } = useVoiceJobs();
  const { reload: reloadCredits } = useCredits();
  const [modelId, setModelId] = useState<string | null>(null);
  const [voice, setVoice] = useState<Chosen | null>(null);
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [playing, setPlaying] = useState<string | null>(null);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const box = useRef<HTMLTextAreaElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setModelId(read(MODEL_KEY));
    const m = read(MODE_KEY);
    if (m === "transcribe" || m === "effects" || m === "music") setStudioMode(m);
    setText(read(DRAFT_KEY) ?? "");
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) write(DRAFT_KEY, text || null); }, [text]);
  // The script box grows with what is written (up to a limit, then it scrolls).
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }, [text]);

  const model = useMemo(() => models?.find((m) => m.id === modelId) ?? models?.[0] ?? null, [models, modelId]);
  const provider = model?.provider ?? null;
  // The voice chosen for this model's provider (the first visit of this page used one key for every provider: that choice was ElevenLabs').
  useEffect(() => {
    if (!provider) return;
    let v: Chosen | null = null;
    try { const raw = read(voiceKey(provider)) ?? (provider === "elevenlabs" ? read(VOICE_KEY) : null); const j = JSON.parse(raw ?? "null"); if (j && typeof j.id === "string" && typeof j.name === "string") v = j; } catch {}
    setVoice(v);
  }, [provider]);
  // Models grouped by provider for the menu (each provider once, in the order it first appears).
  const groups = useMemo(() => {
    const g = new Map<string, NonNullable<typeof models>>();
    for (const m of models ?? []) g.set(m.providerLabel, [...(g.get(m.providerLabel) ?? []), m]);
    return Array.from(g, ([label, items]) => ({ label, items }));
  }, [models]);
  const strip = useVoices(model?.id ?? null);
  const sheet = useVoices(picking ? model?.id ?? null : null);
  useEffect(() => { if (model && !model.supports.speed && speed !== 1) setSpeed(1); }, [model, speed]);

  const pending = items?.some((i) => i.status === "pending") ?? false;
  useEffect(() => { if (!pending) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [pending]);

  // One player for every take; the stage follows whatever is playing.
  useEffect(() => {
    const a = new Audio();
    player.current = a;
    a.ontimeupdate = () => setPos({ t: a.currentTime, d: a.duration || 0 });
    a.onended = () => { setPlaying(null); setPos({ t: 0, d: 0 }); };
    a.onpause = () => { if (!a.ended) setPlaying(null); };
    return () => { a.pause(); player.current = null; };
  }, []);
  const toggle = useCallback((t: AudioItem) => {
    const a = player.current;
    if (!a || !t.url) return;
    if (a.dataset.id === t.id && !a.paused) { a.pause(); return; }
    if (a.dataset.id !== t.id) { a.pause(); a.src = t.url; a.dataset.id = t.id; setPos({ t: 0, d: 0 }); }
    setPlaying(t.id);
    void a.play().catch(() => setPlaying(null));
  }, []);

  const takes = items ?? [];
  const playingTake = takes.find((t) => t.id === playing) ?? null;
  const making = takes.find((t) => t.status === "pending") ?? null;
  const mode: "idle" | "making" | "playing" = playingTake ? "playing" : making ? "making" : "idle";
  const stageSeed = playingTake?.voiceId ?? (studioMode === "speak" ? voice?.id : studioMode) ?? "eclipse";

  const chars = text.trim().length;
  const over = model ? chars > model.maxChars : false;
  const pricing = model?.pricing ?? null;
  const price = !pricing || chars === 0 || pricing.unit === "sec" ? null : pricing.unit === "max" ? pricing.credits
    : Math.max(1, Math.ceil((pricing.unit === "byte" ? new TextEncoder().encode(text.trim()).length : chars) * pricing.perUnit));
  const ready = !!model?.ready && strip.ready;
  const NOT_READY = notReady(model?.providerLabel);
  const canGo = !!model && (!!voice || !ready || model.voiceOptional) && chars > 0 && !over && !submitting;
  const message = error || (modelsError && !models?.length ? modelsError : "") || (strip.error && !picking ? strip.error : "");

  const insertTag = useCallback((tag: string) => {
    const el = box.current;
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const t = `${a > 0 && !/\s/.test(text[a - 1]) ? " " : ""}${tag} `;
    setText(text.slice(0, a) + t + text.slice(b));
    setTagsOpen(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + t.length, a + t.length); });
  }, [text]);

  async function generate() {
    if (!canGo || !model) return;
    if (!ready) { setError(NOT_READY); return; }
    if (!voice && !model.voiceOptional) { setError("Pick a voice first."); return; }
    setError("");
    setSubmitting(true);
    const r = await startVoice({ text: text.trim(), model: model.id, voiceId: voice?.id ?? "", voiceName: voice?.name, speed: model.supports.speed && speed !== 1 ? speed : undefined, projectId: readCurrentProject()?.id ?? null });
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    setText("");
    write(DRAFT_KEY, null);
    void reload();
  }

  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!items) return;
    const done = items.filter((i) => i.status === "completed").map((i) => i.id);
    if (seen.current && done.some((id) => !seen.current!.has(id))) reloadCredits();
    seen.current = new Set(done);
  }, [items, reloadCredits]);

  async function remove(id: string) {
    if (player.current?.dataset.id === id) { player.current.pause(); setPlaying(null); }
    if (await deleteVoice(id)) void reload(); else setError("That take could not be deleted. Please try again.");
  }

  // A voice just made: select it. It belongs to one provider, so the model switches to that provider's if it is not already one of its models.
  function created(v: OwnVoice) {
    const c = { id: v.voiceId, name: v.name, facts: v.descriptive };
    write(voiceKey(v.provider), JSON.stringify(c));
    setCreating(false); setPicking(false); setError("");
    if (provider !== v.provider) {
      const next = models?.find((m) => m.provider === v.provider);
      if (next) { setModelId(next.id); write(MODEL_KEY, next.id); }
    } else { setVoice(c); strip.reload(); }
  }
  async function removeOwn(v: VoiceOption): Promise<string | null> {
    if (!v.ownId) return "That voice could not be deleted.";
    const r = await deleteOwnVoice(v.ownId);
    if (!r.ok) return r.error;
    if (voice?.id === v.voiceId && provider) { setVoice(null); write(voiceKey(provider), null); }
    strip.reload(); sheet.reload();
    return null;
  }

  function changeMode(m: Mode) { setStudioMode(m); setError(""); setTagsOpen(false); write(MODE_KEY, m); }
  // The other modes start a job through the same route and follow it in the takes list; they get back an error text, or null when it started.
  async function startKind(body: Record<string, unknown>): Promise<string | null> {
    const r = await startVoice({ ...body, projectId: readCurrentProject()?.id ?? null });
    if (!r.ok) return r.error;
    void reload();
    return null;
  }

  function choose(v: VoiceOption) {
    const c = { id: v.voiceId, name: v.name, facts: factsOf(v) };
    setVoice(c); if (provider) write(voiceKey(provider), JSON.stringify(c)); setPicking(false); setError("");
  }

  // The strip shows the chosen voice first even when it is not in the first page of the list.
  const stripVoices = useMemo(() => {
    const list = strip.voices ?? [];
    if (!voice || list.some((v) => v.voiceId === voice.id)) return list;
    return [{ voiceId: voice.id, name: voice.name } as VoiceOption, ...list];
  }, [strip.voices, voice]);

  return (
    <div className="vc">
      <h1 className="pg-title vc-title">Voice Studio</h1>

      <section className="vc-hero" aria-label="Stage">
        <Stage seed={stageSeed} mode={mode} progress={pos.d ? pos.t / pos.d : 0} />
        <div className="vc-now" aria-live="polite">
          {playingTake ? (<><b>{playingTake.voiceName ?? KIND_LABEL[playingTake.kind]}</b><span>{clock(pos.t * 1000)} / {clock((pos.d || (playingTake.durationMs ?? 0) / 1000) * 1000)}</span></>)
            : making ? (<><b>{making.kind === "stt" ? "Transcribing" : "Making your take"}</b><span>{clock(now - new Date(making.createdAt).getTime())}</span></>)
            : studioMode !== "speak" ? (<><b>{MODE_HERO[studioMode][0]}</b><span>{MODE_HERO[studioMode][1]}</span></>)
            : voice ? (<><b>{voice.name}</b>{voice.facts && <span>{voice.facts}</span>}</>)
            : !ready ? (<><b>{model?.label ?? "Voice Studio"}</b><span>{model ? `${model.providerLabel} is not connected yet` : "Loading models"}</span></>)
            : model?.voiceOptional ? (<><b>{model.label}</b><span>Describe the voice and the scene in the script, or pick a voice below.</span></>)
            : (<><b>Choose a voice</b><span>Pick one below, then write the script.</span></>)}
        </div>
      </section>

      {studioMode === "speak" && <section className="vc-voices" aria-label="Voices">
        <div className="vc-strip" role="listbox" aria-label="Voices">
          <button type="button" className="vc-chip-all" onClick={() => setPicking(true)} disabled={!model} aria-label="Search all voices"><span><Search size={20} /></span><small>All</small></button>
          <button type="button" className="vc-chip-all" onClick={() => setCreating(true)} disabled={!model} aria-label="Create a voice"><span><Plus size={20} /></span><small>New</small></button>
          {strip.voices === null && model ? Array.from({ length: 6 }, (_, i) => <span key={i} className="vc-chip-ghost" aria-hidden="true"><i /><small /></span>)
            : stripVoices.map((v) => (
              <button key={v.voiceId} type="button" role="option" aria-selected={voice?.id === v.voiceId} className={`vc-chip ${voice?.id === v.voiceId ? "is-on" : ""}`} onClick={() => choose(v)} title={factsOf(v) ?? v.name}>
                <span className="vc-orb" style={orbStyle(v.voiceId)} /><small>{v.name}</small>
              </button>
            ))}
        </div>
      </section>}

      <section className="vc-takes" aria-label="Takes">
        {takes.length === 0 ? (items === null ? null : <p className="vc-empty">Your takes appear here.</p>) : (
          <ul className="vc-list">
            {takes.map((t) => (
              <li key={t.id} className={`vc-take is-${t.status} ${playing === t.id ? "is-playing" : ""}`}>
                {t.status === "completed" && t.kind === "stt" ? <span className="vc-play is-doc" aria-hidden="true"><FileText size={16} /></span>
                  : t.status === "completed" ? <button type="button" className="vc-play" aria-label={playing === t.id ? "Pause" : "Play"} onClick={() => toggle(t)}>{playing === t.id ? <Pause size={16} /> : <Play size={16} />}</button>
                  : t.status === "pending" ? <span className="vc-play is-wait" aria-hidden="true"><Loader2 size={16} className="vc-spin" /></span>
                  : <span className="vc-play is-bad" aria-hidden="true"><AlertCircle size={16} /></span>}
                <div className="vc-take-body">
                  <p className="vc-take-text" title={t.text}>{t.text}</p>
                  {t.status === "failed" ? <p className="vc-take-err">{t.error ?? "This could not be made."}</p>
                    : <p className="vc-take-meta"><span className="vc-orb vc-orb-xs" style={orbStyle(t.voiceId ?? t.id)} aria-hidden="true" />{t.kind === "tts" ? t.voiceName ?? "Voice" : KIND_LABEL[t.kind]} · {t.modelLabel} · {t.status === "pending" ? "making…" : timeAgo(t.createdAt)}</p>}
                </div>
                <span className="vc-dur">{t.status === "completed" && t.durationMs ? clock(t.durationMs) : ""}</span>
                <span className="vc-take-actions">
                  {t.status === "completed" && t.kind !== "stt" && <a className="vc-icon" href={`/api/audio/${t.id}/file?download=1`} download aria-label="Download"><Download size={16} /></a>}
                  {t.status !== "pending" && <button type="button" className="vc-icon" aria-label="Delete" onClick={() => void remove(t.id)}><Trash2 size={16} /></button>}
                </span>
                {t.status === "completed" && t.kind === "stt" && t.transcript && <TranscriptView t={t.transcript} name={t.text} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="vc-console-wrap">
        {message && <p className="vc-error" role="alert">{message}</p>}
        <ModeTabs mode={studioMode} onMode={changeMode} />
        {studioMode === "transcribe" && <TranscribeConsole models={allModels?.filter((m) => m.kind === "stt") ?? []} onStart={startKind} setError={setError} />}
        {studioMode === "effects" && <EffectsConsole models={allModels?.filter((m) => m.kind === "sfx") ?? []} onStart={startKind} setError={setError} />}
        {studioMode === "music" && <MusicConsole models={allModels?.filter((m) => m.kind === "music") ?? []} onStart={startKind} setError={setError} />}
        {studioMode === "speak" && <div className={`vc-console ${over ? "is-over" : ""}`}>
          <label htmlFor="vc-text" className="sr-only">Script</label>
          <textarea id="vc-text" ref={box} rows={2} value={text} onChange={(e) => { setText(e.target.value); if (error) setError(""); }} placeholder={voice ? `Write what ${voice.name} should say…` : "Write the script…"}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }} />
          <div className="vc-controls">
            <label className="vc-pill vc-select" title="Voice model">
              <span className="sr-only">Voice model</span>
              <select aria-label="Voice model" value={model?.id ?? ""} disabled={!models?.length} onChange={(e) => { setModelId(e.target.value); write(MODEL_KEY, e.target.value); }}>
                {models?.length ? groups.map((g) => <optgroup key={g.label} label={g.label}>{g.items.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>) : <option value="">{models === null ? "Loading…" : "No models"}</option>}
              </select>
            </label>
            <div className={`vc-pill vc-stepper ${model?.supports.speed ? "" : "is-off"}`} role="group" aria-label="Speed" title={model?.supports.speed ? "Speaking speed" : `${model?.label ?? "This model"} has no speed control`}>
              <button type="button" aria-label="Slower" disabled={!model?.supports.speed || speed <= SPEEDS[0]} onClick={() => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)])}><Minus size={14} /></button>
              <output>{speed.toFixed(1)}x</output>
              <button type="button" aria-label="Faster" disabled={!model?.supports.speed || speed >= SPEEDS[SPEEDS.length - 1]} onClick={() => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)])}><Plus size={14} /></button>
            </div>
            <div className="vc-tagwrap">
              <button type="button" className={`vc-pill vc-tagbtn ${tagsOpen ? "is-open" : ""}`} aria-haspopup="menu" aria-expanded={tagsOpen} disabled={!model?.tags.length} title={model?.supports.emotionTags ? "Delivery tags" : `${model?.label ?? "This model"} does not read delivery tags`} onClick={() => setTagsOpen((o) => !o)}><Tag size={14} /> Delivery</button>
              {tagsOpen && (
                <div className="vc-tagmenu" role="menu" aria-label="Delivery tags">
                  {(model?.tags ?? []).map((t) => <button key={t} type="button" role="menuitem" onClick={() => insertTag(t)}>{t}</button>)}
                </div>
              )}
            </div>
            <span className="vc-count">{chars.toLocaleString("en-US")}{model ? `/${model.maxChars.toLocaleString("en-US")}` : ""}</span>
            <button type="button" className="vc-go" aria-label="Generate" disabled={!canGo} onClick={() => void generate()} title={price != null ? `About ${price} credits` : "Generate"}>
              {submitting ? <Loader2 size={18} className="vc-spin" /> : <ArrowUp size={20} />}
              {price != null && <span className="vc-cost"><Coins size={11} />{price}</span>}
            </button>
          </div>
          <span className="vc-soon"><SoonTag /></span>
        </div>}
      </div>

      {picking && <SheetPortal><VoicePicker voices={sheet.voices} error={model && !model.ready ? NOT_READY : sheet.ready ? sheet.error : NOT_READY} selected={voice?.id ?? null} onPick={choose} onSearch={sheet.search} onClose={() => setPicking(false)} onNew={() => { setPicking(false); setCreating(true); }} onDelete={removeOwn} /></SheetPortal>}
      {creating && models && <SheetPortal><VoiceCreator models={models} provider={provider} costs={costs} consentText={consentText} onClose={() => setCreating(false)} onCreated={created} /></SheetPortal>}
    </div>
  );
}
