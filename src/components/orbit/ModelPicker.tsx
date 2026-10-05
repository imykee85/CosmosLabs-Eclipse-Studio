"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, Gauge, Scale, Zap } from "lucide-react";
import { MODEL_KEY, orbitModels, type OrbitModel } from "@/lib/orbit-models";

const ICONS: Record<OrbitModel["icon"], React.ReactNode> = {
  auto: <Gauge size={20} />, deep: <Brain size={20} />, balanced: <Scale size={20} />, fast: <Zap size={20} />,
};

// The model chip in the message box. Opens a bottom sheet on phones and a small popup on desktop.
export default function ModelPicker() {
  const [id, setId] = useState(orbitModels[0].id);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = orbitModels.find((m) => m.id === id) ?? orbitModels[0];

  useEffect(() => {
    try { const s = localStorage.getItem(MODEL_KEY); if (s && orbitModels.some((m) => m.id === s)) setId(s); } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  function choose(m: OrbitModel) {
    setId(m.id);
    setOpen(false);
    try { localStorage.setItem(MODEL_KEY, m.id); } catch {}
  }

  return (
    <div className="or-model" ref={root}>
      <button type="button" className="or-agent" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{current.name}</span><ChevronDown size={15} className={open ? "is-up" : ""} />
      </button>
      {open && (
        <>
          <div className="or-sheet-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="or-sheet" role="listbox" aria-label="Choose a model">
            <span className="or-grab" aria-hidden="true" />
            {orbitModels.map((m) => (
              <button key={m.id} type="button" role="option" aria-selected={m.id === id} className={`or-opt ${m.id === id ? "is-on" : ""}`} onClick={() => choose(m)}>
                <span className="or-opt-icon">{ICONS[m.icon]}</span>
                <span className="or-opt-text"><b>{m.name}{m.tag && <em>{m.tag}</em>}</b><small>{m.blurb}</small></span>
                {m.id === id && <Check size={18} className="or-opt-check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
