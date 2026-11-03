"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import GenerateButton from "@/components/GenerateButton";
import Bar from "./Bar";
import { DEFAULT_SKIN, FEATURE_NAME, PRESETS, VERSIONS, clean, type SkinSettings } from "@/lib/skin/prompt";

export type SkinRun = { settings: SkinSettings; note: string; tier: string };

/** Skin Enhancer: pick a version and a few sliders, press Enhance, and the same portrait comes back with natural skin. Laid out like Relight and Change Camera. */
export default function SkinPanel({ thumb, tiers, unit, freeLeft, busy, error, onRun, onClose }: { thumb: string; tiers: string[]; unit: (tier: string) => number | null; freeLeft: number; busy: boolean; error: string; onRun: (run: SkinRun) => void; onClose: () => void }) {
  const [s, setS] = useState<SkinSettings>(DEFAULT_SKIN);
  const [note, setNote] = useState("");
  const [tier, setTier] = useState(tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k");

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const set = (patch: Partial<SkinSettings>) => setS((x) => clean({ ...x, ...patch }));

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-cam cr-light cr-skin" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="cr-var-thumb" />
          <div><h2>{FEATURE_NAME}</h2><p>Natural, realistic skin on the same portrait</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-light-label">Preview</div>
        <div className="cr-cam-stage">
          <div className="cr-cam-3d cr-skin-pic">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="Your picture" />
          </div>
        </div>

        <div className="cr-light-label">Version</div>
        <div className="cr-light-quick is-three" role="group" aria-label="Version">
          {VERSIONS.map((v) => <button key={v.id} type="button" title={v.blurb} className={s.version === v.id ? "is-on" : ""} onClick={() => set({ version: v.id })}>{v.label}</button>)}
        </div>

        {s.version === "flexible" && (
          <>
            <div className="cr-light-label">Optimized for</div>
            <div className="cr-light-quick is-three" role="group" aria-label="Optimized for">
              {PRESETS.map((p) => <button key={p.id} type="button" className={s.preset === p.id ? "is-on" : ""} onClick={() => set({ preset: p.id })}>{p.label}</button>)}
            </div>
          </>
        )}

        <div className="cr-light-label">Settings</div>
        {s.version === "faithful" && <Bar id="cr-sk-d" label="Skin detail" min={0} max={100} value={s.detail} unit="%" onChange={(v) => set({ detail: v })} />}
        <Bar id="cr-sk-s" label="Sharpen" min={0} max={100} value={s.sharpen} unit="%" onChange={(v) => set({ sharpen: v })} />
        <Bar id="cr-sk-g" label="Smart grain" min={0} max={100} value={s.grain} unit="%" onChange={(v) => set({ grain: v })} />

        <div className="cr-light-opts">
          <label className="cr-light-chip" aria-label="Quality"><Maximize2 size={14} /><select value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
        </div>

        <GrowArea className="cr-var-text" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional), for example: keep the freckles" />
        {error && <div className="cr-var-err">{error}</div>}
        <div className="cr-cam-actions">
          <GenerateButton wide label="Enhance" busyLabel="Enhancing" price={unit(tier)} free={freeLeft >= 1 && unit(tier) != null} busy={busy} onClick={() => onRun({ settings: s, note, tier })} />
        </div>
      </div>
    </div>
  );
}
