"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bandage, Brush, Check, ChevronDown, Columns2, Download, Hand, History, Lasso, Loader2, MousePointerClick, Paperclip, Pencil, Redo2, Trash2, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import SheetPortal from "@/components/voice/SheetPortal";
import GenerateButton from "@/components/GenerateButton";
import GrowArea from "@/components/GrowArea";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import { useModels } from "@/lib/use-models";
import { refreshCredits, useCredits } from "@/lib/use-credits";
import { useRenders } from "@/lib/use-renders";
import { imageCost, startImages, tierResolution, type RefId } from "@/lib/image-render";
import { toolModel } from "@/lib/picture-tools";
import { uploadPicture } from "@/lib/use-uploads";
import { readCurrentProject } from "@/lib/projects";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";
import { wandSelect } from "@/lib/edit/wand";
import { EDIT_NAME, RETOUCH_NAME, problem, promptEdit, retouchEdit, retouchMasked, visualEdit, type EditOp, type Pin } from "@/lib/edit/prompt";
import "./edit.css";

type Mode = "edit" | "retouch";
type Tool = "brush" | "lasso" | "click";
type Cell = { id: string | null; status: "pending" | "completed" | "failed"; error?: string };
type Step = { id: string; parentId: string | null; op: string; prompt: string; createdAt: string };
type Snap = { data: ImageData; empty: boolean };

const BLUE = "rgba(59,130,246,1)";
const MASK_EDGE = 1024; // the selection is kept at this size (long edge); the server scales it up
const file = (id: string, dl = false) => `/api/generations/${id}/file${dl ? "?download=1" : ""}`;
const OP_LABEL: Record<string, string> = { original: "Original", prompt: "Edit", visual: "Edit (pins)", replace: "Replace", erase: "Erase" };

