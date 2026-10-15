"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, Plus, Search, Trash2, X } from "lucide-react";
import type { VoiceOption } from "@/lib/use-voice";
import { orbStyle } from "./look";

// The voice sheet: a search field and a grid of voice cards (orb, name, a short line of facts, a preview button). Voices come live from the provider.
export default function VoicePicker({ voices, error, selected, onPick, onSearch, onClose, onNew, onDelete }: { voices: VoiceOption[] | null; error: string; selected: string | null; onPick: (v: VoiceOption) => void; onSearch: (q: string) => void; onClose: () => void; onNew: () => void; onDelete: (v: VoiceOption) => Promise<string | null> }) {
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { const t = setTimeout(() => onSearch(q.trim()), 350); return () => clearTimeout(t); }, [q, onSearch]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  function preview(v: VoiceOption) {
    if (!v.previewUrl) return;
    if (playing === v.voiceId) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(v.previewUrl);
    audio.current = a;
    a.onended = () => setPlaying((p) => (p === v.voiceId ? null : p));
    a.onerror = () => setPlaying(null);
    setPlaying(v.voiceId);
    void a.play().catch(() => setPlaying(null));
  }

  return (
    <div className="vc-sheet-back" role="presentation" onClick={onClose}>
      <div className="vc-sheet" role="dialog" aria-modal="true" aria-label="Choose a voice" onClick={(e) => e.stopPropagation()}>
        <div className="vc-sheet-grab" aria-hidden="true" />
        <div className="vc-sheet-head">
          <h2>Voices</h2>
          <div className="vc-sheet-actions">
            <button type="button" className="vc-newbtn" onClick={onNew}><Plus size={15} /> New voice</button>
            <button type="button" className="vc-icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <label className="vc-search"><Search size={16} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, accent or style" aria-label="Search voices" /></label>
        <div className="vc-vgrid" role="listbox" aria-label="Voices">
          {voices === null ? <p className="vc-none"><Loader2 size={16} className="vc-spin" /> Loading voices…</p>
            : error ? <p className="vc-none" role="alert">{error}</p>
            : voices.length === 0 ? <p className="vc-none">No voices found.</p>
            : voices.map((v) => {
              const facts = [v.accent, v.gender, v.age, v.descriptive].filter(Boolean).join(" · ");
              const on = selected === v.voiceId;
              return (
                <div key={v.voiceId} role="option" aria-selected={on} className={`vc-vcard ${on ? "is-on" : ""} ${playing === v.voiceId ? "is-playing" : ""}`}>
                  <button type="button" className="vc-vpick" onClick={() => { audio.current?.pause(); onPick(v); }}>
                    <span className="vc-orb" style={orbStyle(v.voiceId)} aria-hidden="true" />
                    <span className="vc-vtext"><b>{v.name}</b>{facts && <small>{facts}</small>}</span>
                    {on && <Check size={16} className="vc-vcheck" />}
                  </button>
                  {v.own
                    ? <button type="button" className="vc-vplay vc-vdel" aria-label={`Delete ${v.name}`} onClick={() => { setConfirm(v.voiceId); setRemoveError(""); }}><Trash2 size={14} /></button>
                    : <button type="button" className="vc-vplay" aria-label={playing === v.voiceId ? `Stop ${v.name}` : `Hear ${v.name}`} disabled={!v.previewUrl} onClick={() => preview(v)}>{playing === v.voiceId ? <Pause size={14} /> : <Play size={14} />}</button>}
                  {confirm === v.voiceId && (
                    <div className="vc-vconfirm" role="group" aria-label={`Delete ${v.name}?`}>
                      <span>{removeError || "Delete this voice?"}</span>
                      <button type="button" className="is-danger" disabled={removing} onClick={async () => { setRemoving(true); const e = await onDelete(v); setRemoving(false); if (e) setRemoveError(e); else setConfirm(null); }}>{removing ? "Deleting…" : "Delete"}</button>
                      <button type="button" disabled={removing} onClick={() => setConfirm(null)}>Keep</button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
