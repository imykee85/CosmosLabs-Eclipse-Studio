"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Copy, Film, Image as ImageIcon, Loader2, Music, Pause, Play, Plus, Redo2, Scissors, Trash2, Type, Undo2, Upload, X } from "lucide-react";
import Bar from "../create/Bar";
import { useRenders } from "@/lib/use-renders";
import { uploadVideo } from "@/lib/use-uploads";
import type { AudioItem } from "@/lib/audio/jobs";
import { ASPECTS, clipDur, duplicateClip, emptyProject, fadeFactor, fmtTime, isVisual, layout, newClip, newText, removeClip, reorderVisual, sizeFor, splitAt, totalDur, trimEnd, trimStart, type Aspect, type Clip, type Project } from "@/lib/editor/model";
import { drawFrame, exportProject, type Media } from "@/lib/editor/render";
import "./video-editor.css";

type Sel = { type: "clip" | "text"; id: string } | null;
type Pick = { kind: Clip["kind"]; src: string; name: string; dur: number | null };
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const COLORS = ["#ffffff", "#000000", "#c00707", "#ffd400"];

/** A copy of the file held in memory, so scrubbing and playing never wait on the network. Falls back to the address itself. */
async function localCopy(src: string, keep: string[]): Promise<string> {
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  try {
    const r = await fetch(src);
    const len = Number(r.headers.get("content-length") || 0);
    if (!r.ok || len > 400 * 1024 * 1024) return src;
    const u = URL.createObjectURL(await r.blob()); keep.push(u); return u;
  } catch { return src; }
}

