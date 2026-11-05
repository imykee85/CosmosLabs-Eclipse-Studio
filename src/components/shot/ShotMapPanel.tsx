"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Box, Car, Map as MapIcon, Pause, Play, Plus, RotateCcw, Trash2, User, Video, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import Bar from "../create/Bar";
import { cancelSandboxJob, followSandboxJob, startSandboxJob, type SandboxJobView } from "@/lib/sandbox-client";
import { ASPECTS, FEATURE_NAME, PALETTE, POSES, colorHex, type AspectId, type Pose } from "@/lib/shot/schema";
import { cameraAt } from "@/lib/shot/engine";
import { DEFAULT_SETUP, KITS, MAX_CAMERAS, MAX_CAST, MAX_OBJECTS, MOVE_GROUPS, OBJECTS, addCamera, camCount, camOf, editCam, groupOf, isCombinable, removeCamera, totalS, addObject, addPerson, removeObject, type ObjType, type SceneObject, addVehicleWithDriver, buildScene, colorName, removeCast, type CastItem, type PresetId, type Setup } from "@/lib/shot/setup";
import { shotPrompt } from "@/lib/shot/prompt";
import { uploadPicture } from "@/lib/use-uploads";
import "./shot.css";

export type GuideResult = { id: string; url: string; seconds: number; width: number | null; height: number | null };
export type ShotUse = { guide: GuideResult; prompt: string; aspect: AspectId; seconds: number };
const POSE_LABEL = (p: string) => p.replace("-", " ").replace(/^./, (c) => c.toUpperCase());
type Build = { drawAt: (s: number, t: number) => void; dispose: () => void };
type StageBuild = { drawAt: (t: number) => void; dispose: () => void };
type OrbitState = import("@/lib/shot/render-page").Orbit;

