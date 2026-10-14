"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, Search, X } from "lucide-react";
import type { VoiceOption } from "@/lib/use-voice";
import { orbStyle } from "./look";

// The voice sheet: a search field and a grid of voice cards (orb, name, a short line of facts, a preview button). Voices come live from the provider.
export default function VoicePicker({ voices, error, selected, onPick, onSearch, onClose }: { voices: VoiceOption[] | null; error: string; selected: string | null; onPick: (v: VoiceOption) => void; onSearch: (q: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
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
          <button type="button" className="vc-icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
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
                  <button type="button" className="vc-vplay" aria-label={playing === v.voiceId ? `Stop ${v.name}` : `Hear ${v.name}`} disabled={!v.previewUrl} onClick={() => preview(v)}>{playing === v.voiceId ? <Pause size={14} /> : <Play size={14} />}</button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
