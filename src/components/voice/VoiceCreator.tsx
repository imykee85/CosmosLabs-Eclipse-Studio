"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, Plus, X } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import { cloneVoiceRequest, designVoiceRequest, saveDesignRequest, type DesignPreview, type OwnVoice, type VoiceCosts, type VoiceModel } from "@/lib/use-voice";
import { orbStyle } from "./look";

import { fmtCredits } from "@/lib/credit-units";
// Make your own voice: CLONE one from a short recording of a voice you own (or have written permission to use), or DESIGN one from a description and pick the preview
// you like. Providers come from the model list; one that is not connected yet can be chosen and says so when you press the button.
type Mode = "clone" | "design";
const MAX_BYTES = 4_000_000;
const sizeOf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function VoiceCreator({ models, provider, costs, consentText, onClose, onCreated }: {
  models: VoiceModel[]; provider: string | null; costs: VoiceCosts; consentText: string; onClose: () => void; onCreated: (v: OwnVoice) => void;
}) {
  const [mode, setMode] = useState<Mode>("clone");
  const [prov, setProv] = useState(provider ?? "");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<DesignPreview[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; ready: boolean }>();
    for (const m of models) if ((mode === "clone" ? m.canClone : m.canDesign) && !seen.has(m.provider)) seen.set(m.provider, { id: m.provider, label: m.providerLabel, ready: models.some((x) => x.provider === m.provider && x.ready) });
    return Array.from(seen.values());
  }, [models, mode]);
  useEffect(() => { if (options.length && !options.some((o) => o.id === prov)) setProv(options[0].id); }, [options, prov]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const current = options.find((o) => o.id === prov);
  const cost = mode === "clone" ? costs.clone : costs.design;
  const notReady = current && !current.ready ? `${current.label} voices are not available yet.` : "";

  function switchMode(m: Mode) { audio.current?.pause(); setPlaying(null); setMode(m); setError(""); setPreviews(null); }
  function choose(f: File | null) {
    setError("");
    if (f && f.size > MAX_BYTES) { setFile(null); setError("That recording is too large. Use a clip under 4 MB (about a minute of MP3)."); return; }
    setFile(f);
  }
  function play(p: DesignPreview) {
    if (playing === p.token) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(p.url);
    audio.current = a;
    a.onended = () => setPlaying((x) => (x === p.token ? null : x));
    a.onerror = () => setPlaying(null);
    setPlaying(p.token);
    void a.play().catch(() => setPlaying(null));
  }

  async function createClone() {
    if (notReady) { setError(notReady); return; }
    if (name.trim().length < 2) { setError("Give the voice a name (at least 2 characters)."); return; }
    if (!file) { setError("Add a recording of the voice first."); return; }
    if (!consent) { setError("Confirm that you own this voice or have written permission to clone it."); return; }
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("provider", prov); fd.set("name", name.trim()); fd.set("consent", "1"); fd.set("file", file);
    const r = await cloneVoiceRequest(fd);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onCreated(r.voice);
  }
  async function makeDesign() {
    if (notReady) { setError(notReady); return; }
    if (desc.trim().length < 20) { setError("Describe the voice in at least 20 characters: age, tone, accent, pace."); return; }
    setBusy(true); setError(""); setPreviews(null);
    const r = await designVoiceRequest(prov, desc.trim());
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPreviews(r.previews);
  }
  async function keep(p: DesignPreview) {
    if (name.trim().length < 2) { setError("Name your voice first (at least 2 characters)."); return; }
    setBusy(true); setError("");
    const r = await saveDesignRequest({ provider: prov, token: p.token, sig: p.sig, name: name.trim(), description: desc.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onCreated(r.voice);
  }

  return (
    <div className="vc-sheet-back" role="presentation" onClick={onClose}>
      <div className="vc-sheet vc-new" role="dialog" aria-modal="true" aria-label="Create a voice" onClick={(e) => e.stopPropagation()}>
        <div className="vc-sheet-grab" aria-hidden="true" />
        <div className="vc-sheet-head">
          <h2>New voice</h2>
          <button type="button" className="vc-icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="vc-new-tabs" role="tablist" aria-label="How to make a voice">
          <button type="button" role="tab" aria-selected={mode === "clone"} className={mode === "clone" ? "is-on" : ""} onClick={() => switchMode("clone")}>Clone a voice</button>
          <button type="button" role="tab" aria-selected={mode === "design"} className={mode === "design" ? "is-on" : ""} onClick={() => switchMode("design")}>Design a voice</button>
        </div>

        <div className="vc-new-body">
          <label className="vc-new-field">
            <span>Provider</span>
            <select aria-label="Voice provider" value={prov} onChange={(e) => { setProv(e.target.value); setPreviews(null); setError(""); }}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="vc-new-field">
            <span>Name</span>
            <input aria-label="Voice name" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); if (error) setError(""); }} placeholder={mode === "clone" ? "For example: My voice" : "For example: Warm narrator"} />
          </label>

          {mode === "clone" ? (
            <>
              <div className="vc-new-field">
                <span>Recording</span>
                <input ref={pick} type="file" className="sr-only" aria-label="Voice recording" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
                <button type="button" className="vc-new-file" onClick={() => pick.current?.click()}>
                  <Plus size={16} />
                  <span>{file ? `${file.name} · ${sizeOf(file.size)}` : "Choose a recording"}</span>
                </button>
                <small>One person, clean and clear, 10 to 30 seconds. MP3, WAV or M4A, under 4 MB. The recording is not kept.</small>
              </div>
              <label className="vc-new-consent">
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (error) setError(""); }} />
                <span>{consentText}</span>
              </label>
            </>
          ) : (
            <>
              <label className="vc-new-field">
                <span>Description</span>
                <textarea aria-label="Describe the voice" rows={3} value={desc} maxLength={1000} onChange={(e) => { setDesc(e.target.value); if (error) setError(""); }} placeholder="A warm, calm woman in her 40s with a soft British accent, speaking slowly" />
                <small>{desc.trim().length < 20 ? `${20 - desc.trim().length} more characters` : "Age, tone, accent and pace work best."}</small>
              </label>
              {previews && (
                <ul className="vc-new-previews" aria-label="Voice previews">
                  {previews.map((p, i) => (
                    <li key={p.token}>
                      <span className="vc-orb" style={orbStyle(p.token)} aria-hidden="true" />
                      <button type="button" className="vc-vplay vc-new-play" aria-label={playing === p.token ? `Stop preview ${i + 1}` : `Play preview ${i + 1}`} onClick={() => play(p)}>{playing === p.token ? <Pause size={14} /> : <Play size={14} />}</button>
                      <b>Preview {i + 1}</b>
                      <button type="button" className="vc-pill" disabled={busy} onClick={() => void keep(p)}>Save voice</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {(error || notReady) && <p className="vc-error vc-new-error" role="alert">{error || notReady}</p>}
        <div className="vc-new-foot">
          <button type="button" className="vc-new-go" disabled={busy} onClick={() => void (mode === "clone" ? createClone() : makeDesign())}>
            {busy ? <Loader2 size={16} className="vc-spin" /> : null}
            {mode === "clone" ? "Create voice" : previews ? "Design again" : "Design voice"}
            {cost != null && <span className="vc-cost"><CoinIcon size={11} />{fmtCredits(cost)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