/** ShotMap: build a rough 3D blockout of a shot, choose the camera move, preview it, make a guide video and hand it to Video Studio. Laid out like Relight and Change Camera. */
export default function ShotMapPanel({ projectId, initialPreset, onUse, onClose }: { projectId: string | null; initialPreset?: PresetId; onUse: (use: ShotUse) => void; onClose: () => void }) {
  const [setup, setSetup] = useState<Setup>(() => ({ ...DEFAULT_SETUP, preset: initialPreset ?? DEFAULT_SETUP.preset }));
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<"shot" | "map" | "stage">("shot");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [look, setLook] = useState("");
  const [pic, setPic] = useState<{ id: string; url: string } | null>(null);
  const [rbPrompt, setRbPrompt] = useState("");
  const [rbBusy, setRbBusy] = useState(false);
  const [rbNote, setRbNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<"480" | "720">("480");
  const [flat, setFlat] = useState(false);
  const [job, setJob] = useState<SandboxJobView | null>(null);
  const [guide, setGuide] = useState<GuideResult | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const built = useRef<Build | null>(null);
  const stageCanvas = useRef<HTMLCanvasElement | null>(null);
  const stageBuilt = useRef<StageBuild | null>(null);
  const orbit = useRef<OrbitState | null>(null);
  const scene = useMemo(() => buildScene(setup), [setup]);
  const cast = setup.cast, item = cast[Math.min(sel, cast.length - 1)] ?? cast[0];
  const aspect = ASPECTS[setup.aspect], T = totalS(setup);
  const [ci0, setCi] = useState(0), ci = Math.min(ci0, camCount(setup) - 1), cam = camOf(setup, ci);
  const editC = (patch: Partial<import("@/lib/shot/setup").CamSetup>) => edit(editCam(setup, ci, patch));
  const changed = JSON.stringify({ ...setup, seed: 0 }) !== JSON.stringify({ ...DEFAULT_SETUP, preset: initialPreset ?? DEFAULT_SETUP.preset, seed: 0 });
  const running = !!job && !["succeeded", "failed", "canceled", "expired"].includes(job.status);

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => () => abort.current?.abort(), []);

  // the 3D preview: three.js is loaded when the panel opens; the scene is rebuilt when it changes (a handful of shapes) and drawn at the playhead
  const tRef = useRef(0); tRef.current = t;
  useEffect(() => {
    const el = canvas.current; if (!el || flat) return;
    let r: Build | null = null, gone = false;
    void import("@/lib/shot/render-page").then(({ build }) => {
      if (gone) return;
      try { r = build(scene, 640, Math.round(640 / aspect), el) as unknown as Build; built.current = r; drawShot(r, scene, Math.min(tRef.current, T - 0.001)); } catch { setFlat(true); }
    }).catch(() => setFlat(true));
    return () => { gone = true; r?.dispose(); if (built.current === r) built.current = null; if (el) void import("@/lib/shot/render-page").then(({ release }) => { if (!el.isConnected) release(el); }); };
  }, [scene, flat, aspect, T]);

  // the Stage view: the whole set from outside with the camera drawn as equipment and its view as a pyramid; drag to orbit, wheel or pinch to zoom
  useEffect(() => {
    const el = stageCanvas.current; if (view !== "stage" || !el || flat) return;
    let r: StageBuild | null = null, gone = false;
    void import("@/lib/shot/render-page").then(({ buildStage, fitOrbit }) => {
      if (gone) return;
      try { if (!orbit.current) orbit.current = fitOrbit(scene); r = buildStage(scene, el, 640, 512, orbit.current); stageBuilt.current = r; r.drawAt(Math.min(tRef.current, T - 0.001)); } catch { setFlat(true); }
    }).catch(() => setFlat(true));
    return () => { gone = true; r?.dispose(); if (stageBuilt.current === r) stageBuilt.current = null; void import("@/lib/shot/render-page").then(({ release }) => { if (!el.isConnected) release(el); }); };
  }, [scene, view, flat, aspect, T]);
  const redraw = useCallback(() => { stageBuilt.current?.drawAt(Math.min(tRef.current, T - 0.001)); }, [T]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const onStageDown = (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch.current = 0; };
  const onStageMove = (e: React.PointerEvent) => {
    const o = orbit.current, p = pointers.current.get(e.pointerId); if (!o || !p) return;
    const prev = { ...p }; p.x = e.clientX; p.y = e.clientY;
    if (pointers.current.size >= 2) { const [a, b] = [...pointers.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch.current) o.dist = Math.min(80, Math.max(2.5, o.dist * (pinch.current / d))); pinch.current = d; }
    else { o.az -= (e.clientX - prev.x) * 0.008; o.el = Math.min(1.45, Math.max(0.05, o.el + (e.clientY - prev.y) * 0.008)); }
    redraw();
  };
  const onStageUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); pinch.current = 0; };
  const onStageWheel = (e: React.WheelEvent) => { const o = orbit.current; if (!o) return; o.dist = Math.min(80, Math.max(2.5, o.dist * (1 + e.deltaY * 0.001))); redraw(); };
  useEffect(() => { if (built.current) drawShot(built.current, scene, Math.min(t, T - 0.001)); stageBuilt.current?.drawAt(Math.min(t, T - 0.001)); }, [t, T]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { const dt = (now - last) / 1000; last = now; setT((x) => { const n = x + dt; return n >= T ? 0 : n; }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [playing, T]);

  const edit = useCallback((patch: Partial<Setup>) => { setSetup((s) => ({ ...s, ...patch })); setGuide(null); setError(""); }, []);
  const editItem = (patch: Partial<CastItem>) => edit({ cast: cast.map((m, i) => (i === Math.min(sel, cast.length - 1) ? { ...m, ...patch } : m)) });
  const objects: SceneObject[] = setup.objects ?? [];
  const [osel, setOsel] = useState(0);
  const obj = objects[Math.min(osel, objects.length - 1)];
  const editObj = (patch: Partial<SceneObject>) => edit({ objects: objects.map((o) => (o.id === obj?.id ? { ...o, ...patch } : o)) });
  const addP = () => { const n = addPerson(setup); if (n !== setup) { edit(n); setSel(n.cast.length - 1); } };
  const addV = () => { const n = addVehicleWithDriver(setup); if (n !== setup) { edit(n); setSel(setup.cast.length); } };
  const remove = () => { if (cast.length < 2 || !item) return; edit(removeCast(setup, item.id)); setSel(0); };
  const reset = () => { orbit.current = null; setSetup({ ...DEFAULT_SETUP, preset: initialPreset ?? DEFAULT_SETUP.preset }); setSel(0); setT(0); setGuide(null); };

  async function pickPicture(file: File | undefined) {
    if (!file) return;
    setRbNote(""); setError(""); setRbBusy(true);
    const r = await uploadPicture(file, "asset", file.name.slice(0, 80) || "Scene picture", projectId ?? null);
    setRbBusy(false);
    if (!r.ok || !r.item) { setError(r.ok ? "The picture could not be added." : r.error); return; }
    setPic({ id: r.item.id, url: URL.createObjectURL(file) });
  }
  async function rebuild() {
    setError(""); setRbNote(""); setRbBusy(true);
    try {
      const res = await fetch("/api/shot/rebuild", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId: pic?.id, prompt: rbPrompt }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.setup) { setError(data.error ?? "The scene could not be rebuilt. Please try again."); return; }
      orbit.current = null;
      setSetup((cur) => ({ ...data.setup, preset: cur.preset, preset2: cur.preset2, combine: cur.combine, split: cur.split, rotate: cur.rotate, speed: cur.speed, durationS: cur.durationS, shake: cur.shake, more: cur.more, aspect: cur.aspect }));
      setSel(0); setT(0); setGuide(null);
      setRbNote(`Rebuilt with ${data.people} ${data.people === 1 ? "person" : "people"} and ${data.objects} ${data.objects === 1 ? "object" : "objects"}. Check it, then choose your camera moves.`);
    } finally { setRbBusy(false); }
  }

  async function make() {
    setError(""); setGuide(null); setPlaying(false);
    const r = await startSandboxJob("media.shotguide", { scene, res, ...(projectId ? { projectId } : {}) });
    if (!r.ok) { setError(r.error); return; }
    setJob(r.job); abort.current = new AbortController();
    const done = r.job.status === "succeeded" ? r.job : await followSandboxJob(r.job.id, setJob, abort.current.signal);
    if (!done) { setError("The guide could not be followed. Check your Gallery in a moment."); setJob(null); return; }
    setJob(done);
    const o = done.output as { generationId?: string; url?: string; durationSec?: number; width?: number; height?: number } | null;
    if (done.status === "succeeded" && o?.generationId && o.url) setGuide({ id: o.generationId, url: o.url, seconds: o.durationSec ?? T, width: o.width ?? null, height: o.height ?? null });
    else setError(done.error?.message ?? "The guide video could not be made.");
  }
  const stop = async () => { if (job) await cancelSandboxJob(job.id); abort.current?.abort(); setJob(null); };
  const camNow = cameraAt(scene, activeCamera(scene, t), Math.min(t, T - 0.001), setup.aspect);

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-cam cr-light sm-panel" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          <span className="sm-badge"><Video size={20} /></span>
          <div><h2>{FEATURE_NAME}</h2><p>Direct the shot in 3D, then generate it</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-light-label">Rebuild from a picture</div>
        <div className="sm-rebuild">
          <input ref={fileRef} type="file" hidden onChange={(e) => { void pickPicture(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="sm-rb-top">
            <button type="button" className="sm-rb-pic" onClick={() => fileRef.current?.click()} aria-label="Add a picture" disabled={rbBusy}>
              {pic ? <img src={pic.url} alt="Your scene picture" /> : <Plus size={20} />}
            </button>
            <GrowArea className="cr-var-text" rows={2} value={rbPrompt} onChange={(e) => setRbPrompt(e.target.value)} placeholder="Paste the video prompt (optional)" />
          </div>
          <button type="button" className="cr-var-go sm-rb-go" disabled={rbBusy || (!pic && !rbPrompt.trim())} onClick={() => void rebuild()}>{rbBusy ? "Working" : "Rebuild the scene"}</button>
          {rbNote && <p className="cr-cam-tip">{rbNote}</p>}
        </div>

        <div className="cr-light-label">Shot preview</div>
        <div className="cr-cam-stage sm-stage">
          {changed && <button type="button" className="cr-light-reset" onClick={reset} aria-label="Reset the shot"><RotateCcw size={16} /></button>}
          {!flat && <canvas ref={canvas} className={view === "shot" ? "sm-canvas" : view === "stage" ? "sm-inset" : "sm-hidden"} aria-label="Shot preview" />}
          {view === "stage" && !flat && <canvas ref={stageCanvas} className="sm-canvas sm-orbit" aria-label="Stage view: drag to look around" onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp} onWheel={onStageWheel} />}
          {view !== "map" && flat && <div className="cr-light-flat">The 3D preview isn&apos;t available on this device. You can still make the guide video.</div>}
          {view === "map" && <MapView setup={setup} scene={scene} t={t} onMove={(id, patch) => (id.startsWith("o") && objects.some((o) => o.id === id) ? edit({ objects: objects.map((o) => (o.id === id ? { ...o, x: patch.x ?? o.x, z: patch.z ?? o.z } : o)) }) : edit({ cast: cast.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))} onSelect={(id) => setSel(Math.max(0, cast.findIndex((m) => m.id === id)))} sel={item?.id} />}
          <span className="sm-lens" aria-hidden>{Math.round(camNow.lensMm)} mm</span>
        </div>
        <div className="sm-play">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <input type="range" min={0} max={T} step={0.04} value={Math.min(t, T)} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Playhead" />
          <output>{t.toFixed(1)} / {T} s</output>
          <div className="sm-view" role="group" aria-label="View">
            <button type="button" className={view === "shot" ? "is-on" : ""} onClick={() => setView("shot")}><Video size={14} /> Shot</button>
            <button type="button" className={view === "stage" ? "is-on" : ""} onClick={() => setView("stage")}><Box size={14} /> Stage</button>
            <button type="button" className={view === "map" ? "is-on" : ""} onClick={() => setView("map")}><MapIcon size={14} /> Map</button>
          </div>
        </div>

        <div className="cr-light-label">Camera</div>
        <div className="cr-light-row">
          <div className="cr-light-tabs" role="tablist" aria-label="Cameras">
            {Array.from({ length: camCount(setup) }, (_, i) => <button key={i} type="button" role="tab" aria-selected={i === ci} className={i === ci ? "is-on" : ""} onClick={() => setCi(i)}>{i + 1}</button>)}
            {camCount(setup) < MAX_CAMERAS && T < 28 && <button type="button" onClick={() => { const n = addCamera(setup); if (n !== setup) { edit(n); setCi(camCount(n) - 1); } }} aria-label="Add a camera"><Plus size={14} /></button>}
            {camCount(setup) > 1 && <button type="button" onClick={() => { edit(removeCamera(setup, ci)); setCi(0); }} aria-label="Remove this camera"><Trash2 size={14} /></button>}
          </div>
        </div>
        {camCount(setup) > 1 && <p className="cr-cam-tip">The cameras cut one after the other: camera {ci + 1} runs for {cam.durationS} s of the {T} s.</p>}
        <div className="cr-light-label">Camera move</div>
        <MovePicker label="Camera move" value={cam.preset === "static" ? null : cam.preset} onChange={(id) => { if (!id) { editC({ preset: "static", preset2: null }); return; } editC({ preset: id, ...(isCombinable(id) ? {} : { preset2: null }) }); }} />
        {isCombinable(cam.preset) && (
          <>
            <div className="cr-light-label">Add a second move</div>
            <MovePicker label="Second move" value={cam.preset2 ?? null} none exclude={cam.preset} combinableOnly onChange={(id) => editC({ preset2: id })} />
            {cam.preset2 && (
              <>
                <div className="cr-light-quick is-three sm-moves" role="group" aria-label="How the moves combine">
                  <button type="button" className={(cam.combine ?? "together") === "together" ? "is-on" : ""} onClick={() => editC({ combine: "together" })}>At the same time</button>
                  <button type="button" className={cam.combine === "then" ? "is-on" : ""} onClick={() => editC({ combine: "then" })}>One after the other</button>
                </div>
                {cam.combine === "then" && <Bar id="sm-split" label="Switches at" min={10} max={90} value={Math.round((cam.split ?? 0.5) * 100)} unit="%" onChange={(v) => editC({ split: v / 100 })} />}
              </>
            )}
          </>
        )}
        <Bar id="sm-rot" label="Rotate" min={0} max={359} value={Math.round(cam.rotate ?? 0)} unit="°" onChange={(v) => editC({ rotate: v })} />
        <Bar id="sm-vert" label="Vertical" min={-30} max={80} value={Math.round(cam.vertical ?? 0)} unit="°" onChange={(v) => editC({ vertical: v })} />
        <Bar id="sm-d" label="Distance" min={1} max={20} step={0.1} value={cam.distance} text={`${cam.distance.toFixed(1)} m`} onChange={(v) => editC({ distance: v })} />
        <Bar id="sm-speed" label="Speed" min={25} max={300} value={Math.round((cam.speed ?? 1) * 100)} unit="%" onChange={(v) => editC({ speed: v / 100 })} />
        <Bar id="sm-lens" label="Lens" min={12} max={120} value={cam.lensMm} unit="mm" onChange={(v) => editC({ lensMm: v })} />
        <Bar id="sm-t" label="Length" min={2} max={Math.max(2, 30 - (T - cam.durationS))} value={cam.durationS} unit="s" onChange={(v) => { editC({ durationS: v }); setT(0); }} />
        <Bar id="sm-s" label="Handheld shake" min={0} max={100} value={Math.round(cam.shake * 100)} unit="%" onChange={(v) => editC({ shake: v / 100 })} />

        <details className="sm-edit" open={editOpen} onToggle={(e) => setEditOpen(e.currentTarget.open)}>
        <summary>Edit scene</summary>
        <div className="cr-light-label">Set</div>
        <div className="cr-light-quick sm-kits" role="group" aria-label="Set">
          {KITS.map((k) => <button key={k.id} type="button" className={setup.kit === k.id ? "is-on" : ""} onClick={() => edit({ kit: k.id })}>{k.label}</button>)}
        </div>

        <div className="cr-light-label">Cast</div>
        <div className="cr-light-row">
          <div className="cr-light-tabs" role="tablist" aria-label="Cast">
            {cast.map((m, i) => (
              <button key={m.id} type="button" role="tab" aria-selected={i === Math.min(sel, cast.length - 1)} className={i === Math.min(sel, cast.length - 1) ? "is-on" : ""} onClick={() => setSel(i)} title={`${colorName(m.color)} ${m.kind}`}>
                {m.kind === "vehicle" ? <Car size={13} /> : <User size={13} />}<i style={{ background: colorHex(m.color) }} />
              </button>
            ))}
            {cast.length < MAX_CAST && <button type="button" onClick={addP} aria-label="Add a person"><Plus size={14} /><User size={13} /></button>}
            {cast.length < MAX_CAST - 1 && <button type="button" onClick={addV} aria-label="Add a vehicle with a driver"><Plus size={14} /><Car size={13} /></button>}
            {cast.length > 1 && <button type="button" onClick={remove} aria-label="Remove this one"><Trash2 size={14} /></button>}
          </div>
        </div>
        {item && (
          <div className="sm-cast">
            <input className="cr-var-text" value={item.label} maxLength={60} onChange={(e) => editItem({ label: e.target.value })} placeholder={item.kind === "vehicle" ? `Who or what is the ${colorName(item.color)} vehicle? For example: a rusty pickup` : `Who is the ${colorName(item.color)} figure? For example: a barista in her thirties`} aria-label="Who is this" />
            {item.kind === "person" && !item.rides && (
              <div className="cr-light-quick sm-build" role="group" aria-label="Body">
                {(["man", "woman"] as const).map((b) => <button key={b} type="button" className={item.build === b ? "is-on" : ""} onClick={() => editItem({ build: b })}>{b === "man" ? "Man" : "Woman"}</button>)}
              </div>
            )}
            {item.kind === "person" && !item.rides && (
              <div className="cr-light-opts">
                <label className="cr-light-chip" aria-label="Pose"><User size={14} /><select value={item.pose} onChange={(e) => editItem({ pose: e.target.value as Pose })}>{POSES.filter((p) => p !== "driving").map((p) => <option key={p} value={p}>{POSE_LABEL(p)}</option>)}</select></label>
                <label className="cr-light-chip" aria-label="Then"><User size={14} /><select value={item.pose2 ?? ""} onChange={(e) => editItem({ pose2: (e.target.value || null) as Pose | null })}><option value="">No change</option>{POSES.filter((p) => p !== "driving").map((p) => <option key={p} value={p}>Then {POSE_LABEL(p).toLowerCase()}</option>)}</select></label>
              </div>
            )}
            {item.kind === "person" && !item.rides && item.pose2 && <Bar id="sm-p2" label="Changes at" min={1} max={Math.max(2, T - 1)} value={Math.min(item.pose2At, Math.max(2, T - 1))} unit="s" onChange={(v) => editItem({ pose2At: v })} />}
            {item.kind === "person" && !item.rides && item.pose2 && (item.extra ?? []).map((x, i) => (
              <div key={i} className="sm-extra">
                <div className="cr-light-opts">
                  <label className="cr-light-chip" aria-label={`Action ${i + 3}`}><User size={14} /><select value={x.pose} onChange={(e) => editItem({ extra: (item.extra ?? []).map((q, k) => (k === i ? { ...q, pose: e.target.value as Pose } : q)) })}>{POSES.filter((p) => p !== "driving").map((p) => <option key={p} value={p}>Then {POSE_LABEL(p).toLowerCase()}</option>)}</select></label>
                  <button type="button" className="cr-light-chip" onClick={() => editItem({ extra: (item.extra ?? []).filter((_, k) => k !== i) })} aria-label="Remove this action"><X size={14} /></button>
                </div>
                <Bar id={`sm-x${i}`} label="Changes at" min={1} max={Math.max(2, T - 1)} value={Math.min(x.at, Math.max(2, T - 1))} unit="s" onChange={(v) => editItem({ extra: (item.extra ?? []).map((q, k) => (k === i ? { ...q, at: v } : q)) })} />
              </div>
            ))}
            {item.kind === "person" && !item.rides && item.pose2 && (item.extra ?? []).length < 3 && <button type="button" className="sm-addact" onClick={() => editItem({ extra: [...(item.extra ?? []), { pose: "standing", at: Math.min(T - 1, Math.max(item.pose2At, ...(item.extra ?? []).map((q) => q.at)) + 2) }] })}><Plus size={14} /> Add another action</button>}
            {!item.rides && (
              <>
                <Bar id="sm-x" label="Left / right" min={-12} max={12} step={0.1} value={item.x} text={`${item.x.toFixed(1)} m`} onChange={(v) => editItem({ x: v })} />
                <Bar id="sm-z" label="Near / far" min={-12} max={12} step={0.1} value={item.z} text={`${item.z.toFixed(1)} m`} onChange={(v) => editItem({ z: v })} />
                <div className="cr-light-quick is-three sm-moves"><button type="button" className={item.moves ? "is-on" : ""} onClick={() => editItem({ moves: !item.moves })}>{item.kind === "vehicle" ? "Drives" : "Walks"}</button></div>
                {item.moves && <>
                  <Bar id="sm-tx" label="To left / right" min={-40} max={60} step={0.1} value={item.toX} text={`${item.toX.toFixed(1)} m`} onChange={(v) => editItem({ toX: v })} />
                  <Bar id="sm-tz" label="To near / far" min={-12} max={12} step={0.1} value={item.toZ} text={`${item.toZ.toFixed(1)} m`} onChange={(v) => editItem({ toZ: v })} />
                </>}
              </>
            )}
            {item.rides && <p className="cr-cam-tip">Sits in the vehicle and goes where it goes.</p>}
          </div>
        )}

        <div className="cr-light-label">Objects</div>
        <div className="cr-light-row">
          <div className="cr-light-tabs" role="tablist" aria-label="Objects">
            {objects.map((o, i) => <button key={o.id} type="button" role="tab" aria-selected={i === osel} className={i === osel ? "is-on" : ""} onClick={() => setOsel(i)}><Armchair size={13} /> {OBJECTS.find((d) => d.id === o.type)?.label}</button>)}
            {objects.length < MAX_OBJECTS && (
              <label className="cr-light-chip sm-addobj" aria-label="Add an object"><Plus size={14} /><select value="" onChange={(e) => { if (!e.target.value) return; const n = addObject(setup, e.target.value as ObjType); edit(n); setOsel((n.objects ?? []).length - 1); }}><option value="">Add object</option>{OBJECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
            )}
            {obj && <button type="button" onClick={() => { edit(removeObject(setup, obj.id)); setOsel(0); }} aria-label="Remove this object"><Trash2 size={14} /></button>}
          </div>
        </div>
        {obj && (
          <div className="sm-cast">
            <Bar id="sm-ox" label="Left / right" min={-12} max={12} step={0.1} value={obj.x} text={`${obj.x.toFixed(1)} m`} onChange={(v) => editObj({ x: v })} />
            <Bar id="sm-oz" label="Near / far" min={-12} max={12} step={0.1} value={obj.z} text={`${obj.z.toFixed(1)} m`} onChange={(v) => editObj({ z: v })} />
            <Bar id="sm-or" label="Turn" min={0} max={359} value={obj.rot} unit="°" onChange={(v) => editObj({ rot: v })} />
            <Bar id="sm-os" label="Size" min={0.3} max={3} step={0.1} value={obj.scale} text={`${obj.scale.toFixed(1)}x`} onChange={(v) => editObj({ scale: v })} />
          </div>
        )}

        </details>

        <GrowArea className="cr-var-text" rows={1} value={look} onChange={(e) => setLook(e.target.value)} placeholder="The look (optional), for example: a rooftop at dusk, warm light, 35 mm film" />

        {error && <div className="cr-var-err">{error}</div>}
        {guide ? (
          <div className="sm-guide">
            <video src={guide.url} controls muted playsInline loop preload="metadata" aria-label="Guide video" />
            <div className="cr-cam-actions">
              <button type="button" className="cr-var-go" onClick={() => onUse({ guide, prompt: shotPrompt(setup, { look }), aspect: setup.aspect, seconds: setup.durationS })}>Use in Video Studio</button>
            </div>
          </div>
        ) : (
          <>
          <div className="cr-light-label">Quality</div>
          <div className="cr-light-quick sm-quality" role="group" aria-label="Guide quality">
            <button type="button" className={res === "480" ? "is-on" : ""} onClick={() => setRes("480")}>480p</button>
            <button type="button" className={res === "720" ? "is-on" : ""} onClick={() => setRes("720")}>720p</button>
          </div>
          <div className="cr-cam-actions sm-make">
                        {running
              ? <button type="button" className="cr-var-go" onClick={() => void stop()}>{job?.message ? `${job.message.slice(0, 40)} · Cancel` : "Making the guide · Cancel"}</button>
              : <button type="button" className="cr-var-go" onClick={() => void make()}>Make guide video</button>}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The top-down map: the cast where they start and where they go, and the camera's path with its view at the playhead. Drag a dot to move it. */
function MapView({ setup, scene, t, onMove, onSelect, sel }: { setup: Setup; scene: ReturnType<typeof buildScene>; t: number; onMove: (id: string, patch: Partial<CastItem>) => void; onSelect: (id: string) => void; sel?: string }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const frozen = useRef<{ x0: number; z0: number; w: number; h: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; to: boolean } | null>(null);
  const pts: [number, number][] = [];
  for (const o of setup.objects ?? []) pts.push([o.x, o.z]);
  for (const m of setup.cast) { pts.push([m.x, m.z]); if (m.moves) pts.push([m.toX, m.toZ]); }
  for (const cm of scene.cameras) for (const k of cm.keys) pts.push([k.pos[0], k.pos[2]]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const live = { x0: Math.min(...xs, -4) - 2, z0: Math.min(...zs, -4) - 2, x1: Math.max(...xs, 4) + 2, z1: Math.max(...zs, 4) + 2 };
  const box = drag && frozen.current ? frozen.current : { x0: live.x0, z0: live.z0, w: live.x1 - live.x0, h: live.z1 - live.z0 };
  const size = Math.max(box.w, box.h), vb = `${box.x0} ${box.z0} ${size} ${size}`, r = size / 55;
  const world = (e: React.PointerEvent) => { const el = svg.current!, m = el.getScreenCTM()!.inverse(), p = el.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m); return { x: Math.round(q.x * 10) / 10, z: Math.round(q.y * 10) / 10 }; };
  const activeCam = activeCamera(scene, t), c = cameraAt(scene, activeCam, Math.min(t, totalS(setup) - 0.001), setup.aspect);
  const ang = Math.atan2(c.lookAt[0] - c.pos[0], c.lookAt[2] - c.pos[2]), half = (c.fov * Math.PI) / 360 * ASPECTS[setup.aspect], len = size * 0.18;
  const paths = scene.cameras.map((cm) => cm.keys.map((k) => `${k.pos[0]},${k.pos[2]}`).join(" "));
  const grid: number[] = []; for (let g = Math.ceil(box.x0 / 2) * 2; g < box.x0 + size; g += 2) grid.push(g);
  const gridZ: number[] = []; for (let g = Math.ceil(box.z0 / 2) * 2; g < box.z0 + size; g += 2) gridZ.push(g);
  return (
    <svg ref={svg} viewBox={vb} className="sm-map" role="img" aria-label="Top-down map of the shot"
      onPointerMove={(e) => { if (!drag) return; const w = world(e); onMove(drag.id, drag.to ? { toX: w.x, toZ: w.z } : { x: w.x, z: w.z }); }}
      onPointerUp={() => { setDrag(null); frozen.current = null; }} onPointerCancel={() => { setDrag(null); frozen.current = null; }}>
      {grid.map((g) => <line key={"x" + g} x1={g} y1={box.z0} x2={g} y2={box.z0 + size} className="sm-grid" />)}
      {gridZ.map((g) => <line key={"z" + g} x1={box.x0} y1={g} x2={box.x0 + size} y2={g} className="sm-grid" />)}
      {paths.map((pt, i) => <polyline key={i} points={pt} className="sm-campath" />)}
      <path d={`M ${c.pos[0]} ${c.pos[2]} L ${c.pos[0] + len * Math.sin(ang - half)} ${c.pos[2] + len * Math.cos(ang - half)} L ${c.pos[0] + len * Math.sin(ang + half)} ${c.pos[2] + len * Math.cos(ang + half)} Z`} className="sm-fov" />
      <circle cx={c.pos[0]} cy={c.pos[2]} r={r * 0.9} className="sm-cam" />
      {(setup.objects ?? []).map((o) => { const f = OBJECTS.find((d) => d.id === o.type)?.foot ?? [1, 1]; const w = f[0] * o.scale, d = f[1] * o.scale; return (
        <g key={o.id} transform={`translate(${o.x} ${o.z}) rotate(${-o.rot})`} className="sm-drag" onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); frozen.current = { x0: live.x0, z0: live.z0, w: live.x1 - live.x0, h: live.z1 - live.z0 }; setDrag({ id: o.id, to: false }); }}>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="rgba(160,166,176,.55)" stroke="rgba(255,255,255,.7)" strokeWidth={r * 0.25} rx={r * 0.3} />
        </g>
      ); })}
      {setup.cast.filter((m) => !m.rides).map((m) => (
        <g key={m.id}>
          {m.moves && <line x1={m.x} y1={m.z} x2={m.toX} y2={m.toZ} stroke={colorHex(m.color)} strokeWidth={r * 0.35} strokeDasharray={`${r} ${r}`} />}
          {m.moves && <circle cx={m.toX} cy={m.toZ} r={r} fill="none" stroke={colorHex(m.color)} strokeWidth={r * 0.4} className="sm-drag" onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); frozen.current = { x0: live.x0, z0: live.z0, w: live.x1 - live.x0, h: live.z1 - live.z0 }; setDrag({ id: m.id, to: true }); onSelect(m.id); }} />}
          <circle cx={m.x} cy={m.z} r={r * (m.kind === "vehicle" ? 1.5 : 1.1)} fill={colorHex(m.color)} stroke={sel === m.id ? "#fff" : "rgba(255,255,255,.5)"} strokeWidth={r * 0.35} className="sm-drag"
            onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); frozen.current = { x0: live.x0, z0: live.z0, w: live.x1 - live.x0, h: live.z1 - live.z0 }; setDrag({ id: m.id, to: false }); onSelect(m.id); }} />
        </g>
      ))}
    </svg>
  );
}
export { PALETTE };