/** The image editor: Edit (Prompt, Visual) changes a picture with words; Retouch (Replace, Erase) changes only a selected area. Every edit makes variations to choose from. */
export default function ImageEditor({ sourceId, onClose, onKept }: { sourceId: string; onClose: () => void; onKept?: (id: string) => void }) {
  const [cur, setCur] = useState(sourceId);
  const [mode, setMode] = useState<Mode>("edit");
  const [tab, setTab] = useState<"prompt" | "visual">("prompt");
  const [rop, setRop] = useState<"replace" | "erase">("replace");
  const [tool, setTool] = useState<Tool>("brush");
  const [hand, setHand] = useState(false);
  const [size, setSize] = useState(55);
  const [text, setText] = useState("");
  const [pins, setPins] = useState<Pin[]>([]);
  const [userRefs, setUserRefs] = useState<RefPick[]>([]);
  const [picking, setPicking] = useState(false);
  const [modelId, setModelId] = useState("auto");
  const [tier, setTier] = useState("2k");
  const [qty, setQty] = useState(2);
  const [chip, setChip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [compare, setCompare] = useState(false);
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageBox, setStageBox] = useState<{ w: number; h: number } | null>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [si, setSi] = useState(0);
  const [lastOp, setLastOp] = useState<EditOp>("prompt");

  const models = useModels({ edit: true });
  const { credits } = useCredits();
  const projectId = readCurrentProject()?.id ?? null;
  const { renders } = useRenders(projectId, 14);
  const img = useRef<HTMLImageElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const mask = useRef<HTMLCanvasElement>(null);
  const draft = useRef<HTMLCanvasElement>(null);
  const prev = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<null | { kind: "draw" | "pan" | "pinch"; last?: { x: number; y: number }; pts?: { x: number; y: number }[]; moved?: boolean; d?: number; z?: number; cx?: number; cy?: number; px?: number; py?: number; start?: { x: number; y: number } }>(null);

  const op: EditOp = mode === "edit" ? tab : rop;
  // Retouch prefers a model with a REAL mask (the selection goes in as a mask); without one, the picture with the selection painted blue goes in as a second picture.
  const masked = useMemo(() => (models ?? []).filter((m) => m.maskEdit && m.maxReferences >= 1), [models]);
  const useMask = mode === "retouch" && masked.length > 0;
  const need = mode === "retouch" && !useMask ? 2 : 1;
  const pool = useMemo(() => (useMask ? masked : (models ?? []).filter((m) => m.maxReferences >= need)), [models, masked, useMask, need]);
  const model = useMemo(() => (modelId === "auto" ? toolModel(pool, "camera") : pool.find((m) => m.id === modelId) ?? toolModel(pool, "camera")), [pool, modelId]);
  const tiers = useMemo(() => (model ? ["1k", ...(model.resolutions.includes("1080p") ? ["1.5k"] : []), ...(model.resolutions.includes("2k") ? ["2k"] : []), ...(model.resolutions.includes("4k") ? ["4k"] : [])] : ["1k"]), [model]);
  const useTier = tiers.includes(tier) ? tier : tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k";
  const unit = model ? imageCost(model, model.resolutions.length ? tierResolution(model.resolutions, useTier) : undefined, 1) : null;
  const hasSel = si > 0 && !snaps[si]?.empty;
  const issue = problem(op, text, pins, hasSel);
  const selecting = mode === "retouch" && !hand;
  const root = steps[0]?.id ?? cur;

  // ---------- the selection (a blue layer the size of the picture, kept at most 1024 px on the long edge) ----------
  const resetMask = useCallback((w: number, h: number) => {
    const k = Math.min(1, MASK_EDGE / Math.max(w, h));
    const mw = Math.max(1, Math.round(w * k)), mh = Math.max(1, Math.round(h * k));
    for (const c of [mask.current, draft.current]) if (c) { c.width = mw; c.height = mh; }
    const ctx = mask.current?.getContext("2d");
    if (!ctx) return;
    setSnaps([{ data: ctx.getImageData(0, 0, mw, mh), empty: true }]);
    setSi(0);
  }, []);
  const snap = useCallback(() => {
    const c = mask.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const data = ctx.getImageData(0, 0, c.width, c.height);
    let empty = true;
    for (let i = 3; i < data.data.length; i += 4) if (data.data[i] > 8) { empty = false; break; }
    setSnaps((s) => [...s.slice(0, si + 1), { data, empty }].slice(-16));
    setSi((i) => Math.min(i + 1, 15));
  }, [si]);
  const restore = (n: number) => { const ctx = mask.current?.getContext("2d"); const s = snaps[n]; if (ctx && s) ctx.putImageData(s.data, 0, 0); };
  const undoSel = () => { if (si > 0) { restore(si - 1); setSi(si - 1); } };
  const redoSel = () => { if (si < snaps.length - 1) { restore(si + 1); setSi(si + 1); } };
  const clearSel = () => { const c = mask.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); snap(); };

  const onLoaded = () => {
    const i = img.current; if (!i) return;
    setNatural({ w: i.naturalWidth, h: i.naturalHeight });
    resetMask(i.naturalWidth, i.naturalHeight);
  };
  const switchTo = (id: string) => { setCur(id); setCells(null); setPicked(null); setHover(null); setPins([]); setText(""); setError(""); setZ(1); setPan({ x: 0, y: 0 }); };

  // ---------- pointer work: draw, pan, pinch ----------
  const toMask = (cx: number, cy: number) => {
    const r = frame.current?.getBoundingClientRect(), m = mask.current;
    if (!r || !m) return null;
    return { x: ((cx - r.left) / r.width) * m.width, y: ((cy - r.top) / r.height) * m.height, nx: (cx - r.left) / r.width, ny: (cy - r.top) / r.height };
  };
  const brushPx = () => { const r = frame.current?.getBoundingClientRect(), m = mask.current; return r && m ? (size * m.width) / (r.width / z) : size; };
  const inControl = (e: React.PointerEvent) => !!(e.target as HTMLElement).closest(".ed-zoom, .ed-pin");
  function onDown(e: React.PointerEvent) {
    if (inControl(e)) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      if (drag.current?.kind === "draw") restore(si); // a second finger turns a stroke into a pinch: drop the partial stroke
      const [a, b] = [...pointers.current.values()];
      drag.current = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, px: pan.x, py: pan.y };
      return;
    }
    if (pointers.current.size > 2) return;
    const start = { x: e.clientX, y: e.clientY };
    if (selecting) {
      const p = toMask(e.clientX, e.clientY); if (!p) return;
      const ctx = mask.current?.getContext("2d"); if (!ctx) return;
      if (tool === "brush") { ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(p.x, p.y, brushPx() / 2, 0, Math.PI * 2); ctx.fill(); drag.current = { kind: "draw", last: p, start }; }
      else drag.current = { kind: "draw", pts: [p], start, moved: false };
    } else if (hand || (mode === "edit" && z > 1)) drag.current = { kind: "pan", last: start, start };
    else drag.current = { kind: "draw", start, moved: false }; // a tap (Visual drops a pin)
  }
  function onMove(e: React.PointerEvent) {
    if (inControl(e)) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (selecting && tool === "brush" && e.pointerType === "mouse") setRing({ x: e.clientX, y: e.clientY });
    const d = drag.current; if (!d) return;
    if (d.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const nz = Math.min(8, Math.max(1, (d.z ?? 1) * (Math.hypot(a.x - b.x, a.y - b.y) / (d.d || 1))));
      setZ(nz); setPan(nz === 1 ? { x: 0, y: 0 } : { x: (d.px ?? 0) + ((a.x + b.x) / 2 - (d.cx ?? 0)), y: (d.py ?? 0) + ((a.y + b.y) / 2 - (d.cy ?? 0)) });
      return;
    }
    if (d.kind === "pan" && d.last) { setPan((p) => ({ x: p.x + e.clientX - d.last!.x, y: p.y + e.clientY - d.last!.y })); d.last = { x: e.clientX, y: e.clientY }; return; }
    if (d.kind !== "draw") return;
    if (d.start && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 5) d.moved = true;
    const p = toMask(e.clientX, e.clientY); if (!p) return;
    const ctx = mask.current?.getContext("2d");
    if (tool === "brush" && d.last && ctx && selecting) { ctx.strokeStyle = BLUE; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = brushPx(); ctx.beginPath(); ctx.moveTo(d.last.x, d.last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); d.last = p; }
    else if (tool === "lasso" && d.pts && selecting) {
      d.pts.push(p);
      const dc = draft.current?.getContext("2d"); if (!dc || !draft.current) return;
      dc.clearRect(0, 0, draft.current.width, draft.current.height); dc.strokeStyle = "#fff"; dc.lineWidth = Math.max(1, draft.current.width / 400); dc.setLineDash([6, 4]); dc.beginPath();
      d.pts.forEach((q, i) => (i ? dc.lineTo(q.x, q.y) : dc.moveTo(q.x, q.y))); dc.stroke();
    }
  }
  function onUp(e: React.PointerEvent) {
    if (inControl(e) && !drag.current) return;
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (d?.kind === "pinch") { if (pointers.current.size < 2) drag.current = null; return; }
    drag.current = null;
    if (!d) return;
    if (d.kind === "pan") return;
    if (selecting) {
      const ctx = mask.current?.getContext("2d");
      if (tool === "brush") snap();
      else if (tool === "lasso" && d.pts && ctx) {
        draft.current?.getContext("2d")?.clearRect(0, 0, draft.current.width, draft.current.height);
        if (d.pts.length > 2) { ctx.fillStyle = BLUE; ctx.beginPath(); d.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill(); snap(); }
      } else if (tool === "click" && !d.moved) wand(e.clientX, e.clientY);
      return;
    }
    if (mode === "edit" && tab === "visual" && !d.moved) { // drop a pin where the person tapped
      const p = toMask(e.clientX, e.clientY);
      if (p && p.nx >= 0 && p.nx <= 1 && p.ny >= 0 && p.ny <= 1 && pins.length < 9) setPins((l) => [...l, { x: p.nx, y: p.ny, text: "" }]);
    }
  }
  function wand(cx: number, cy: number) {
    const m = mask.current, i = img.current, p = toMask(cx, cy);
    if (!m || !i || !p) return;
    try {
      const t = document.createElement("canvas"); t.width = m.width; t.height = m.height;
      const tc = t.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
      tc.drawImage(i, 0, 0, m.width, m.height);
      const px = tc.getImageData(0, 0, m.width, m.height);
      const sel = wandSelect(px.data, m.width, m.height, p.x, p.y, 34);
      const out = tc.createImageData(m.width, m.height);
      for (let k = 0; k < sel.length; k++) if (sel[k]) { out.data[k * 4] = 59; out.data[k * 4 + 1] = 130; out.data[k * 4 + 2] = 246; out.data[k * 4 + 3] = 255; }
      tc.putImageData(out, 0, 0);
      m.getContext("2d")?.drawImage(t, 0, 0);
      snap();
    } catch { setError("Click select is not available for this picture. Use Brush or Lasso."); }
  }
  useEffect(() => { // the picture fills the stage (contain), however small or large it is
    const el = stageEl.current; if (!el) return;
    const read = () => setStageBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = natural && stageBox ? Math.min((stageBox.w - 16) / natural.w, (stageBox.h - 16) / natural.h, 4) : 0;
  useEffect(() => { // wheel zoom (a native listener so the page does not scroll)
    const el = frame.current?.parentElement; if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); setZ((v) => { const nz = Math.min(8, Math.max(1, v * Math.exp(-e.deltaY * 0.0015))); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; }); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);
  const zoomBy = (f: number) => setZ((v) => { const nz = Math.min(8, Math.max(1, v * f)); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });

  // ---------- history, results ----------
  const loadHistory = useCallback(async (id: string) => {
    try { const r = await fetch(`/api/edit/history?id=${encodeURIComponent(id)}`); const d = await r.json().catch(() => ({})); if (r.ok && Array.isArray(d.steps)) setSteps(d.steps); } catch {}
  }, []);
  useEffect(() => { void loadHistory(cur); }, [cur, loadHistory]);
  useEffect(() => {
    if (!cells || cells.every((c) => c.status !== "pending")) return;
    let live = true;
    const t = setInterval(async () => {
      const next = await Promise.all(cells.map(async (c): Promise<Cell> => {
        if (c.status !== "pending" || !c.id) return c;
        try {
          const r = await fetch(`/api/generations/${c.id}`); const d = await r.json().catch(() => ({}));
          if (!r.ok) return c;
          if (d.status === "completed") return { id: c.id, status: "completed" };
          if (d.status === "failed") return { id: c.id, status: "failed", error: d.error ?? "This one could not be made." };
        } catch {}
        return c;
      }));
      if (live) setCells(next);
    }, 3000);
    return () => { live = false; clearInterval(t); };
  }, [cells]);
  const firstDone = cells?.find((c) => c.status === "completed" && c.id)?.id ?? null;
  useEffect(() => { if (firstDone && !picked) setPicked(firstDone); }, [firstDone, picked]);
  const shown = hover ?? picked;

  // the preview of a Retouch result: only the selected area is taken from the result, the rest stays the original
  useEffect(() => {
    const c = prev.current, m = mask.current, base = img.current;
    if (!c) return;
    if (!shown || lastOp === "prompt" || lastOp === "visual" || !m || !base) { c.width = 1; c.height = 1; c.style.display = "none"; return; }
    let live = true;
    const r = new Image();
    r.onload = () => {
      if (!live) return;
      const W = Math.min(base.naturalWidth, 1600), H = Math.round((W * base.naturalHeight) / base.naturalWidth);
      c.width = W; c.height = H; c.style.display = "block";
      const ctx = c.getContext("2d"); const t = document.createElement("canvas"); t.width = W; t.height = H;
      const tc = t.getContext("2d");
      if (!ctx || !tc) return;
      ctx.drawImage(base, 0, 0, W, H);
      tc.drawImage(r, 0, 0, W, H); tc.globalCompositeOperation = "destination-in"; tc.filter = "blur(2px)"; tc.drawImage(m, 0, 0, W, H);
      ctx.drawImage(t, 0, 0);
    };
    r.src = file(shown);
    return () => { live = false; };
  }, [shown, lastOp, si, snaps]);

  // ---------- make variations ----------
  async function overlayFile(): Promise<File> {
    const base = img.current, m = mask.current;
    if (!base || !m) throw new Error("The picture is not loaded yet.");
    const W = Math.min(base.naturalWidth, 1536), H = Math.round((W * base.naturalHeight) / base.naturalWidth);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(base, 0, 0, W, H); ctx.globalAlpha = 0.55; ctx.drawImage(m, 0, 0, W, H);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw new Error("The selection could not be prepared.");
    return new File([blob], "retouch-selection.jpg", { type: "image/jpeg" });
  }
  async function generate() {
    if (busy || issue || !model) return;
    setBusy(true); setError(""); setCells(null); setPicked(null);
    try {
      const refs: RefId[] = [{ type: "render", id: cur }];
      let maskId: string | undefined;
      if (mode === "retouch" && useMask) { // the real mask: the selection itself, as a small picture; the server makes the provider's mask from it
        const blob: Blob | null = await new Promise((res) => mask.current?.toBlob(res, "image/png"));
        if (!blob) throw new Error("The selection could not be prepared.");
        const up = await uploadPicture(new File([blob], "retouch-mask.png", { type: "image/png" }), "asset", "Retouch mask", projectId);
        if (!up.ok || !up.item) throw new Error(up.ok ? "The selection could not be saved." : up.error);
        maskId = up.item.id;
      } else if (mode === "retouch") {
        const up = await uploadPicture(await overlayFile(), "asset", "Retouch selection", projectId);
        if (!up.ok || !up.item) throw new Error(up.ok ? "The selection could not be saved." : up.error);
        refs.push({ type: "upload", id: up.item.id });
      }
      const extra = userRefs.slice(0, Math.max(0, model.maxReferences - refs.length));
      refs.push(...extra.map((r) => ({ type: r.type, id: r.id })));
      const prompt = op === "prompt" ? promptEdit(text, extra.length) : op === "visual" ? visualEdit(pins, extra.length) : (useMask ? retouchMasked(op, text, extra.length) : retouchEdit(op, text, extra.length));
      const { results } = await startImages({ models: models ?? [], model, auto: false, prompt, ratio: "auto", tier: useTier, qty, refs, seedOn: false, seedNum: null, projectId, maskId });
      refreshCredits();
      const out: Cell[] = results.map((r) => (r.ok && r.id ? { id: r.id, status: "pending" } : { id: null, status: "failed", error: r.error }));
      if (!out.some((c) => c.id)) throw new Error(results.find((r) => !r.ok)?.error ?? "Something went wrong. Please try again.");
      setLastOp(op); setCells(out);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  async function keep() {
    if (!picked || keeping) return;
    setKeeping(true); setError("");
    try {
      let maskB64: string | undefined;
      if (lastOp === "replace" || lastOp === "erase") {
        const blob: Blob | null = await new Promise((res) => mask.current?.toBlob(res, "image/png"));
        if (!blob) throw new Error("The selection could not be read.");
        maskB64 = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
      }
      const res = await fetch("/api/edit/keep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: cur, resultId: picked, op: lastOp, prompt: text, pins: lastOp === "visual" ? pins : undefined, mask: maskB64, discardIds: (cells ?? []).flatMap((c) => (c.id && c.id !== picked ? [c.id] : [])) }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.id !== "string") throw new Error(d.error ?? "This edit could not be saved.");
      switchTo(d.id);
      onKept?.(d.id);
    } catch (e) { setError(e instanceof Error ? e.message : "This edit could not be saved."); }
    finally { setKeeping(false); }
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("textarea, input, select");
      if (e.key === "Escape") { if (picking) setPicking(false); else if (chip) setChip(false); else onClose(); return; }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redoSel(); else undoSel(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redoSel(); }
      else if (e.key === "e") setMode("edit"); else if (e.key === "r") setMode("retouch");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const px = natural ? `${natural.w}×${natural.h}` : "";
  const total = unit != null ? unit * qty : null;
  const placeholder = mode === "edit" ? "What do you want to change?" : rop === "replace" ? "Draw a selection and describe what you want to change" : "Draw a selection to erase";
  const toolIcon = tool === "brush" ? <Brush size={15} /> : tool === "lasso" ? <Lasso size={15} /> : <MousePointerClick size={15} />;

  return (
    <SheetPortal>
      <div className="ed" role="dialog" aria-modal="true" aria-label="Image editor">
        <header className="ed-top">
          <button type="button" className="ed-ic" onClick={onClose} aria-label="Close the editor"><X size={18} /></button>
          <div className="ed-top-mid">
            {mode === "retouch" && (<>
              <button type="button" className="ed-ic" onClick={undoSel} disabled={si === 0} aria-label="Undo"><Undo2 size={17} /></button>
              <button type="button" className="ed-ic" onClick={redoSel} disabled={si >= snaps.length - 1} aria-label="Redo"><Redo2 size={17} /></button>
              <button type="button" className="ed-ic" onClick={clearSel} disabled={!hasSel} aria-label="Clear the selection"><Trash2 size={17} /></button>
            </>)}
          </div>
          <button type="button" className={`ed-ic${showHistory ? " is-on" : ""}`} onClick={() => setShowHistory((v) => !v)} aria-label="History" aria-pressed={showHistory}><History size={17} /></button>
          <a className="ed-ic" href={file(cur, true)} download aria-label="Download"><Download size={17} /></a>
        </header>

        <div className="ed-body">
          <div ref={stageEl} className="ed-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setRing(null)}
            style={{ touchAction: selecting || hand || z > 1 || (mode === "edit" && tab === "visual") ? "none" : "pan-y" }}>
            <div ref={frame} className={`ed-frame${selecting ? " is-select" : ""}${hand ? " is-hand" : ""}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, ...(fit > 0 && natural ? { width: Math.round(natural.w * fit), height: Math.round(natural.h * fit) } : {}) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={img} key={cur} src={file(compare ? root : cur)} alt="Picture being edited" onLoad={onLoaded} draggable={false} />
              {shown && (lastOp === "prompt" || lastOp === "visual") && !compare && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ed-over" src={file(shown)} alt="Preview of the edit" draggable={false} />}
              <canvas ref={prev} className="ed-over ed-prev" style={{ display: "none" }} />
              <canvas ref={mask} className="ed-mask" style={{ display: mode === "retouch" && !compare ? "block" : "none" }} />
              <canvas ref={draft} className="ed-draft" />
              {mode === "edit" && tab === "visual" && !compare && pins.map((p, i) => (
                <div key={i} className="ed-pin" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                  <b>{i + 1}</b>
                  <input value={p.text} autoFocus={!p.text} maxLength={400} placeholder="Change here…" aria-label={`Change at point ${i + 1}`} onChange={(e) => setPins((l) => l.map((q, k) => (k === i ? { ...q, text: e.target.value } : q)))} />
                  <button type="button" aria-label={`Remove point ${i + 1}`} onClick={() => setPins((l) => l.filter((_, k) => k !== i))}><X size={12} /></button>
                </div>
              ))}
            </div>
            {ring && selecting && tool === "brush" && <i className="ed-ring" style={{ left: ring.x, top: ring.y, width: size * z, height: size * z }} />}
            <div className="ed-zoom">
              <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out"><ZoomOut size={15} /></button>
              <span>{Math.round(z * 100)}%{px ? ` · ${px}` : ""}</span>
              <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in"><ZoomIn size={15} /></button>
              <button type="button" className={hand ? "is-on" : ""} onClick={() => setHand((v) => !v)} aria-pressed={hand} aria-label="Move the picture" title="Move the picture"><Hand size={15} /></button>
              <button type="button" onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)} aria-label="Hold to compare with the original" title="Hold to compare with the original"><Columns2 size={15} /></button>
            </div>
          </div>

          <aside className="ed-strip" aria-label="Recent pictures">
            {(renders ?? []).filter((r) => r.kind !== "video" && r.status === "completed").slice(0, 12).map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <button key={r.id} type="button" className={r.id === cur ? "is-on" : ""} onClick={() => switchTo(r.id)} aria-label="Edit this picture"><img src={thumbOf("render", r.id)} onError={fallbackTo(r.imageUrl ?? "")} alt="" /></button>
            ))}
          </aside>

          {showHistory && (
            <aside className="ed-history" aria-label="Editing history">
              <h3>History</h3>
              {steps.length < 2 && <p>Edits you keep appear here, starting from the original.</p>}
              {steps.map((s, i) => (
                <button key={s.id} type="button" className={s.id === cur ? "is-on" : ""} onClick={() => switchTo(s.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbOf("render", s.id)} alt="" />
                  <span><b>{i === 0 ? "Original" : OP_LABEL[s.op] ?? "Edit"}</b><small>{i === 0 ? "Start here" : s.prompt}</small></span>
                </button>
              ))}
            </aside>
          )}
        </div>

        {cells && (
          <div className="ed-tray" aria-label="Variations">
            {cells.map((c, i) => (
              <button key={i} type="button" disabled={c.status !== "completed"} className={`ed-thumb${c.id && c.id === picked ? " is-on" : ""}`} onMouseEnter={() => c.id && c.status === "completed" && setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={() => c.id && setPicked(c.id)} aria-label={`Variation ${i + 1}`} title={c.error}>
                {c.status === "completed" && c.id ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumbOf("render", c.id)} alt="" /> : c.status === "pending" ? <Loader2 size={18} className="gen-spin" /> : <small>Failed</small>}
              </button>
            ))}
            {picked && <button type="button" className="ed-keep" onClick={() => void keep()} disabled={keeping}>{keeping ? <Loader2 size={14} className="gen-spin" /> : <Check size={14} />} Keep this one</button>}
            {cells.every((c) => c.status !== "pending") && <small className="ed-tray-note">The others go to the Bin.</small>}
          </div>
        )}

        <div className="ed-bar">
          {error && <p className="ed-err" role="alert">{error}</p>}
          <div className="ed-barrow">
            {mode === "edit" ? (
              <div className="ed-seg" role="tablist" aria-label="Edit mode">
                <button type="button" role="tab" aria-selected={tab === "prompt"} className={tab === "prompt" ? "is-on" : ""} onClick={() => setTab("prompt")}>Prompt</button>
                <button type="button" role="tab" aria-selected={tab === "visual"} className={tab === "visual" ? "is-on" : ""} onClick={() => setTab("visual")}>Visual</button>
              </div>
            ) : (
              <>
                <div className="ed-seg" role="tablist" aria-label="Retouch mode">
                  <button type="button" role="tab" aria-selected={rop === "replace"} className={rop === "replace" ? "is-on" : ""} onClick={() => setRop("replace")}>Replace</button>
                  <button type="button" role="tab" aria-selected={rop === "erase"} className={rop === "erase" ? "is-on" : ""} onClick={() => setRop("erase")}>Erase</button>
                </div>
                <label className="ed-sel" aria-label="Selection tool">{toolIcon}<select value={tool} onChange={(e) => { setTool(e.target.value as Tool); setHand(false); }}><option value="brush">Brush</option><option value="lasso">Lasso</option><option value="click">Click</option></select><ChevronDown size={13} /></label>
                {tool === "brush" && <label className="ed-size" aria-label="Brush size"><input type="range" min={8} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} /><span>{size}</span></label>}
              </>
            )}
            <div className="ed-grow" />
            <button type="button" className="ed-ic" onClick={() => setPicking(true)} aria-label="Attach a reference picture" title="Attach a reference picture"><Paperclip size={16} />{userRefs.length > 0 && <em>{userRefs.length}</em>}</button>
            <div className="ed-chipwrap">
              <button type="button" className="ed-chip" onClick={() => setChip((v) => !v)} aria-expanded={chip}>{modelId === "auto" ? "Auto" : model?.label ?? "Model"} · {useTier.toUpperCase()}<ChevronDown size={13} /></button>
              {chip && (
                <div className="ed-pop" role="dialog" aria-label="Model settings">
                  <label>Model<select value={modelId} onChange={(e) => setModelId(e.target.value)}><option value="auto">Auto{model ? ` (${model.label})` : ""}</option>{pool.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
                  <label>Resolution<select value={useTier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
                  <label>Images<span className="ed-step"><button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Fewer images">−</button><b>{qty}</b><button type="button" onClick={() => setQty((n) => Math.min(4, n + 1))} aria-label="More images">+</button></span></label>
                </div>
              )}
            </div>
          </div>
          {userRefs.length > 0 && (
            <div className="ed-refs">
              {userRefs.map((r) => (
                <span key={`${r.type}${r.id}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={r.url} alt="" /><button type="button" aria-label="Remove this reference" onClick={() => setUserRefs((l) => l.filter((x) => x.id !== r.id))}><X size={11} /></button></span>
              ))}
            </div>
          )}
          <div className="ed-send">
            {(mode === "edit" && tab === "visual")
              ? <p className="ed-hint">{pins.length ? `${pins.length} ${pins.length === 1 ? "point" : "points"}. Click the picture to add another.` : "Add annotations by clicking on the image"}</p>
              : <GrowArea className="ed-text" wrapClassName="ed-textwrap" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} disabled={mode === "retouch" && rop === "erase"} aria-label="Instruction" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }} />}
            <GenerateButton label="Generate" price={total} free={unit != null && (credits?.freeImages ?? 0) >= qty} busy={busy} disabled={!!issue || !model} onClick={() => void generate()} />
          </div>
          {issue && !error && <p className="ed-hint is-issue">{issue}</p>}
          {models && !model && <p className="ed-err" role="alert">{mode === "retouch" ? `${RETOUCH_NAME} needs a model that takes two pictures, and none is connected yet.` : `${EDIT_NAME} needs a model that edits pictures, and none is connected yet.`}</p>}
        </div>

        <nav className="ed-modes" aria-label="Editor modes">
          <button type="button" className={mode === "edit" ? "is-on" : ""} onClick={() => setMode("edit")} title={`${EDIT_NAME} (E)`} aria-pressed={mode === "edit"}><Pencil size={19} /><span>{EDIT_NAME}</span></button>
          <button type="button" className={mode === "retouch" ? "is-on" : ""} onClick={() => setMode("retouch")} title={`${RETOUCH_NAME} (R)`} aria-pressed={mode === "retouch"}><Bandage size={19} /><span>{RETOUCH_NAME}</span></button>
        </nav>
      </div>
      {picking && model && <ReferencePicker max={Math.max(1, model.maxReferences - need)} picked={userRefs} onChange={setUserRefs} onClose={() => setPicking(false)} />}
    </SheetPortal>
  );
}
