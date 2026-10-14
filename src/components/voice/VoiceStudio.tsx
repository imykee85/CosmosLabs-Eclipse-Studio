"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUp, ChevronDown, Coins, Download, Loader2, Mic, Trash2 } from "lucide-react";
import PromptEdge, { type EdgeMessage } from "../create/PromptEdge";
import SoonTag from "../SoonTag";
import VoicePicker from "./VoicePicker";
import { useCredits } from "@/lib/use-credits";
import { readCurrentProject } from "@/lib/projects";
import { deleteVoice, startVoice, useVoiceJobs, useVoiceModels, useVoices, type VoiceOption } from "@/lib/use-voice";
import "../create/create.css";
import "./voice.css";

// Voice Studio (AUDIO): the same layout as Image Studio and Video Studio. A player above, a text box below with the model, the voice, the speed and (for models that
// have them) audio-tag buttons. EVERY control comes from the audio registry (src/lib/audio/registry.ts): one the chosen model cannot use is greyed, never hidden.
// A voice is a job that keeps running on the server; this page asks how it is going every couple of seconds.
const MODEL_KEY = "eclipse-voice-model";
const VOICE_KEY = "eclipse-voice-voice";
const DRAFT_KEY = "eclipse-draft-voice"; // cleared at sign-out with the other drafts
const SPEEDS = [0.7, 0.8, 0.9, 1, 1.1, 1.2];
const TAGS = ["whispers", "laughs", "sighs", "excited", "sarcastic", "crying"];
const clock = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

