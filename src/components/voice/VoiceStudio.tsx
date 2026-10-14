"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUp, ChevronRight, Coins, Download, Loader2, Pause, Play, Trash2 } from "lucide-react";
import SoonTag from "../SoonTag";
import VoicePicker from "./VoicePicker";
import { bars, clock, orbStyle } from "./look";
import { useCredits } from "@/lib/use-credits";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { deleteVoice, startVoice, useVoiceJobs, useVoiceModels, useVoices, type AudioItem, type VoiceOption } from "@/lib/use-voice";
import "./voice.css";

// Voice Studio (AUDIO). Its own layout, built around the script: a writing surface with delivery tags, the chosen voice as a card, the model and speed, and on the side
// (below on phones) the takes, each with its own waveform player. EVERY control comes from the audio registry (src/lib/audio/registry.ts): one the chosen model cannot
// use is greyed, never hidden. A take is a job that keeps running on the server; the list asks how it is going every couple of seconds.
const MODEL_KEY = "eclipse-voice-model";
const VOICE_KEY = "eclipse-voice-voice";
const DRAFT_KEY = "eclipse-draft-voice"; // cleared at sign-out with the other drafts
const TAGS = ["whispers", "laughs", "sighs", "excited", "sarcastic", "crying"];

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

function Wave({ seed, progress, live, onSeek }: { seed: string; progress: number; live?: boolean; onSeek?: (f: number) => void }) {
  const hs = useMemo(() => bars(seed), [seed]);
  return (
    <div className={`vc-wave ${live ? "is-live" : ""}`} aria-hidden={!onSeek} role={onSeek ? "slider" : undefined} aria-label={onSeek ? "Seek" : undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); } : undefined}
      onKeyDown={onSeek ? (e) => { if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.05)); if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.05)); } : undefined}>
      {hs.map((h, i) => <i key={i} style={{ height: `${h * 100}%`, animationDelay: live ? `${(i % 12) * 70}ms` : undefined }} className={!live && i / hs.length < progress ? "is-on" : ""} />)}
    </div>
  );
}

