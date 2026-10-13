"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { ModelIcon } from "../create/ModelPicker";
import SoonTag from "../SoonTag";
import { VIDEO_MODELS, isLive, type VideoModel } from "@/lib/video-models";

// The video model sheet, the same design as Image Studio's (`ModelPicker`, `mp-` styles from create.css): a search box, Popular (the models that
// work today) and All models by maker. Models not connected yet are listed with the Soon tag; choosing one still selects it so the controls show its
// settings greyed, but Generate says it is not connected.
const range = (m: VideoModel) => `${m.durations[0]} to ${m.durations[m.durations.length - 1]} s${m.qualities.length ? ` · ${m.qualities[0]} to ${m.qualities[m.qualities.length - 1]}` : ""}${m.sound === "toggle" ? " · sound" : ""}`;

export default function VideoModelPicker({ value, onPick, onClose }: { value: string; onPick: (m: VideoModel) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const popular = useMemo(() => VIDEO_MODELS.filter(isLive), []);
  const makers = useMemo(() => [...new Set(VIDEO_MODELS.map((m) => m.maker))], []);
  const term = q.trim().toLowerCase();
  const found = term ? VIDEO_MODELS.filter((m) => `${m.label} ${m.maker} ${m.blurb}`.toLowerCase().includes(term)) : [];

  const row = (m: VideoModel) => (
    <button key={m.id} type="button" className={`mp-row ${value === m.id ? "is-on" : ""} ${isLive(m) ? "" : "mp-soon"}`} aria-pressed={value === m.id} onClick={() => onPick(m)}>
      <ModelIcon name={m.maker} />
      <span className="mp-name">{m.label}<small>{m.blurb} {range(m)}</small></span>
      {!isLive(m) && <SoonTag className="mp-tag" />}
      {value === m.id && <Check size={16} />}
    </button>
  );

  return (
    <div className="mp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-sheet" role="dialog" aria-modal="true" aria-label="Video model">
        <header className="mp-head"><h2>Model</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        <label className="mp-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search video models" /></label>
        <div className="mp-body">
          {term ? (
            <>
              {found.map(row)}
              {!found.length && <p className="mp-none">No model matches &ldquo;{q}&rdquo;.</p>}
            </>
          ) : (
            <>
              <h3>Popular</h3>
              {popular.map(row)}
              <h3>All models</h3>
              {makers.map((mk) => {
                const list = VIDEO_MODELS.filter((m) => m.maker === mk);
                return (
                  <div key={mk} className="mp-group">
                    <button type="button" className="mp-gh" aria-expanded={open === mk} onClick={() => setOpen(open === mk ? null : mk)}>
                      <ModelIcon name={mk} /><span>{mk}</span><em>{list.length} {list.length === 1 ? "model" : "models"}</em><ChevronDown size={16} className={open === mk ? "is-up" : ""} />
                    </button>
                    {open === mk && <div className="mp-list">{list.map(row)}</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
