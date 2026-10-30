"use client";

import GrowArea from "@/components/GrowArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Plus, Repeat, Square, Users } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import { estimateSeconds } from "@/lib/audio/pricing-client";
import { typeOfFile, uploadRecording, type VoiceModel } from "@/lib/use-voice";

import { fmtCredits } from "@/lib/credit-units";
// The three consoles that sit under the Speak console's place when the mode changes: Transcribe (a recording to text), Effects (a described sound) and Music (a described
// track). They look like the Speak console and use the same registry-driven rules: an option a model cannot use is greyed, a provider that is not connected says so when
// you press the button. The parent follows the job (the takes list); a console only collects the input and calls onStart, which returns an error text or null.
export type Mode = "speak" | "transcribe" | "effects" | "music";
export const MODES: { id: Mode; label: string }[] = [{ id: "speak", label: "Speak" }, { id: "transcribe", label: "Transcribe" }, { id: "effects", label: "Effects" }, { id: "music", label: "Music" }];
// Never mention keys or services to people (owner 2026-10-19): a model that is not switched on is simply "not available yet".
export const notReadyText = (label?: string) => `${label ? `${label} models are` : "This model is"} not available yet. Please choose another model.`;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export function ModeTabs({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className="vc-modes" role="tablist" aria-label="What to make">
      {MODES.map((m) => <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? "is-on" : ""} onClick={() => onMode(m.id)}>{m.label}</button>)}
    </div>
  );
}

type Props = { models: VoiceModel[]; onStart: (body: Record<string, unknown>) => Promise<string | null>; setError: (e: string) => void };

function useModel(models: VoiceModel[], key: string) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { setId(read(key)); }, [key]);
  const model = useMemo(() => models.find((m) => m.id === id) ?? models[0] ?? null, [models, id]);
  return { model, choose: (v: string) => { setId(v); write(key, v); } };
}

