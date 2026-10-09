"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Gauge } from "lucide-react";
import { MODEL_KEY, connectModels, type ConnectModel } from "@/lib/connect-models";

// Neutral tile: the vendor's first letter (no logos), a gauge for Auto.
const tile = (m: ConnectModel) => (m.id === "auto" ? <Gauge size={20} /> : <span className="cn-mono">{m.vendor.slice(0, 1).toUpperCase()}</span>);

function Row({ m, on, pick }: { m: ConnectModel; on: boolean; pick: (m: ConnectModel) => void }) {
  return (
    <button type="button" role="option" aria-selected={on} className={`cn-opt ${on ? "is-on" : ""}`} onClick={() => pick(m)}>
      <span className="cn-opt-icon">{tile(m)}</span>
      <span className="cn-opt-text"><b>{m.name}{m.tag && <em className={m.tag === "Recommended" ? "" : "is-new"}>{m.tag}</em>}</b>{m.blurb && <small>{m.blurb}</small>}</span>
      {on && <Check size={18} className="cn-opt-check" />}
    </button>
  );
}

// The model chip in the message box. Opens a bottom sheet on phones and a small popup on desktop.
export default function ModelPicker() {
  const [id, setId] = useState(connectModels[0].id);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = connectModels.find((m) => m.id === id) ?? connectModels[0];

  useEffect(() => {
    try { const s = localStorage.getItem(MODEL_KEY); if (s && connectModels.some((m) => m.id === s)) setId(s); } catch {}
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

  function choose(m: ConnectModel) {
    setId(m.id);
    setOpen(false);
    try { localStorage.setItem(MODEL_KEY, m.id); } catch {}
  }

  return (
    <div className="cn-model" ref={root}>
      <button type="button" className="cn-agent" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{current.name}</span><ChevronDown size={15} className={open ? "is-up" : ""} />
      </button>
      {open && (
        <>
          <div className="cn-sheet-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="cn-sheet" role="listbox" aria-label="Choose a model">
            <span className="cn-grab" aria-hidden="true" />
            {connectModels.filter((m) => m.featured).map((m) => <Row key={m.id} m={m} on={m.id === id} pick={choose} />)}
            {connectModels.some((m) => !m.featured) && <p className="cn-group">All models</p>}
            {connectModels.filter((m) => !m.featured).map((m) => <Row key={m.id} m={m} on={m.id === id} pick={choose} />)}
          </div>
        </>
      )}
    </div>
  );
}