export default function VoiceStudio() {
  const { models, error: modelsError } = useVoiceModels();
  const { items, reload } = useVoiceJobs();
  const { reload: reloadCredits } = useCredits();
  const [modelId, setModelId] = useState<string | null>(null);
  const [voice, setVoice] = useState<{ id: string; name: string; facts?: string; previewUrl?: string } | null>(null);
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const box = useRef<HTMLTextAreaElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const loaded = useRef(false);

  // What the person was doing comes back on the next visit (model, voice, script).
  useEffect(() => {
    setModelId(read(MODEL_KEY));
    try { const v = JSON.parse(read(VOICE_KEY) ?? "null"); if (v && typeof v.id === "string" && typeof v.name === "string") setVoice(v); } catch {}
    setText(read(DRAFT_KEY) ?? "");
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) write(DRAFT_KEY, text || null); }, [text]);

  const model = useMemo(() => models?.find((m) => m.id === modelId) ?? models?.[0] ?? null, [models, modelId]);
  const { voices, error: voicesError, search } = useVoices(picking ? model?.id ?? null : null);
  useEffect(() => { if (model && !model.supports.speed && speed !== 1) setSpeed(1); }, [model, speed]);

  const pending = items?.some((i) => i.status === "pending") ?? false;
  useEffect(() => { if (!pending) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [pending]);

  // One player for every take: the waveform of the playing take fills in as it plays and can be tapped to jump.
  useEffect(() => {
    const a = new Audio();
    player.current = a;
    a.ontimeupdate = () => { const id = a.dataset.id; if (id && a.duration) setProgress((p) => ({ ...p, [id]: a.currentTime / a.duration })); };
    a.onended = () => { const id = a.dataset.id; setPlaying(null); if (id) setProgress((p) => ({ ...p, [id]: 0 })); };
    a.onpause = () => setPlaying((cur) => (a.ended ? null : cur === a.dataset.id && a.paused ? null : cur));
    return () => { a.pause(); player.current = null; };
  }, []);
  const toggle = useCallback((t: AudioItem, seekTo?: number) => {
    const a = player.current;
    if (!a || !t.url) return;
    if (a.dataset.id !== t.id) { a.pause(); a.src = t.url; a.dataset.id = t.id; }
    if (seekTo != null) {
      const go = () => { if (a.duration) a.currentTime = seekTo * a.duration; };
      if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
      if (!a.paused) return;
    } else if (!a.paused) { a.pause(); setPlaying(null); return; }
    setPlaying(t.id);
    void a.play().catch(() => setPlaying(null));
  }, []);

  const chars = text.trim().length;
  const over = model ? chars > model.maxChars : false;
  const price = model?.creditsPerChar != null && chars > 0 ? Math.max(1, Math.ceil(chars * model.creditsPerChar)) : null;
  const canGo = !!model && !!voice && chars > 0 && !over && !submitting;
  const message = error || (modelsError && !models?.length ? modelsError : "");
  const fill = model ? Math.min(1, chars / model.maxChars) : 0;

  const insertTag = useCallback((tag: string) => {
    const el = box.current;
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const t = `${a > 0 && !/\s/.test(text[a - 1]) ? " " : ""}[${tag}] `; // a space before it when it follows a word
    setText(text.slice(0, a) + t + text.slice(b));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + t.length, a + t.length); });
  }, [text]);

  async function generate() {
    if (!canGo || !model || !voice) return;
    setError("");
    setSubmitting(true);
    const r = await startVoice({ text: text.trim(), model: model.id, voiceId: voice.id, voiceName: voice.name, speed: model.supports.speed && speed !== 1 ? speed : undefined, projectId: readCurrentProject()?.id ?? null });
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    setText("");
    write(DRAFT_KEY, null);
    void reload();
  }

  // Credits change when a take finishes: refresh the balance in the header.
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

  function pickVoice(v: VoiceOption) {
    const chosen = { id: v.voiceId, name: v.name, facts: [v.accent, v.gender, v.age].filter(Boolean).join(" · ") || undefined, previewUrl: v.previewUrl };
    setVoice(chosen); write(VOICE_KEY, JSON.stringify(chosen)); setPicking(false); setError("");
  }

  const takes = items ?? [];

  return (
    <div className="vc">
      <header className="vc-head">
        <h1 className="pg-title">Voice Studio</h1>
      </header>

      <div className="vc-grid">
        <section className="vc-compose" aria-label="New take">
          <button type="button" className={`vc-voice ${voice ? "" : "is-empty"}`} aria-haspopup="dialog" disabled={!model} onClick={() => setPicking(true)}>
            {voice ? <span className="vc-orb vc-orb-lg" style={orbStyle(voice.id)} aria-hidden="true" /> : <span className="vc-orb vc-orb-lg vc-orb-ghost" aria-hidden="true" />}
            <span className="vc-voice-text">
              <small>Voice</small>
              <b>{voice?.name ?? "Choose a voice"}</b>
              {voice?.facts && <em>{voice.facts}</em>}
            </span>
            <ChevronRight size={18} className="vc-voice-go" />
          </button>

          <div className={`vc-editor ${over ? "is-over" : ""}`}>
            <label htmlFor="vc-text" className="sr-only">Script</label>
            <textarea id="vc-text" ref={box} value={text} onChange={(e) => { setText(e.target.value); if (error) setError(""); }} placeholder="Write the script…"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }} />
            <div className="vc-editor-foot">
              <div className="vc-tags" role="group" aria-label="Delivery tags">
                {TAGS.map((t) => (
                  <button key={t} type="button" className="vc-tag" disabled={!model?.supports.emotionTags} title={model?.supports.emotionTags ? `Insert [${t}]` : `${model?.label ?? "This model"} does not read delivery tags`} onClick={() => insertTag(t)}>[{t}]</button>
                ))}
              </div>
              <span className="vc-count" aria-live="polite"><i style={{ width: `${fill * 100}%` }} />{chars.toLocaleString("en-US")}{model ? ` / ${model.maxChars.toLocaleString("en-US")}` : ""}</span>
            </div>
          </div>

          <div className="vc-settings">
            <div className="vc-set">
              <span className="vc-set-label" id="vc-model-label">Model</span>
              <div className="vc-models" role="radiogroup" aria-labelledby="vc-model-label">
                {models === null ? <span className="vc-skel" /> : models.length === 0 ? <span className="vc-dim">None available</span> : models.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={model?.id === m.id} className={`vc-model ${model?.id === m.id ? "is-on" : ""}`} title={m.note ?? undefined} onClick={() => { setModelId(m.id); write(MODEL_KEY, m.id); }}>{m.label}</button>
                ))}
              </div>
            </div>
            <div className={`vc-set vc-speed ${model?.supports.speed ? "" : "is-off"}`} title={model?.supports.speed ? undefined : `${model?.label ?? "This model"} has no speed control`}>
              <label className="vc-set-label" htmlFor="vc-speed">Speed</label>
              <input id="vc-speed" type="range" min={0.7} max={1.2} step={0.05} value={speed} disabled={!model?.supports.speed} onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ ["--p" as string]: `${((speed - 0.7) / 0.5) * 100}%` }} />
              <output htmlFor="vc-speed">{speed.toFixed(2).replace(/0$/, "")}x</output>
            </div>
          </div>

          <div className="vc-go-bar">
            {message && <p className="vc-error" role="alert">{message}</p>}
            <button type="button" className="vc-go" disabled={!canGo} onClick={() => void generate()}>
              {submitting ? <><Loader2 size={17} className="vc-spin" /> Generating</> : <>Generate {price != null ? <span className="vc-cost" title={`About ${price} credits`}><Coins size={14} />{price}</span> : <ArrowUp size={17} />} <SoonTag /></>}
            </button>
          </div>
        </section>

        <section className="vc-takes" aria-label="Takes">
          <div className="vc-takes-head"><h2>Takes</h2>{takes.length > 0 && <span>{takes.length}</span>}</div>
          {items === null ? (
            <div className="vc-take is-ghost" aria-hidden="true"><span className="vc-orb" /><div className="vc-wave">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ height: "30%" }} />)}</div></div>
          ) : takes.length === 0 ? (
            <div className="vc-empty">
              <div className="vc-wave is-idle" aria-hidden="true">{bars("empty", 40).map((h, i) => <i key={i} style={{ height: `${h * 100}%` }} />)}</div>
              <p>Your takes appear here.</p>
            </div>
          ) : (
            <ul className="vc-list">
              {takes.map((t) => (
                <li key={t.id} className={`vc-take is-${t.status} ${playing === t.id ? "is-playing" : ""}`}>
                  <div className="vc-take-row">
                    {t.status === "completed" ? (
                      <button type="button" className="vc-play" aria-label={playing === t.id ? "Pause" : "Play"} onClick={() => toggle(t)}>{playing === t.id ? <Pause size={17} /> : <Play size={17} />}</button>
                    ) : t.status === "pending" ? (
                      <span className="vc-play is-wait" aria-hidden="true"><Loader2 size={17} className="vc-spin" /></span>
                    ) : (
                      <span className="vc-play is-bad" aria-hidden="true"><AlertCircle size={17} /></span>
                    )}
                    {t.status === "failed" ? <p className="vc-take-err" role="alert">{t.error ?? "This take could not be made."}</p>
                      : <Wave seed={t.id} live={t.status === "pending"} progress={progress[t.id] ?? 0} onSeek={t.status === "completed" ? (f) => toggle(t, f) : undefined} />}
                    <span className="vc-time">{t.status === "pending" ? clock(now - new Date(t.createdAt).getTime()) : t.durationMs ? clock(t.durationMs) : ""}</span>
                  </div>
                  <p className="vc-take-text" title={t.text}>{t.text}</p>
                  <div className="vc-take-meta">
                    <span className="vc-orb vc-orb-xs" style={orbStyle(t.voiceId ?? t.id)} aria-hidden="true" />
                    <span>{t.voiceName ?? "Voice"}</span><span>{t.modelLabel}</span><span>{timeAgo(t.createdAt)}</span>
                    <span className="vc-take-actions">
                      {t.status === "completed" && <a className="vc-icon" href={`/api/audio/${t.id}/file?download=1`} download aria-label="Download"><Download size={16} /></a>}
                      {t.status !== "pending" && <button type="button" className="vc-icon" aria-label="Delete" onClick={() => void remove(t.id)}><Trash2 size={16} /></button>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {picking && <VoicePicker voices={voices} error={voicesError} selected={voice?.id ?? null} onPick={pickVoice} onSearch={search} onClose={() => setPicking(false)} />}
    </div>
  );
}
