"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, Search, X } from "lucide-react";
import type { VoiceOption } from "@/lib/use-voice";

// The voice sheet: search, a short line about each voice (accent, gender, age...) and a preview button. Voices come live from the provider; none is hard-coded.
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
        <div className="vc-sheet-head">
          <label className="vc-search"><Search size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voices" aria-label="Search voices" autoFocus /></label>
          <button type="button" className="vc-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="vc-list" role="listbox" aria-label="Voices">
          {voices === null ? <p className="vc-none"><Loader2 size={16} className="cr-spin" /> Loading voices…</p>
            : error ? <p className="vc-none" role="alert">{error}</p>
            : voices.length === 0 ? <p className="vc-none">No voices found.</p>
            : voices.map((v) => {
              const facts = [v.accent, v.gender, v.age, v.descriptive, v.language].filter(Boolean).join(" · ");
              return (
                <div key={v.voiceId} role="option" aria-selected={selected === v.voiceId} className={`vc-row ${selected === v.voiceId ? "is-on" : ""}`}>
                  <button type="button" className="vc-play" aria-label={playing === v.voiceId ? `Stop ${v.name}` : `Hear ${v.name}`} disabled={!v.previewUrl} title={v.previewUrl ? undefined : "No preview for this voice"} onClick={() => preview(v)}>{playing === v.voiceId ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button type="button" className="vc-pick" onClick={() => { audio.current?.pause(); onPick(v); }}><b>{v.name}</b>{facts && <small>{facts}</small>}{selected === v.voiceId && <Check size={15} />}</button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
