"use client";

import { useEffect, useRef, useState } from "react";
import { Brush, Check, MapPin, Redo2, Trash2, Undo2, X } from "lucide-react";

type Pt = { x: number; y: number }; // 0..1 of the picture
type Mark = { kind: "stroke"; pts: Pt[] } | { kind: "pin"; at: Pt; n: number };

const RED = "#ff2d2d";
const MAX_SIDE = 2048;
const MAX_PINS = 9;

/** Marks the parts of a picture that should change: freehand drawing or numbered pins on top of it. "Done" hands back a copy of the picture with the marks drawn in. */
export default function MarkDialog({ url, label, onCancel, onDone }: { url: string; label: string; onCancel: () => void; onDone: (file: File) => void }) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [undone, setUndone] = useState<Mark[]>([]);
  const [tool, setTool] = useState<"draw" | "pin">("draw");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const img = useRef<HTMLImageElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef<Pt[] | null>(null);
  const [tick, setTick] = useState(0);

  const pins = marks.filter((m) => m.kind === "pin").length;

  // draw everything on a canvas of the given pixel size (the screen one while editing, the full one when saving)
  function paint(ctx: CanvasRenderingContext2D, w: number, h: number, list: Mark[], extra?: Pt[] | null) {
    const side = Math.max(w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = RED; ctx.fillStyle = RED;
    ctx.lineWidth = Math.max(3, side * 0.012);
    const draw = (pts: Pt[]) => {
      if (!pts.length) return;
      ctx.beginPath(); ctx.moveTo(pts[0].x * w, pts[0].y * h);
      if (pts.length === 1) ctx.lineTo(pts[0].x * w + 0.1, pts[0].y * h);
      for (const p of pts.slice(1)) ctx.lineTo(p.x * w, p.y * h);
      ctx.stroke();
    };
    for (const m of list) {
      if (m.kind === "stroke") draw(m.pts);
      else {
        const r = Math.max(13, side * 0.03);
        ctx.beginPath(); ctx.arc(m.at.x * w, m.at.y * h, r, 0, Math.PI * 2); ctx.fillStyle = RED; ctx.fill();
        ctx.lineWidth = Math.max(2, side * 0.004); ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.round(r * 1.25)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(m.n), m.at.x * w, m.at.y * h + r * 0.06);
        ctx.strokeStyle = RED; ctx.fillStyle = RED; ctx.lineWidth = Math.max(3, side * 0.012);
      }
    }
    if (extra) draw(extra);
  }

  function redraw() {
    const c = cv.current, i = img.current;
    if (!c || !i) return;
    const w = i.clientWidth, h = i.clientHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    paint(ctx, w, h, marks, live.current);
  }
  useEffect(() => { redraw(); }, [marks, tick]);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  const at = (e: React.PointerEvent): Pt => {
    const r = cv.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pin") {
      if (pins >= MAX_PINS) return;
      setUndone([]);
      setMarks((l) => [...l, { kind: "pin", at: at(e), n: l.filter((m) => m.kind === "pin").length + 1 }]);
      return;
    }
    live.current = [at(e)];
    redraw();
  }
  function move(e: React.PointerEvent) {
    if (!live.current) return;
    live.current.push(at(e));
    redraw();
  }
  function up() {
    const pts = live.current;
    live.current = null;
    if (pts && pts.length) { setUndone([]); setMarks((l) => [...l, { kind: "stroke", pts }]); }
  }
  const undo = () => setMarks((l) => { if (!l.length) return l; setUndone((u) => [...u, l[l.length - 1]]); return l.slice(0, -1); });
  const redo = () => setUndone((u) => { if (!u.length) return u; setMarks((l) => [...l, u[u.length - 1]]); return u.slice(0, -1); });

  async function done() {
    const i = img.current;
    if (!i || !marks.length || busy) return;
    setBusy(true); setErr("");
    try {
      const nw = i.naturalWidth, nh = i.naturalHeight;
      const k = Math.min(1, MAX_SIDE / Math.max(nw, nh));
      const w = Math.round(nw * k), h = Math.round(nh * k);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(i, 0, 0, w, h);
      paint(ctx, w, h, marks);
      const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error("x");
      onDone(new File([blob], `${label.replace(/\.[^.]+$/, "").slice(0, 60)} (marked).png`, { type: "image/png" }));
    } catch {
      setErr("Could not save the marks. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="cr-mark" role="dialog" aria-modal="true" aria-label="Mark the parts to change">
      <div className="cr-mark-bar">
        <button type="button" className="cr-mark-btn" onClick={onCancel} aria-label="Cancel"><X size={20} /></button>
        <div className="cr-mark-tools">
          <button type="button" className={tool === "draw" ? "is-on" : ""} onClick={() => setTool("draw")} aria-label="Draw"><Brush size={18} /></button>
          <button type="button" className={tool === "pin" ? "is-on" : ""} onClick={() => setTool("pin")} aria-label="Pin" disabled={pins >= MAX_PINS && tool !== "pin"}><MapPin size={18} /></button>
          <button type="button" onClick={undo} disabled={!marks.length} aria-label="Undo"><Undo2 size={18} /></button>
          <button type="button" onClick={redo} disabled={!undone.length} aria-label="Redo"><Redo2 size={18} /></button>
          <button type="button" onClick={() => { setUndone([]); setMarks([]); }} disabled={!marks.length} aria-label="Clear all"><Trash2 size={18} /></button>
        </div>
        <button type="button" className="cr-mark-btn is-done" onClick={done} disabled={!marks.length || busy} aria-label="Done"><Check size={20} /></button>
      </div>
      <div className="cr-mark-stage">
        <div className="cr-mark-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={img} src={url} alt={label} crossOrigin="anonymous" draggable={false} onLoad={() => setTick((n) => n + 1)} />
          <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        </div>
      </div>
      {err && <div className="cr-mark-err">{err}</div>}
    </div>
  );
}