function ModelSelect({ models, model, onChange }: { models: VoiceModel[]; model: VoiceModel | null; onChange: (id: string) => void }) {
  const groups = useMemo(() => { const g = new Map<string, VoiceModel[]>(); for (const m of models) g.set(m.providerLabel, [...(g.get(m.providerLabel) ?? []), m]); return Array.from(g, ([label, items]) => ({ label, items })); }, [models]);
  return (
    <label className="vc-pill vc-select" title="Model">
      <span className="sr-only">Model</span>
      <select aria-label="Model" value={model?.id ?? ""} disabled={!models.length} onChange={(e) => onChange(e.target.value)}>
        {models.length ? groups.map((g) => <optgroup key={g.label} label={g.label}>{g.items.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>) : <option value="">No models</option>}
      </select>
    </label>
  );
}

const priceFor = (m: VoiceModel | null, secs: number) => (m?.pricing && m.pricing.unit === "sec" ? Math.max(1, Math.ceil(secs * m.pricing.perSec)) : null);

function Go({ label, busy, disabled, price, onClick }: { label: string; busy: boolean; disabled?: boolean; price: number | null; onClick: () => void }) {
  return (
    <button type="button" className="vc-go" aria-label={label} disabled={disabled || busy} onClick={onClick} title={price != null ? `About ${fmtCredits(price)} credits` : label}>
      {busy ? <Loader2 size={18} className="vc-spin" /> : null}
      <span>{label}</span>
      {price != null && <span className="vc-cost"><CoinIcon size={13} />{fmtCredits(price)}</span>}
    </button>
  );
}

const sizeOf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export function TranscribeConsole({ models, onStart, setError }: Props) {
  const { model, choose } = useModel(models, "eclipse-voice-model-stt");
  const [file, setFile] = useState<File | null>(null);
  const [diarize, setDiarize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const pick = useRef<HTMLInputElement>(null);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: ReturnType<typeof setInterval> } | null>(null);
  useEffect(() => () => { if (rec.current) { clearInterval(rec.current.timer); rec.current.stream.getTracks().forEach((t) => t.stop()); } }, []);
  useEffect(() => { if (model && !model.options.diarize && diarize) setDiarize(false); }, [model, diarize]);

  function choosePicked(f: File | null) {
    setError("");
    if (f && !typeOfFile(f)) { setFile(null); setError("That file type is not supported. Use MP3, WAV, M4A, OGG, FLAC, WebM, MP4 or MOV."); return; }
    setFile(f);
  }
  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (mr.mimeType || "audio/webm").split(";")[0];
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        setFile(new File([new Blob(chunks, { type })], `recording.${ext}`, { type }));
        setRecording(false);
      };
      const timer = setInterval(() => setSecs((s) => s + 1), 1000);
      setSecs(0); mr.start(); rec.current = { mr, stream, timer }; setRecording(true);
    } catch { setError("The microphone could not be used. Allow it in the browser's settings, or add a file instead."); }
  }
  function stopRecording() { if (rec.current) { clearInterval(rec.current.timer); rec.current.mr.stop(); rec.current = null; } }

  const price = file ? priceFor(model, estimateSeconds(file.size)) : null;
  async function go() {
    if (!model) return;
    if (!model.ready) { setError(notReadyText(model.providerLabel)); return; }
    if (!file) { setError("Add a recording first."); return; }
    if (model.options.maxInputBytes && file.size > model.options.maxInputBytes) { setError(`${model.label} takes recordings up to ${Math.round(model.options.maxInputBytes / 1048576)} MB (this one is ${sizeOf(file.size)}).`); return; }
    setBusy(true); setError(""); setProgress(0);
    const up = await uploadRecording(file, setProgress);
    if (!up.ok) { setBusy(false); setError(up.error); return; }
    const err = await onStart({ kind: "stt", model: model.id, inputKey: up.key, inputName: file.name, diarize });
    setBusy(false);
    if (err) setError(err); else setFile(null);
  }

  return (
    <div className="vc-console vc-console-tr">
      <div className="vc-drop">
        <input ref={pick} type="file" className="sr-only" aria-label="Recording" onChange={(e) => { choosePicked(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <button type="button" className="vc-dropbtn" onClick={() => pick.current?.click()} disabled={recording || busy}>
          <Plus size={16} />
          <span>{file ? `${file.name} · ${sizeOf(file.size)}` : "Add a recording"}</span>
        </button>
        {recording
          ? <button type="button" className="vc-pill vc-recbtn is-on" aria-label="Stop recording" onClick={stopRecording}><Square size={13} /> {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</button>
          : <button type="button" className="vc-pill vc-recbtn" aria-label="Record" onClick={() => void startRecording()} disabled={busy}><Mic size={14} /> Record</button>}
      </div>
      {busy && <div className="vc-progress" role="progressbar" aria-label="Uploading" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      <div className="vc-controls">
        <ModelSelect models={models} model={model} onChange={choose} />
        <button type="button" className={`vc-pill ${diarize ? "is-on" : ""}`} aria-pressed={diarize} disabled={!model?.options.diarize} title={model?.options.diarize ? "Tell speakers apart" : `${model?.label ?? "This model"} cannot tell speakers apart`} onClick={() => setDiarize((d) => !d)}><Users size={14} /> Speakers</button>
        <span className="vc-count">{file ? sizeOf(file.size) : ""}</span>
      </div>
      <Go label="Transcribe" busy={busy} disabled={!model} price={price} onClick={() => void go()} />
    </div>
  );
}

const SFX_LENGTHS = [1, 2, 3, 5, 8, 10, 15, 20, 30];
const SFX_LONG_LENGTHS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 60, 120, 300, 600]; // models that make sounds longer than 30 seconds (Mirelo)
const MUSIC_LENGTHS = [15, 30, 60, 90, 120, 180, 240, 300, 420, 600];
const lengthLabel = (s: number) => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

function DescribeConsole({ kind, models, onStart, setError }: Props & { kind: "sfx" | "music" }) {
  const music = kind === "music";
  const { model, choose } = useModel(models, `eclipse-voice-model-${kind}`);
  const [text, setText] = useState("");
  const [len, setLen] = useState<number | null>(music ? 60 : null);
  const [loop, setLoop] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [variants, setVariants] = useState(1);
  const [leaveOut, setLeaveOut] = useState("");
  const [format, setFormat] = useState("wav");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const lengths = useMemo(() => (music ? MUSIC_LENGTHS : (model?.options.maxSeconds ?? 30) > 30 ? SFX_LONG_LENGTHS : SFX_LENGTHS).filter((s) => s >= (model?.options.minSeconds ?? 0) && s <= (model?.options.maxSeconds ?? 9999)), [music, model]);
  useEffect(() => { if (len != null && lengths.length && !lengths.includes(len)) setLen(lengths.includes(60) ? 60 : lengths[lengths.length - 1]); }, [lengths, len]);
  // A model that needs a length (Mirelo) has no Auto: pick 5 seconds when none is set. Variants and format follow what the model offers.
  useEffect(() => { if (!music && model?.options.durationRequired && len == null) setLen(5); }, [music, model, len]);
  useEffect(() => { if (model && variants > (model.options.maxVariants ?? 1)) setVariants(1); if (model?.options.formats && !model.options.formats.includes(format)) setFormat(model.options.formats[0]); }, [model, variants, format]);
  useEffect(() => { if (model && !model.options.loop && loop) setLoop(false); if (model && !model.options.instrumental && instrumental) setInstrumental(false); }, [model, loop, instrumental]);

  const over = model ? text.length > model.maxChars : false;
  const price = text.trim() ? priceFor(model, (len ?? (music ? 60 : 30)) * (model?.options.maxVariants ? variants : 1)) : null;
  async function go() {
    if (!model) return;
    if (!model.ready) { setError(notReadyText(model.providerLabel)); return; }
    if (!text.trim()) { setError(music ? "Describe the music first." : "Describe the sound first."); return; }
    if (over) return;
    setBusy(true); setError("");
    const err = await onStart({ kind, model: model.id, text: text.trim(), durationSec: len ?? undefined, ...(music ? { instrumental } : { loop }),
      ...(model.options.maxVariants ? { variants, format, ...(leaveOut.trim() ? { negativePrompt: leaveOut.trim() } : {}) } : {}) });
    setBusy(false);
    if (err) setError(err); else setText("");
  }

  return (
    <div className={`vc-console ${over ? "is-over" : ""}`}>
      <label htmlFor={`vc-${kind}-text`} className="sr-only">{music ? "Describe the music" : "Describe the sound"}</label>
      <GrowArea id={`vc-${kind}-text`} ref={box} rows={2} value={text} onChange={(e) => { setText(e.target.value); setError(""); }}
        placeholder={music ? "Warm, slow piano with soft strings, for a quiet morning" : "Rain on a tin roof with distant thunder"}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void go(); } }} />
      {!music && model?.options.negativePrompt && (
        <input className="vc-leaveout" aria-label="Leave out (experimental)" value={leaveOut} maxLength={1000} onChange={(e) => setLeaveOut(e.target.value)} placeholder="Leave out (experimental): music, voices" />
      )}
      <div className="vc-controls">
        <ModelSelect models={models} model={model} onChange={choose} />
        <label className="vc-pill vc-select" title="Length">
          <span className="sr-only">Length</span>
          <select aria-label="Length" value={len ?? ""} onChange={(e) => setLen(e.target.value === "" ? null : Number(e.target.value))}>
            {!music && !model?.options.durationRequired && <option value="">Auto</option>}
            {lengths.map((s) => <option key={s} value={s}>{lengthLabel(s)}</option>)}
          </select>
        </label>
        {model?.options.maxVariants ? (
          <label className="vc-pill vc-select" title="Variants">
            <span className="sr-only">Variants</span>
            <select aria-label="Variants" value={variants} onChange={(e) => setVariants(Number(e.target.value))}>
              {Array.from({ length: model.options.maxVariants }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v} {v === 1 ? "variant" : "variants"}</option>)}
            </select>
          </label>
        ) : null}
        {model?.options.formats && model.options.formats.length > 1 ? (
          <label className="vc-pill vc-select" title="File format">
            <span className="sr-only">File format</span>
            <select aria-label="File format" value={format} onChange={(e) => setFormat(e.target.value)}>{model.options.formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}</select>
          </label>
        ) : null}
        {music
          ? <button type="button" className={`vc-pill ${instrumental ? "is-on" : ""}`} aria-pressed={instrumental} disabled={!model?.options.instrumental} onClick={() => setInstrumental((v) => !v)}>Instrumental</button>
          : <button type="button" className={`vc-pill ${loop ? "is-on" : ""}`} aria-pressed={loop} disabled={!model?.options.loop} title={model?.options.loop ? "A clip that loops cleanly" : `Not supported by ${model?.label ?? "this model"}`} onClick={() => setLoop((v) => !v)}><Repeat size={14} /> Loop</button>}
      </div>
      <span className="vc-count vc-count-corner">{text.length.toLocaleString("en-US")}{model ? `/${model.maxChars.toLocaleString("en-US")}` : ""}</span>
      <Go label={music ? "Make music" : "Make sound"} busy={busy} disabled={!model || over} price={price} onClick={() => void go()} />
    </div>
  );
}

export const EffectsConsole = (p: Props) => <DescribeConsole kind="sfx" {...p} />;
export const MusicConsole = (p: Props) => <DescribeConsole kind="music" {...p} />;
