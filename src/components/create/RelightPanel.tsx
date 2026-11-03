"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Plus, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import ThreeLight from "./ThreeLight";
import { COLORS, DEFAULT_LIGHT, ELEV_MAX, ELEV_MIN, FEATURE_NAME, INTENSITY_MAX, MAX_LIGHTS, QUICK, clean, type Light } from "@/lib/relight/prompt";

export type RelightRun = { lights: Light[]; note: string; tier: string; count: number };

/** Relight: place up to three lights round the picture, choose their colour and strength, and make the picture again lit that way. */
export default function RelightPanel({ thumb, tiers, busy, error, onRun, onClose }: { thumb: string; tiers: string[]; busy: boolean; error: string; onRun: (run: RelightRun) => void; onClose: () => void }) {
  const [lights, setLights] = useState<Light[]>([DEFAULT_LIGHT]);
  const [sel, setSel] = useState(0);
  const [note, setNote] = useState("");
  const [tier, setTier] = useState(tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k");
  const [count, setCount] = useState(1);
  const [flat, setFlat] = useState(false);
  const light = lights[sel] ?? lights[0];

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const change = (patch: Partial<Light>) => setLights((l) => l.map((x, i) => (i === sel ? clean({ ...x, ...patch }) : x)));
  const add = () => setLights((l) => { if (l.length >= MAX_LIGHTS) return l; setSel(l.length); return [...l, clean({ ...DEFAULT_LIGHT, rotate: 90 * l.length })]; });
  const remove = (i: number) => setLights((l) => { if (l.length < 2) return l; setSel(0); return l.filter((_, k) => k !== i); });
  const isCustom = !COLORS.some((c) => c.hex === light.color);

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-cam cr-light" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="cr-var-thumb" />
          <div><h2>{FEATURE_NAME}</h2><p>The same picture, lit from somewhere else</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-cam-stage">
          {!flat && <ThreeLight thumb={thumb} lights={lights} sel={sel} onSelect={setSel} onMove={(i, p) => setLights((l) => l.map((x, k) => (k === i ? clean({ ...x, ...p }) : x)))} onFail={() => setFlat(true)} />}
          {flat && <div className="cr-light-flat">The 3D preview isn&apos;t available on this device. Use the controls below.</div>}
        </div>

        <div className="cr-cam-chips" role="group" aria-label="Quick select">
          {QUICK.map((q) => <button key={q.id} type="button" onClick={() => change(q.patch(light))}>{q.label}</button>)}
        </div>

        <div className="cr-light-row">
          <div className="cr-light-tabs" role="tablist" aria-label="Lights">
            {lights.map((l, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === sel} className={i === sel ? "is-on" : ""} onClick={() => setSel(i)}>
                {i + 1}<i style={{ background: l.color }} />
              </button>
            ))}
            {lights.length < MAX_LIGHTS && <button type="button" onClick={add} aria-label="Add a light"><Plus size={14} /></button>}
            {lights.length > 1 && <button type="button" onClick={() => remove(sel)} aria-label="Remove this light"><X size={14} /></button>}
          </div>
          <div className="cr-light-colors" role="group" aria-label="Light colour">
            {COLORS.map((c) => <button key={c.id} type="button" className={light.color === c.hex ? "is-on" : ""} style={{ background: c.hex }} aria-label={c.label} onClick={() => change({ color: c.hex })} />)}
            <label className={`cr-light-custom${isCustom ? " is-on" : ""}`} aria-label="Custom colour"><input type="color" value={light.color} onChange={(e) => change({ color: e.target.value })} /></label>
          </div>
        </div>

        <div className="cr-cam-slider"><label htmlFor="cr-l-r">Rotate</label><input id="cr-l-r" type="range" min={0} max={359} value={light.rotate} onChange={(e) => change({ rotate: Number(e.target.value) })} /><output>{light.rotate}°</output></div>
        <div className="cr-cam-slider"><label htmlFor="cr-l-e">Elevation</label><input id="cr-l-e" type="range" min={ELEV_MIN} max={ELEV_MAX} value={light.elevation} onChange={(e) => change({ elevation: Number(e.target.value) })} /><output>{light.elevation}°</output></div>
        <div className="cr-cam-slider"><label htmlFor="cr-l-i">Intensity</label><input id="cr-l-i" type="range" min={0} max={INTENSITY_MAX} value={light.intensity} onChange={(e) => change({ intensity: Number(e.target.value) })} /><output>{light.intensity}</output></div>

        <div className="cr-light-opts">
          <label>Quality<select value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
          <label>Images<select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>x{n}</option>)}</select></label>
        </div>

        <GrowArea className="cr-var-text" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional), for example: soft shadows" />
        {error && <div className="cr-var-err">{error}</div>}
        <div className="cr-cam-actions">
          <button type="button" className="cr-var-go" onClick={() => onRun({ lights, note, tier, count })} disabled={busy}>
            {busy ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