/** Dolly, Truck, Crane...: tap a group for a list of options; tap a chosen group again to clear it. */
function MovePicker({ label, value, onChange, exclude, combinableOnly }: { label: string; value: import("@/lib/shot/setup").PresetId | null; onChange: (id: import("@/lib/shot/setup").PresetId | null) => void; none?: boolean; exclude?: import("@/lib/shot/setup").PresetId; combinableOnly?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const groups = MOVE_GROUPS.map((g) => ({ ...g, options: g.options.filter((o) => o.id !== exclude && (!combinableOnly || isCombinable(o.id))) })).filter((g) => g.options.length);
  return (
    <div className="cr-light-quick sm-presets" role="group" aria-label={label} ref={wrap}>
      {groups.map((x) => {
        const chosen = value ? x.options.find((o) => o.id === value) : undefined;
        return (
          <div key={x.id} className="sm-mv">
            <button type="button" className={chosen ? "is-on" : ""} aria-haspopup="listbox" aria-expanded={open === x.id}
              onClick={() => { if (chosen) { setOpen(null); onChange(null); } else setOpen(open === x.id ? null : x.id); }}>
              <span>{x.label}</span>{chosen && <small>{chosen.label}</small>}
            </button>
            {open === x.id && (
              <ul className="sm-menu" role="listbox" aria-label={`${label}: ${x.label}`}>
                {x.options.map((o) => <li key={o.id} role="option" aria-selected={value === o.id}><button type="button" onClick={() => { setOpen(null); onChange(o.id); }}>{o.label}</button></li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The camera that is rolling at time t, and the shot it belongs to. */
function activeCamera(scene: ReturnType<typeof buildScene>, t: number) {
  const sh = scene.shots.find((x) => t >= x.startS && t < x.endS) ?? scene.shots[scene.shots.length - 1];
  return scene.cameras.find((c) => c.id === sh.cameraId) ?? scene.cameras[0];
}
function drawShot(r: { drawAt: (s: number, t: number) => void }, scene: ReturnType<typeof buildScene>, t: number) {
  let i = scene.shots.findIndex((x) => t >= x.startS && t < x.endS); if (i < 0) i = scene.shots.length - 1;
  r.drawAt(i, Math.max(0, t - scene.shots[i].startS));
}
