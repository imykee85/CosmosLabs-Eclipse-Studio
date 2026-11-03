"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Lock, Maximize2, Plus, RotateCcw, Unlock, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import ThreeCamera from "./ThreeCamera";
import Bar from "./Bar";
import { DEFAULT_CAM, FEATURE_NAME, MAX_CAMERAS, PRESETS, VERTICAL_MAX, VERTICAL_MIN, ZOOMS, cleanCam, moveCams, startCams, type Cam, type ZoomId } from "@/lib/camera/prompt";

export type CameraRun = { cams: Cam[]; note: string; tier: string };
const ZOOM_SCALE: Record<ZoomId, number> = { initial: 1, medium: 1.25, medium_close: 1.5, closer: 1.9, far: 0.7 };

/** Change Camera: place up to four cameras round the picture and make the same picture from each. Laid out like Relight so the two panels feel the same. */
export default function CameraPanel({ thumb, tiers, busy, error, onRun, onClose }: { thumb: string; tiers: string[]; busy: boolean; error: string; onRun: (run: CameraRun) => void; onClose: () => void }) {
  const [cams, setCams] = useState<Cam[]>(() => startCams(1));
  const [sel, setSel] = useState(0);
  const [locked, setLocked] = useState(false); // each camera moves on its own unless "Move together" is on
  const [note, setNote] = useState("");
  const [tier, setTier] = useState(tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k");
  const [flat, setFlat] = useState(false); // true when the 3D scene cannot run (no WebGL)
  const cam = cams[sel] ?? cams[0] ?? DEFAULT_CAM;
  const changed = cams.length > 1 || JSON.stringify(cams[0]) !== JSON.stringify(startCams(1)[0]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const change = (patch: Partial<Cam>) => setCams((l) => moveCams(l, Math.min(sel, l.length - 1), cleanCam({ ...(l[sel] ?? DEFAULT_CAM), ...patch }), locked));
  // adding a camera keeps the ones already placed, puts the new one on the opposite side and selects it, so the controls move it
  const add = () => setCams((l) => {
    if (l.length >= MAX_CAMERAS) return l;
    const last = l[l.length - 1] ?? DEFAULT_CAM;
    setSel(l.length);
    return [...l, cleanCam({ ...last, rotate: last.rotate + 180 })];
  });
  const remove = (i: number) => setCams((l) => { if (l.length < 2) return l; setSel(0); return l.filter((_, k) => k !== i); });
  const reset = () => { setCams(startCams(1)); setSel(0); };
  const zi = Math.max(0, ZOOMS.findIndex((z) => z.id === cam.zoom));

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-cam cr-light" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="cr-var-thumb" />
          <div><h2>{FEATURE_NAME}</h2><p>The same picture from a new camera position</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-light-label">Camera preview</div>
        <div className="cr-cam-stage">
          {changed && <button type="button" className="cr-light-reset" onClick={reset} aria-label="Reset the cameras"><RotateCcw size={14} /></button>}
          {!flat && <ThreeCamera thumb={thumb} cams={cams} sel={sel} onSelect={setSel} onMove={(i, patch) => setCams((l) => moveCams(l, i, cleanCam({ ...l[i], ...patch }), locked))} onFail={() => setFlat(true)} />}
          {flat && <div className="cr-light-flat">The 3D preview isn&apos;t available on this device. Use the controls below.</div>}
          <div className="cr-cam-inset" aria-label="Preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" style={{ transform: `perspective(180px) rotateY(${-Math.round(cam.rotate > 180 ? cam.rotate - 360 : cam.rotate)}deg) rotateX(${Math.round(cam.vertical * 0.5)}deg) scale(${ZOOM_SCALE[cam.zoom]})` }} />
            <span>Preview</span>
          </div>
        </div>

        <div className="cr-light-label">Quick select</div>
        <div className="cr-light-quick is-seven" role="group" aria-label="Quick select">
          {PRESETS.map((p) => {
            const on = Object.entries(p.patch).every(([k, v]) => cam[k as keyof Cam] === v);
            return <button key={p.id} type="button" className={on ? "is-on" : ""} onClick={() => change(p.patch)}>{p.label}</button>;
          })}
        </div>

        <div className="cr-light-label">Camera settings</div>
        <div className="cr-light-row">
          <div className="cr-light-tabs" role="tablist" aria-label="Cameras">
            {cams.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === sel} className={i === sel ? "is-on" : ""} onClick={() => setSel(i)}>{i + 1}</button>
            ))}
            {cams.length < MAX_CAMERAS && <button type="button" onClick={add} aria-label="Add a camera"><Plus size={14} /></button>}
            {cams.length > 1 && <button type="button" onClick={() => remove(sel)} aria-label="Remove this camera"><X size={14} /></button>}
          </div>
          {cams.length > 1 && (
            <button type="button" className={`cr-cam-together${locked ? " is-on" : ""}`} aria-pressed={locked} onClick={() => setLocked((v) => !v)}>{locked ? <Lock size={13} /> : <Unlock size={13} />} Move together</button>
          )}
        </div>

        <Bar id="cr-cam-r" label="Rotate" min={0} max={359} value={cam.rotate} unit="°" onChange={(v) => change({ rotate: v })} />
        <Bar id="cr-cam-v" label="Vertical" min={VERTICAL_MIN} max={VERTICAL_MAX} value={cam.vertical} unit="°" onChange={(v) => change({ vertical: v })} />
        <Bar id="cr-cam-z" label="Zoom" min={0} max={ZOOMS.length - 1} value={zi} text={ZOOMS[zi].label} onChange={(v) => change({ zoom: ZOOMS[Math.round(v)].id })} />

        <div className="cr-light-opts">
          <label className="cr-light-chip" aria-label="Quality"><Maximize2 size={14} /><select value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
        </div>

        <GrowArea className="cr-var-text" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional), for example: keep the sunglasses on" />
        {error && <div className="cr-var-err">{error}</div>}
        <div className="cr-cam-actions">
          <button type="button" className="cr-var-go" onClick={() => onRun({ cams, note, tier })} disabled={busy}>
            {busy ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate{cams.length > 1 ? ` ${cams.length}` : ""} <ArrowUp size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