export default function VoiceStudio() {
  const { models, error: modelsError } = useVoiceModels();
  const { items, reload } = useVoiceJobs();
  const { reload: reloadCredits } = useCredits();
  const [modelId, setModelId] = useState<string | null>(null);
  const [voice, setVoice] = useState<{ id: string; name: string } | null>(null);
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLTextAreaElement>(null);
  const loaded = useRef(false);

  // What the person was doing comes back on the next visit (model, voice, text).
  useEffect(() => {
    setModelId(read(MODEL_KEY));
    try { const v = JSON.parse(read(VOICE_KEY) ?? "null"); if (v && typeof v.id === "string" && typeof v.name === "string") setVoice(v); } catch {}
    setText(read(DRAFT_KEY) ?? "");
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) write(DRAFT_KEY, text || null); }, [text]);

  const model = useMemo(() => models?.find((m) => m.id === modelId) ?? models?.[0] ?? null, [models, modelId]);
  const { voices, error: voicesError, search } = useVoices(picking ? model?.id ?? null : null);

  // A model that cannot do speed forgets it; a text over a new model's limit is kept (the counter turns red) so nothing the person typed is lost.
  useEffect(() => { if (model && !model.supports.speed && speed !== 1) setSpeed(1); }, [model, speed]);

  const active = items?.find((i) => i.id === activeId) ?? items?.find((i) => i.status === "pending") ?? items?.find((i) => i.status === "completed") ?? null;
  const pending = items?.some((i) => i.status === "pending") ?? false;
  useEffect(() => { if (!pending) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [pending]);
  const done = (items ?? []).filter((i) => i.status === "completed").slice(0, 5);

  const chars = text.trim().length;
  const over = model ? chars > model.maxChars : false;
  const price = model?.creditsPerChar != null && chars > 0 ? Math.max(1, Math.ceil(chars * model.creditsPerChar)) : null;
  const canGo = !!model && !!voice && chars > 0 && !over && !submitting;
  const edge: EdgeMessage = error ? { kind: "error", text: error } : modelsError && !models?.length ? { kind: "error", text: modelsError } : null;

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
    setActiveId(r.item.id);
    setText("");
    write(DRAFT_KEY, null);
    void reload();
  }

  // Credits change when a voice finishes: refresh the pill once it is done.
  const finishedOnce = useRef(new Set<string>());
  useEffect(() => { for (const i of items ?? []) if (i.status === "completed" && !finishedOnce.current.has(i.id)) { finishedOnce.current.add(i.id); if (finishedOnce.current.size > 1 || pending) reloadCredits(); } }, [items, pending, reloadCredits]);

  async function remove(id: string) {
    if (await deleteVoice(id)) { if (activeId === id) setActiveId(null); void reload(); } else setError("That voice could not be deleted. Please try again.");
  }

  function pickVoice(v: VoiceOption) { setVoice({ id: v.voiceId, name: v.name }); write(VOICE_KEY, JSON.stringify({ id: v.voiceId, name: v.name })); setPicking(false); setError(""); }

  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1 className="pg-title">Voice Studio</h1>
        <p>Write what the voice should say.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage vc-stage">
          {!active ? (
            <div className="cr-empty"><Mic size={34} strokeWidth={1.4} /><p>Your voice appears here</p></div>
          ) : active.status === "pending" ? (
            <div className="cr-empty" role="status" aria-live="polite"><Loader2 size={30} className="cr-spin" /><p>Making your voice… <b>{clock(now - new Date(active.createdAt).getTime())}</b></p></div>
          ) : active.status === "failed" ? (
            <div className="cr-empty" role="alert"><AlertCircle size={30} strokeWidth={1.5} /><p>{active.error ?? "This voice could not be made."}</p><button type="button" className="vc-link" onClick={() => void remove(active.id)}>Remove</button></div>
          ) : (
            <div className="vc-player">
              <p className="vc-text" title={active.text}>{active.text}</p>
              <audio key={active.id} src={active.url ?? undefined} controls preload="metadata" aria-label={`Voice: ${active.text.slice(0, 60)}`} />
              <div className="vc-meta"><span>{active.voiceName ?? "Voice"}</span><span>{active.modelLabel}</span>{active.durationMs ? <span>{clock(active.durationMs)}</span> : null}</div>
              <div className="vc-actions">
                <a className="cr-chip" href={`/api/audio/${active.id}/file?download=1`} download><Download size={14} /> Download</a>
                <button type="button" className="cr-chip" onClick={() => void remove(active.id)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          )}
        </div>
        {done.length > 0 && (
          <div className="cr-earlier" aria-label="Your five most recent voices">
            {done.map((g) => (
              <button key={g.id} type="button" className={active?.id === g.id ? "is-on" : ""} aria-pressed={active?.id === g.id} onClick={() => setActiveId(g.id)} title={g.text}>
                <span className="vc-chipicon"><Mic size={16} />{g.durationMs ? <small>{clock(g.durationMs)}</small> : null}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="cr-dock">
        <PromptEdge message={edge} />
        <form className="cr-box" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
          <label htmlFor="vc-text" className="sr-only">Write what the voice should say</label>
          <div className="cr-field">
            <textarea id="vc-text" ref={box} rows={3} value={text} onChange={(e) => { setText(e.target.value); if (error) setError(""); }} placeholder="Write what the voice should say…"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }} />
          </div>
          <div className="vc-counter" aria-live="polite"><span className={over ? "is-over" : ""}>{chars.toLocaleString("en-US")}{model ? ` / ${model.maxChars.toLocaleString("en-US")}` : ""}</span></div>
          <div className="cr-tools">
            <div className="cr-row cr-row-a">
              <label className="cr-chip cr-select" title="Voice model"><span className="sr-only">Voice model</span>
                <select value={model?.id ?? ""} disabled={!models?.length} aria-label="Voice model" onChange={(e) => { setModelId(e.target.value); write(MODEL_KEY, e.target.value); }}>
                  {models?.length ? models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>) : <option value="">{models === null ? "Loading…" : "None available"}</option>}
                </select>
              </label>
              <button type="button" className="cr-chip vc-voicebtn" aria-haspopup="dialog" disabled={!model} onClick={() => setPicking(true)}><Mic size={14} /><span>{voice?.name ?? "Choose a voice"}</span><ChevronDown size={14} /></button>
              <label className="cr-chip cr-select" title={model?.supports.speed ? "Speaking speed" : `${model?.label ?? "This model"} has no speed control`}><span className="sr-only">Speed</span>
                <select value={speed} disabled={!model?.supports.speed} aria-label="Speaking speed" onChange={(e) => setSpeed(Number(e.target.value))}>{SPEEDS.map((s) => <option key={s} value={s}>{s === 1 ? "Speed 1x" : `${s}x`}</option>)}</select>
              </label>
            </div>
            <div className="cr-row vc-tags" role="group" aria-label="Audio tags">
              {TAGS.map((t) => (
                <button key={t} type="button" className="cr-chip vc-tag" disabled={!model?.supports.emotionTags} title={model?.supports.emotionTags ? `Insert [${t}]` : `${model?.label ?? "This model"} does not read audio tags`} onClick={() => insertTag(t)}>[{t}]</button>
              ))}
            </div>
            <button type="submit" className="cr-go" disabled={!canGo}>
              {submitting ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate {price != null ? <span className="cr-cost" title={`About ${price} credits`}><Coins size={14} />{price}</span> : <ArrowUp size={16} />} <SoonTag /></>}
            </button>
          </div>
        </form>
      </div>

      {picking && <VoicePicker voices={voices} error={voicesError} selected={voice?.id ?? null} onPick={pickVoice} onSearch={search} onClose={() => setPicking(false)} />}
    </div>
  );
}
