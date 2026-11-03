"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Lock, RotateCcw, Unlock, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import { DEFAULT_CAM, FEATURE_NAME, MAX_CAMERAS, VERTICAL_MAX, VERTICAL_MIN, ZOOMS, cleanCam, moveCams, startCams, wrap360, type Cam, type ZoomId } from "@/lib/camera/prompt";

export type CameraRun = { cams: Cam[]; note: string };

// the drawing: a ring round the picture for rotation and an arc at the side for height, seen in perspective
const W = 300, H = 230, CX = 138, CY = 138, RX = 100, RY = 34, AX = 262, AR = 92;
const rad = (d: number) => (d * Math.PI) / 180;
const ringPoint = (rotate: number) => ({ x: CX - RX * Math.sin(rad(rotate)), y: CY + RY * Math.cos(rad(rotate)) });
const arcPoint = (v: number) => ({ x: AX + 16 * Math.cos(rad(v)), y: CY - AR * Math.sin(rad(v)) });
const ZOOM_SCALE: Record<ZoomId, number> = { initial: 1, medium: 1.25, medium_close: 1.5, closer: 1.9, far: 0.7 };

/** Change Camera: set where the camera stands (drag the handles or use the sliders) and make the same picture from there. */
export default function CameraPanel({ thumb, busy, error, onRun, onClose }: { thumb: string; busy: boolean; error: string; onRun: (run: CameraRun) => void; onClose: () => void }) {
  const [count, setCount] = useState(1);
  const [cams, setCams] = useState<Cam[]>(() => startCams(1));
  const [sel, setSel] = useState(0);
  const [locked, setLocked] = useState(true);
  const [note, setNote] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "ring" | "arc"; index: number } | null>(null);
  const cam = cams[sel] ?? DEFAULT_CAM;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  function setCount2(n: number) {
    setCount(n);
    setSel(0);
    setCams(startCams(n, cams[0] ?? DEFAULT_CAM));
  }
  const change = (patch: Partial<Cam>) => setCams((l) => moveCams(l, Math.min(sel, l.length - 1), cleanCam({ ...(l[sel] ?? DEFAULT_CAM), ...patch }), locked));
  const reset = () => { setCams(startCams(count)); setSel(0); };

  function point(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  function down(e: React.PointerEvent, kind: "ring" | "arc", index: number) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind, index };
    setSel(index);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.kind === "ring") {
      const rotate = wrap360((Math.atan2(-(p.x - CX) / RX, (p.y - CY) / RY) * 180) / Math.PI);
      setCams((l) => moveCams(l, d.index, { ...l[d.index], rotate }, locked));
    } else {
      const s = Math.max(-1, Math.min(1, (CY - p.y) / AR));
      const vertical = Math.round((Math.asin(s) * 180) / Math.PI);
      setCams((l) => moveCams(l, d.index, cleanCam({ ...l[d.index], vertical }), locked));
    }
  }
  const up = () => { drag.current = null; };

  const zi = ZOOMS.findIndex((z) => z.id === cam.zoom);
  const ap = arcPoint(cam.vertical);
  const arcPath = Array.from({ length: 29 }, (_, i) => { const v = VERTICAL_MIN + ((VERTICAL_MAX - VERTICAL_MIN) * i) / 28; const q = arcPoint(v); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-cam" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="cr-var-thumb" />
          <div><h2>{FEATURE_NAME}</h2><p>The same picture from a new camera position</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-cam-stage">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Camera position">
            <ellipse cx={CX} cy={CY} rx={RX} ry={RY} className="cr-cam-ring" />
            <path d={arcPath} className="cr-cam-arc" />
            <ellipse cx={CX} cy={CY + 8} rx={RX * 0.55} ry={RY * 0.45} className="cr-cam-floor" />
            <image href={thumb} x={CX - 30} y={CY - 66} width={60} height={78} preserveAspectRatio="xMidYMid meet" />
            {cams.map((c, i) => { const p = ringPoint(c.rotate); return (
              <g key={i} className={`cr-cam-h${i === sel ? " is-sel" : ""}`} onPointerDown={(e) => down(e, "ring", i)}>
                <circle cx={p.x} cy={p.y} r={16} className="cr-cam-hit" />
                <circle cx={p.x} cy={p.y} r={9} className="cr-cam-dot" />
                {cams.length > 1 && <text x={p.x} y={p.y + 3.5} textAnchor="middle">{i + 1}</text>}
              </g>
            ); })}
            <g className="cr-cam-v" onPointerDown={(e) => down(e, "arc", sel)}>
              <circle cx={ap.x} cy={ap.y} r={16} className="cr-cam-hit" />
              <circle cx={ap.x} cy={ap.y} r={9} className="cr-cam-dot2" />
            </g>
          </svg>
          <div className="cr-cam-inset" aria-label="Preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" style={{ transform: `perspective(180px) rotateY(${-Math.round(cam.rotate > 180 ? cam.rotate - 360 : cam.rotate)}deg) rotateX(${Math.round(cam.vertical * 0.5)}deg) scale(${ZOOM_SCALE[cam.zoom]})` }} />
            <span>Preview</span>
          </div>
        </div>

        {cams.length > 1 && (
          <div className="cr-cam-pick" role="tablist" aria-label="Cameras">
            {cams.map((_, i) => <button key={i} type="button" role="tab" aria-selected={i === sel} className={i === sel ? "is-on" : ""} onClick={() => setSel(i)}>{i + 1}</button>)}
          </div>
        )}

        <div className="cr-cam-slider"><label htmlFor="cr-cam-r">Rotate</label><input id="cr-cam-r" type="range" min={0} max={359} value={cam.rotate} onChange={(e) => change({ rotate: Number(e.target.value) })} /><output>{cam.rotate}°</output></div>
        <div className="cr-cam-slider"><label htmlFor="cr-cam-v">Vertical</label><input id="cr-cam-v" type="range" min={VERTICAL_MIN} max={VERTICAL_MAX} value={cam.vertical} onChange={(e) => change({ vertical: Number(e.target.value) })} /><output>{cam.vertical}°</output></div>
        <div className="cr-cam-slider"><label htmlFor="cr-cam-z">Zoom</label><input id="cr-cam-z" type="range" min={0} max={ZOOMS.length - 1} step={1} value={zi < 0 ? 0 : zi} onChange={(e) => change({ zoom: ZOOMS[Number(e.target.value)].id })} /><output>{ZOOMS[zi < 0 ? 0 : zi].label}</output></div>
        <div className="cr-cam-slider is-cams">
          <label htmlFor="cr-cam-n">Cameras</label><input id="cr-cam-n" type="range" min={1} max={MAX_CAMERAS} step={1} value={count} onChange={(e) => setCount2(Number(e.target.value))} /><output>{count}</output>
          <button type="button" className="cr-cam-lock" onClick={() => setLocked((v) => !v)} aria-pressed={locked} aria-label={locked ? "Unlock cameras" : "Lock cameras"} disabled={count < 2}>{locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
        </div>

        <GrowArea className="cr-var-text" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional), for example: keep the sunglasses on" />
        <p className="cr-cam-tip">Works best when the subject is on a plain background.</p>
        {error && <div className="cr-var-err">{error}</div>}
        <div className="cr-cam-actions">
          <button type="button" className="cr-cam-reset" onClick={reset} aria-label="Reset"><RotateCcw size={16} /></button>
          <button type="button" className="cr-var-go" onClick={() => onRun({ cams, note })} disabled={busy}>
            {busy ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate{count > 1 ? ` ${count}` : ""} <ArrowUp size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