/** Reads how long a video or sound file is (images need no length). */
function probe(kind: Clip["kind"], src: string): Promise<number> {
  return new Promise((res) => {
    if (kind === "image") return res(3600);
    const el = document.createElement(kind === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => res(Number.isFinite(el.duration) ? el.duration : 5);
    el.onerror = () => res(5);
    el.src = src;
  });
}

/** Eclipse's own timeline editor: put clips, pictures, sound and titles in order, cut and trim them, and save the result as a new video. Everything runs on the person's device. */
export default function VideoEditor({ video, projectId, onClose, onSaved }: { video: { id: string; fileName?: string | null; durationSec?: number | null; aspectRatio?: string | null } | null; projectId: string | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const [project, setProject] = useState<Project>(() => emptyProject((["16:9", "9:16", "1:1", "4:5"].includes(video?.aspectRatio ?? "") ? video!.aspectRatio : "16:9") as Aspect));
  const [sel, setSel] = useState<Sel>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(60);
  const [busy, setBusy] = useState<{ f: number; label: string } | null>(null);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [dragX, setDragX] = useState<{ id: string; dx: number } | null>(null);

  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastKey = useRef({ key: "", at: 0 });
  const [, bump] = useState(0);
  const tRef = useRef(0);
  const media = useRef(new Map<string, Media>());
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const lastSet = useRef(0);
  const blobs = useRef<string[]>([]);

  const lp = useMemo(() => layout(project), [project]);
  const total = useMemo(() => totalDur(project), [project]);
  const { w: cw, h: ch } = sizeFor(project.aspect, 540);

  const commit = useCallback((next: Project | ((p: Project) => Project), key?: string) => {
    setProject((cur) => {
      const n = typeof next === "function" ? next(cur) : next;
      if (n === cur) return cur;
      const now = Date.now();
      if (!(key && lastKey.current.key === key && now - lastKey.current.at < 800)) { past.current.push(cur); if (past.current.length > 60) past.current.shift(); }
      lastKey.current = { key: key ?? "", at: now };
      future.current = [];
      return n;
    });
    bump((x) => x + 1);
  }, []);
  const undo = () => { const p = past.current.pop(); if (!p) return; setProject((cur) => { future.current.push(cur); return p; }); bump((x) => x + 1); };
  const redo = () => { const p = future.current.pop(); if (!p) return; setProject((cur) => { past.current.push(cur); return p; }); bump((x) => x + 1); };

  // ---- loaded media (one element per clip, used by the preview) ----
  const lpRef = useRef(lp); lpRef.current = lp;
  const draw = useCallback(() => {
    const c = canvas.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
    drawFrame(ctx, c.width, c.height, lpRef.current, tRef.current, (id) => media.current.get(id) ?? null);
  }, []);
  useEffect(() => {
    const m = media.current;
    const ids = new Set(project.clips.map((c) => c.id));
    for (const [id, el] of m) if (!ids.has(id)) { if (el instanceof HTMLVideoElement) el.pause(); m.delete(id); }
    for (const c of project.clips) {
      if (m.has(c.id)) continue;
      if (c.kind === "image") { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = draw; i.src = c.src; m.set(c.id, i); }
      else {
        const v = document.createElement(c.kind === "video" ? "video" : "audio");
        v.preload = "auto"; v.src = c.src; (v as HTMLVideoElement).playsInline = true;
        v.addEventListener("seeked", draw); v.addEventListener("loadeddata", draw);
        m.set(c.id, v as HTMLVideoElement);
      }
    }
  }, [project.clips, draw]);
  useEffect(() => () => { for (const el of media.current.values()) if (el instanceof HTMLVideoElement) el.pause(); media.current.clear(); for (const u of blobs.current) URL.revokeObjectURL(u); }, []);

  const syncMedia = useCallback((time: number, isPlaying: boolean) => {
    for (const c of lpRef.current.clips) {
      const el = media.current.get(c.id);
      if (!el || el instanceof HTMLImageElement) continue;
      const d = clipDur(c);
      if (time >= c.start && time < c.start + d) {
        const want = c.in + (time - c.start) * c.speed;
        if (Math.abs(el.currentTime - want) > (isPlaying ? 0.35 : 0.04)) el.currentTime = want;
        el.playbackRate = c.speed;
        el.volume = Math.max(0, Math.min(1, c.volume * fadeFactor(c, time - c.start)));
        if (isPlaying && el.paused) void el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
        // get the next clip ready just before it starts, so there is no stall at the cut
        if (isPlaying && time < c.start && c.start - time < 1 && !el.seeking && Math.abs(el.currentTime - c.in) > 0.1) el.currentTime = c.in;
      }
    }
  }, []);

  useEffect(() => { if (!playing) { syncMedia(t, false); draw(); } }, [t, playing, project, syncMedia, draw]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const t0 = performance.now(); const base = tRef.current;
    const tick = () => {
      const now = base + (performance.now() - t0) / 1000;
      if (now >= total) { tRef.current = total; setT(total); setPlaying(false); return; }
      tRef.current = now; syncMedia(now, true); draw();
      if (headRef.current) headRef.current.style.left = `${now * pps}px`;
      if (timeRef.current) timeRef.current.textContent = `${fmtTime(now)} / ${fmtTime(total)}`;
      if (performance.now() - lastSet.current > 250) { lastSet.current = performance.now(); setT(now); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); for (const el of media.current.values()) if (el instanceof HTMLVideoElement && !el.paused) el.pause(); };
  }, [playing, total, pps, syncMedia, draw]);
  const seekTo = (time: number) => { const v = Math.max(0, Math.min(total, time)); tRef.current = v; setT(v); };

  // the clip handed in from the preview starts the timeline
  useEffect(() => {
    if (!video) return;
    let dead = false;
    void (async () => {
      const src = await localCopy(`/api/generations/${video.id}/file`, blobs.current);
      const dur = video.durationSec && video.durationSec > 0 ? video.durationSec : await probe("video", src);
      if (!dead) commit((p) => (p.clips.length ? p : { ...p, clips: [newClip("video", src, video.fileName || "Clip", dur)] }));
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  // ---- adding ----
  async function add(p: Pick) {
    setError("");
    const src = await localCopy(p.src, blobs.current);
    const dur = p.dur && p.dur > 0 ? p.dur : await probe(p.kind, src);
    const c = newClip(p.kind, src, p.name, dur);
    if (p.kind === "audio") c.start = tRef.current;
    commit((cur) => ({ ...cur, clips: [...cur.clips, c] }));
    setSel({ type: "clip", id: c.id });
    setPicker(false);
  }
  function addText() { const x = newText(tRef.current); commit((cur) => ({ ...cur, texts: [...cur.texts, x] })); setSel({ type: "text", id: x.id }); }

  // ---- editing the selection ----
  const selClip = sel?.type === "clip" ? lp.clips.find((c) => c.id === sel.id) ?? null : null;
  const selText = sel?.type === "text" ? project.texts.find((x) => x.id === sel.id) ?? null : null;
  const patchClip = (patch: Partial<Clip>, key: string) => selClip && commit((p) => ({ ...p, clips: p.clips.map((c) => (c.id === selClip.id ? { ...c, ...patch } : c)) }), key);
  const patchText = (patch: Partial<NonNullable<typeof selText>>, key: string) => selText && commit((p) => ({ ...p, texts: p.texts.map((x) => (x.id === selText.id ? { ...x, ...patch } : x)) }), key);
  function split() {
    const target = selClip && t > selClip.start && t < selClip.start + clipDur(selClip) ? selClip : lp.clips.find((c) => isVisual(c) && t > c.start && t < c.start + clipDur(c));
    if (target) commit((p) => splitAt(p, target.id, tRef.current));
  }
  function del() {
    if (selClip) { commit((p) => removeClip(p, selClip.id)); setSel(null); }
    else if (selText) { commit((p) => ({ ...p, texts: p.texts.filter((x) => x.id !== selText.id) })); setSel(null); }
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape" && !busy) onClose();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "s" || e.key === "S") split();
      else if (e.key === "Delete" || e.key === "Backspace") del();
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // ---- timeline dragging ----
  function xToTime(clientX: number) { const r = content.current?.getBoundingClientRect(); return r ? (clientX - r.left) / pps : 0; }
  function scrub(e: RPointerEvent) {
    e.preventDefault(); setPlaying(false); setSel(null); seekTo(xToTime(e.clientX));
    const move = (ev: PointerEvent) => seekTo(xToTime(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function drag(e: RPointerEvent, type: "clip" | "text", id: string, mode: "move" | "l" | "r") {
    e.stopPropagation(); e.preventDefault();
    setSel({ type, id }); setPlaying(false);
    const x0 = e.clientX; const snap = project; let moved = false;
    const base = type === "clip" ? lp.clips.find((c) => c.id === id)! : null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0; const dt = dx / pps;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) { moved = true; past.current.push(snap); future.current = []; lastKey.current = { key: "", at: 0 }; }
      if (type === "clip" && base) {
        if (mode === "move" && isVisual(base)) { setDragX({ id, dx }); return; }
        const orig = snap.clips.find((c) => c.id === id)!;
        const next = mode === "l" ? trimStart({ ...orig, start: base.start }, dt) : mode === "r" ? trimEnd(orig, dt) : { ...orig, start: Math.max(0, base.start + dt) };
        setProject({ ...snap, clips: snap.clips.map((c) => (c.id === id ? next : c)) });
      } else {
        const o = snap.texts.find((x) => x.id === id)!;
        const next = mode === "move" ? { ...o, start: Math.max(0, o.start + dt) } : mode === "r" ? { ...o, dur: Math.max(0.3, o.dur + dt) } : { ...o, start: Math.max(0, Math.min(o.start + o.dur - 0.3, o.start + dt)), dur: Math.max(0.3, o.dur - (Math.max(0, Math.min(o.start + o.dur - 0.3, o.start + dt)) - o.start)) };
        setProject({ ...snap, texts: snap.texts.map((x) => (x.id === id ? next : x)) });
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (moved && type === "clip" && base && mode === "move" && isVisual(base)) {
        const drop = base.start + clipDur(base) / 2 + (ev.clientX - x0) / pps;
        setProject(reorderVisual(snap, id, drop));
      }
      setDragX(null); bump((x) => x + 1);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ---- saving ----
  async function save() {
    if (busy || !total) return;
    setError(""); setPlaying(false);
    abort.current = new AbortController();
    try {
      setBusy({ f: 0, label: "Preparing" });
      const blob = await exportProject(project, (f, label) => setBusy({ f, label }), abort.current.signal);
      setBusy({ f: 0.98, label: "Saving" });
      const file = new File([blob], "edit.mp4", { type: "video/mp4" });
      const r = await uploadVideo<{ id: string }>(file, `Edit ${new Date().toISOString().slice(0, 10)}`, projectId, (f) => setBusy({ f: 0.98 + f * 0.02, label: "Saving" }));
      if (!r.ok) { setError(r.error || "The edit could not be saved."); setBusy(null); return; }
      onSaved(r.item?.id); onClose();
    } catch (e) {
      setError(e instanceof Error && e.message && e.message !== "Cancelled." ? e.message : e instanceof Error && e.message === "Cancelled." ? "" : "The edit could not be saved.");
      setBusy(null);
    }
  }

  const width = Math.max(total + 8, 20) * pps;
  const ticks: number[] = []; const step = pps >= 90 ? 1 : pps >= 40 ? 2 : 5; for (let s = 0; s <= width / pps; s += step) ticks.push(s);
  const block = (c: Clip) => {
    const d = clipDur(c); const dx = dragX?.id === c.id ? dragX.dx : 0;
    return (
      <div key={c.id} className={`ve-block ve-${c.kind}${sel?.id === c.id ? " is-sel" : ""}${dx ? " is-drag" : ""}`} style={{ left: c.start * pps, width: Math.max(8, d * pps), transform: dx ? `translateX(${dx}px)` : undefined }} onPointerDown={(e) => drag(e, "clip", c.id, "move")}>
        <i className="ve-h ve-hl" onPointerDown={(e) => drag(e, "clip", c.id, "l")} />
        <span>{c.name}{c.speed !== 1 ? ` · ${c.speed}x` : ""}</span>
        <i className="ve-h ve-hr" onPointerDown={(e) => drag(e, "clip", c.id, "r")} />
      </div>
    );
  };

  const [tab, setTab] = useState<"edit" | "audio" | "text" | "ratio">("edit");
  useEffect(() => { if (selText) setTab("text"); else if (selClip?.kind === "audio") setTab("audio"); else if (selClip) setTab((x) => (x === "audio" || x === "text" ? "edit" : x)); }, [selClip?.id, selClip?.kind, selText?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cr-var-back">
      <div className="cr-var cr-cam ve-panel" role="dialog" aria-modal="true" aria-label="Video editor">
        <div className="cr-var-head">
          <span className="cr-var-thumb ve-thumb"><Film size={22} /></span>
          <div><h2>Editor</h2><p>Cut, add sound and titles</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} disabled={!!busy} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-cam-stage ve-stage"><canvas ref={canvas} width={cw} height={ch} aria-label="Preview" /></div>

        <div className="ve-bar">
          <button type="button" className="ve-play" onClick={() => { if (!total) return; if (!playing && tRef.current >= total - 0.05) seekTo(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"} disabled={!total}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <span className="ve-time" ref={timeRef}>{fmtTime(t)} / {fmtTime(total)}</span>
          <span className="ve-grow" />
          <button type="button" className="ve-icon" onClick={undo} disabled={!past.current.length} aria-label="Undo"><Undo2 size={16} /></button>
          <button type="button" className="ve-icon" onClick={redo} disabled={!future.current.length} aria-label="Redo"><Redo2 size={16} /></button>
          <input type="range" className="ve-zoom" min={20} max={160} value={pps} onChange={(e) => setPps(Number(e.target.value))} aria-label="Zoom the timeline" />
        </div>

        <div className="ve-tl">
          <div className="ve-gutter"><span /><Film size={14} /><Music size={14} /><Type size={14} /></div>
          <div className="ve-scroll">
            <div className="ve-content" ref={content} style={{ width }} onPointerDown={() => setSel(null)}>
              <div className="ve-ruler" onPointerDown={scrub}>{ticks.map((s) => <em key={s} style={{ left: s * pps }}>{s}s</em>)}</div>
              <div className="ve-row ve-r1">{lp.clips.filter(isVisual).map(block)}{!lp.clips.some(isVisual) && <p className="ve-hint">Add a clip or picture to begin</p>}</div>
              <div className="ve-row ve-r2">{lp.clips.filter((c) => !isVisual(c)).map(block)}</div>
              <div className="ve-row ve-r3">
                {project.texts.map((x) => (
                  <div key={x.id} className={`ve-block ve-text${sel?.id === x.id ? " is-sel" : ""}`} style={{ left: x.start * pps, width: Math.max(8, x.dur * pps) }} onPointerDown={(e) => drag(e, "text", x.id, "move")}>
                    <i className="ve-h ve-hl" onPointerDown={(e) => drag(e, "text", x.id, "l")} /><span>{x.text}</span><i className="ve-h ve-hr" onPointerDown={(e) => drag(e, "text", x.id, "r")} />
                  </div>
                ))}
              </div>
              <div className="ve-head" ref={headRef} style={{ left: t * pps }} />
            </div>
          </div>
        </div>

        <div className="cr-light-quick ve-tabs is-four" role="tablist" aria-label="Editor tools">
          {([["edit", "Edit"], ["audio", "Audio"], ["text", "Text"], ["ratio", "Ratio"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        {tab === "edit" && <>
          <div className="cr-light-quick ve-actions" role="group" aria-label="Edit">
            <button type="button" onClick={() => { setPicker(true); }}><Plus size={14} /> Add</button>
            <button type="button" onClick={split} disabled={!total}><Scissors size={14} /> Split</button>
            <button type="button" onClick={() => selClip && commit((p) => duplicateClip(p, selClip.id))} disabled={!selClip}><Copy size={14} /> Copy</button>
            <button type="button" onClick={del} disabled={!sel}><Trash2 size={14} /> Delete</button>
          </div>
          {selClip && selClip.kind !== "audio" ? <>
            <div className="cr-light-label">Speed</div>
            <div className="cr-light-quick ve-speeds" role="group" aria-label="Speed">{SPEEDS.map((s) => <button key={s} type="button" disabled={selClip.kind === "image"} className={selClip.speed === s ? "is-on" : ""} onClick={() => patchClip({ speed: s }, "spd")}>{s}x</button>)}</div>
            {selClip.kind === "image" && <Bar id="ve-len" label="Length" min={0.5} max={30} step={0.5} value={clipDur(selClip)} text={`${clipDur(selClip).toFixed(1)}s`} onChange={(v) => patchClip({ out: selClip.in + v }, "len")} />}
            {selClip.kind === "video" && <Bar id="ve-vol" label="Volume" min={0} max={100} value={Math.round(selClip.volume * 100)} unit="%" onChange={(v) => patchClip({ volume: v / 100 }, "vol")} />}
            <Bar id="ve-fi" label="Fade in" min={0} max={30} value={Math.round(selClip.fadeIn * 10)} text={`${selClip.fadeIn.toFixed(1)}s`} onChange={(v) => patchClip({ fadeIn: v / 10 }, "fi")} />
            <Bar id="ve-fo" label="Fade out" min={0} max={30} value={Math.round(selClip.fadeOut * 10)} text={`${selClip.fadeOut.toFixed(1)}s`} onChange={(v) => patchClip({ fadeOut: v / 10 }, "fo")} />
          </> : <p className="ve-note">Tap a clip on the timeline to change it. Drag its ends to trim, drag it to reorder.</p>}
        </>}

        {tab === "audio" && <>
          <div className="cr-light-quick ve-actions is-two" role="group" aria-label="Audio"><button type="button" onClick={() => setPicker(true)}><Plus size={14} /> Add sound</button><button type="button" onClick={del} disabled={!selClip || selClip.kind !== "audio"}><Trash2 size={14} /> Delete</button></div>
          {selClip && selClip.kind !== "image" ? <>
            <Bar id="ve-avol" label="Volume" min={0} max={100} value={Math.round(selClip.volume * 100)} unit="%" onChange={(v) => patchClip({ volume: v / 100 }, "vol")} />
            <Bar id="ve-afi" label="Fade in" min={0} max={30} value={Math.round(selClip.fadeIn * 10)} text={`${selClip.fadeIn.toFixed(1)}s`} onChange={(v) => patchClip({ fadeIn: v / 10 }, "fi")} />
            <Bar id="ve-afo" label="Fade out" min={0} max={30} value={Math.round(selClip.fadeOut * 10)} text={`${selClip.fadeOut.toFixed(1)}s`} onChange={(v) => patchClip({ fadeOut: v / 10 }, "fo")} />
          </> : <p className="ve-note">Add a voiceover, music or sound from the Library or your device. It starts where the playhead is.</p>}
        </>}

        {tab === "text" && <>
          <div className="cr-light-quick ve-actions is-two" role="group" aria-label="Text"><button type="button" onClick={addText}><Type size={14} /> Add title</button><button type="button" onClick={del} disabled={!selText}><Trash2 size={14} /> Delete</button></div>
          {selText ? <>
            <input className="cr-var-text" value={selText.text} onChange={(e) => patchText({ text: e.target.value }, "txt")} aria-label="Title text" />
            <Bar id="ve-tsz" label="Size" min={3} max={20} step={0.5} value={selText.size} unit="" onChange={(v) => patchText({ size: v }, "sz")} />
            <div className="cr-light-quick is-three" role="group" aria-label="Position">{([["Top", 0.15], ["Middle", 0.5], ["Bottom", 0.85]] as const).map(([l, y]) => <button key={l} type="button" className={selText.y === y ? "is-on" : ""} onClick={() => patchText({ y }, "y")}>{l}</button>)}</div>
            <div className="cr-light-colors ve-colors" role="group" aria-label="Colour">{COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} className={selText.color === c ? "is-on" : ""} style={{ background: c }} onClick={() => patchText({ color: c }, "col")} />)}</div>
          </> : <p className="ve-note">Add a title, then drag it on the timeline to set when it shows.</p>}
        </>}

        {tab === "ratio" && <div className="cr-light-quick ve-ratios" role="radiogroup" aria-label="Aspect ratio">{ASPECTS.map((a) => <button key={a} type="button" role="radio" aria-checked={project.aspect === a} className={project.aspect === a ? "is-on" : ""} onClick={() => commit((p) => ({ ...p, aspect: a }))}>{a}</button>)}</div>}

        {error && <div className="cr-var-err" role="alert">{error}</div>}
        <div className="cr-cam-actions">
          <button type="button" className="cr-var-go" onClick={() => void save()} disabled={!total || !!busy}>{busy ? <><Loader2 size={16} className="cr-spin" /> {busy.label} {Math.round(busy.f * 100)}%</> : "Save to Library"}</button>
          {busy && <button type="button" className="ve-cancel" onClick={() => abort.current?.abort()}>Cancel</button>}
        </div>
      </div>
      {picker && <AddSheet projectId={projectId} onPick={(p) => void add(p)} onClose={() => setPicker(false)} />}
    </div>
  );
}

function AddSheet({ projectId, onPick, onClose }: { projectId: string | null; onPick: (p: Pick) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"video" | "image" | "audio">("video");
  const renders = useRenders(projectId, 60).renders;
  const [sounds, setSounds] = useState<AudioItem[] | null>(null);
  useEffect(() => { let live = true; fetch("/api/audio", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (live) setSounds(Array.isArray(d.items) ? d.items : []); }).catch(() => { if (live) setSounds([]); }); return () => { live = false; }; }, []);
  const mine = (renders ?? []).filter((r) => r.status === "completed" && r.kind === tab);
  const takes = (sounds ?? []).filter((a) => a.status === "completed" && a.url && a.kind !== "stt");
  const fileInput = useRef<HTMLInputElement | null>(null);
  function device(f: File | undefined) {
    if (!f) return;
    const kind: Clip["kind"] = f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "image";
    onPick({ kind, src: URL.createObjectURL(f), name: f.name.replace(/\.[^.]+$/, "").slice(0, 40), dur: null });
  }
  return (
    <div className="ve-sheet-back" onClick={onClose}>
      <div className="ve-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add to the timeline">
        <div className="ve-sheet-top">
          <div className="ve-seg">
            {(["video", "image", "audio"] as const).map((k) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k === "video" ? <Film size={14} /> : k === "image" ? <ImageIcon size={14} /> : <Music size={14} />} {k === "video" ? "Videos" : k === "image" ? "Pictures" : "Sounds"}</button>)}
          </div>
          <span className="ve-grow" />
          <button type="button" className="ve-tool" onClick={() => fileInput.current?.click()}><Upload size={15} /> From device</button>
          <input ref={fileInput} type="file" hidden accept="video/*,image/*,audio/*" onChange={(e) => { device(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="ve-icon" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="ve-grid">
          {tab !== "audio" && mine.map((r) => (
            <button key={r.id} type="button" className="ve-tile" onClick={() => onPick({ kind: tab, src: `/api/generations/${r.id}/file`, name: (r.prompt || r.fileName || "Clip").slice(0, 40), dur: r.durationSec })}>
              {tab === "video" ? <video src={`/api/generations/${r.id}/file#t=0.1`} preload="metadata" muted playsInline /> : <img src={`/api/generations/${r.id}/thumb`} alt="" loading="lazy" />}
              {tab === "video" && r.durationSec ? <small>{Math.round(r.durationSec)}s</small> : null}
            </button>
          ))}
          {tab === "audio" && takes.map((a) => (
            <button key={a.id} type="button" className="ve-take" onClick={() => onPick({ kind: "audio", src: `/api/audio/${a.id}/file`, name: (a.text || a.modelLabel).slice(0, 40), dur: a.durationMs ? a.durationMs / 1000 : null })}>
              <Music size={16} /><span><b>{(a.text || a.modelLabel).slice(0, 70)}</b><em>{a.modelLabel}</em></span>
            </button>
          ))}
          {((tab !== "audio" && renders && !mine.length) || (tab === "audio" && sounds && !takes.length)) && <p className="ve-empty">Nothing here yet. Use From device to add a file.</p>}
        </div>
      </div>
    </div>
  );
}
