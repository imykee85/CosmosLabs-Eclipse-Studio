"use client";

// ShotMap: build a 3D scene (by hand or by asking), design camera moves with keyframes, look through the camera, take stills, then record the move
// and hand it to Video Studio as the camera-motion reference. Three modes: Compose (build and arrange), Shoot (stills through a camera), Motion (camera keyframes on a timeline).
import { MovesPanel } from "./MovesPanel";
import { DEFAULT_MOVES, movesToKeys, type MovesState } from "@/lib/shot/moves";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Box, Camera, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, ChevronUp, Copy, Crosshair, Download, Expand, Focus, Maximize2, Minimize2,
  MessageSquare, Paperclip, Pause, Play, Plus, Redo2, Repeat, Scissors, Send, Smartphone, Spline, Trash2, Undo2, User, X, LayoutList,
} from "lucide-react";
import GrowArea from "@/components/GrowArea";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import { useModels } from "@/lib/use-models";
import { useUploads, uploadPicture, uploadVideo } from "@/lib/use-uploads";
import { startImages } from "@/lib/image-render";
import { toolModel, toolTier } from "@/lib/picture-tools";
import { FEATURE_NAME, POSES, type Pose } from "@/lib/shot/schema";
import {
  ASPECT_LIST, ASPECT_RATIO, EASES, FSTOPS, LENSES, MAX_SHOT_S, addCamera, addGroup, addItem, addShot, cameraAt, cameraOf, clamp, duplicateItem, duplicateShot, editCamera, editCameraKey,
  editItem, editShot, emptyWorld, fovFor, itemAt, moveCameraKey, r2, removeCamera, removeCameraKey, removeGroup, removeItem, removeItemKey, removeShot, setCameraKey, setItemKey, shotOf,
  splitShot, worldPrompt, worldRefs, type CamKey, type Ease, type Item, type NewItem, type Vec3, type WAspect, type World,
} from "@/lib/shot/world";
import { TEMPLATES, deleteScene, listModels, listScenes, loadScene, newSceneId, putModel, recentAdds, rememberAdd, saveScene, type ModelEntry, type SceneEntry } from "@/lib/shot/world-store";
import type { WorldView, Pick, FreeCam } from "@/lib/shot/world-view";
import type { Assets } from "@/lib/shot/render-page";
import { AddPanel, CameraPopover, Inspector, LensRow, Outliner, SketchPad, StartScreen, itemIcon, label, type StartChoice } from "./parts";
import "./shot-studio.css";

export type GuideResult = { id: string; url: string; seconds: number; width: number | null; height: number | null };
export type ShotUse = { guide: GuideResult; prompt: string; aspect: string; seconds: number; refs: RefPick[] };
type Mode = "compose" | "shoot" | "motion";
type IKey = { id: string; index: number } | null;
type Capture = { key: string; status: "pending" | "done" | "failed"; id?: string; url?: string; error?: string; preview: string };
const STYLES = [{ id: "natural", label: "Natural", text: "natural, true-to-life photograph" }, { id: "cinematic", label: "Cinematic", text: "cinematic film still, dramatic grade, anamorphic feel" }, { id: "anime", label: "Anime", text: "hand-drawn anime frame, clean line art, cel shading" }];
const DEPTH_WORD = (f: number) => (f <= 2 ? "Very shallow · Portraits" : f <= 4 ? "Shallow · Subjects" : f <= 8 ? "Medium · Everyday" : f <= 11 ? "Deep · Landscapes" : "Very deep · Architecture");
const HISTORY = 60;

async function frameFromVideo(url: string, at: number): Promise<string | null> {
  return new Promise((res) => {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous"; v.src = url;
    const done = (x: string | null) => { v.removeAttribute("src"); v.load(); res(x); };
    const timer = setTimeout(() => done(null), 12000);
    v.onloadedmetadata = () => { v.currentTime = Math.max(0, Math.min(v.duration - 0.05, v.duration * at)); };
    v.onseeked = () => { try { const c = document.createElement("canvas"), k = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height); clearTimeout(timer); done(c.toDataURL("image/jpeg", 0.8)); } catch { clearTimeout(timer); done(null); } };
    v.onerror = () => { clearTimeout(timer); done(null); };
  });
}
function imageAspect(url: string): Promise<number> {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth && i.naturalHeight ? i.naturalWidth / i.naturalHeight : 1); i.onerror = () => res(1); i.src = url; });
}

export default function ShotStudio({ projectId, onUse, onClose }: { projectId: string | null; onUse: (u: ShotUse) => void; onClose: () => void }) {
  // ---- the scene and its history ----
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [world, setWorldState] = useState<World>(() => emptyWorld());
  const past = useRef<World[]>([]), future = useRef<World[]>([]);
  const [, bump] = useState(0);
  const worldRef = useRef(world); worldRef.current = world;
  const commit = useCallback((next: World | ((w: World) => World)) => {
    setWorldState((cur) => { const n = typeof next === "function" ? next(cur) : next; if (n === cur) return cur; past.current = [...past.current.slice(-HISTORY + 1), cur]; future.current = []; return n; });
    bump((x) => x + 1);
  }, []);
  const undo = useCallback(() => { const p = past.current.pop(); if (!p) return; future.current.push(worldRef.current); setWorldState(p); bump((x) => x + 1); }, []);
  const redo = useCallback(() => { const f = future.current.pop(); if (!f) return; past.current.push(worldRef.current); setWorldState(f); bump((x) => x + 1); }, []);

  const [stage, setStage] = useState<"start" | "editor">("start");
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [mode, setMode] = useState<Mode>("compose");
  const [sel, setSel] = useState<Pick>(null);
  const [ikey, setIkey] = useState<IKey>(null);
  const [gizmo, setGizmo] = useState<"translate" | "rotate" | "scale">("translate");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [camEdit, setCamEdit] = useState<{ camId: string; index: number } | null>(null);
  const [focusPick, setFocusPick] = useState(false);
  const [panel, setPanel] = useState<"outliner" | "add" | null>("outliner");
  const [inspector, setInspector] = useState(true);
  const [previewBig, setPreviewBig] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [addMenu, setAddMenu] = useState(false);
  const [shotMenu, setShotMenu] = useState(false);
  const [easeMenu, setEaseMenu] = useState(false);
  const [useMenu, setUseMenu] = useState(false);
  const [record, setRecord] = useState<{ done: number; total: number; label: string } | null>(null);
  const recordAbort = useRef<AbortController | null>(null);
  const [recQuality, setRecQuality] = useState<"480p" | "720p">("720p");
  // pickers
  const [picker, setPicker] = useState<null | "start-images" | "start-video" | "character" | "link-character" | "image" | "shoot-refs">(null);
  const [startPicked, setStartPicked] = useState<RefPick[]>([]);
  const [startVideo, setStartVideo] = useState<RefPick | null>(null);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [sketching, setSketching] = useState(false);
  // shoot
  const [shoot, setShoot] = useState({ style: "natural", lens: 35, fStop: 11, focus: 6, quality: "fast" as "fast" | "high", tab: null as null | "style" | "frame" | "lens" | "depth" });
  const [shootText, setShootText] = useState("");
  const [shootRefs, setShootRefs] = useState<RefPick[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [viewing, setViewing] = useState<Capture | null>(null);
  // assets
  const [assets, setAssets] = useState<Assets | undefined>(undefined);
  const [models, setModels] = useState<{ list: ModelEntry[]; data: Map<string, ArrayBuffer> }>({ list: [], data: new Map() });
  const [recents, setRecents] = useState<NewItem[]>([]);
  const imageModels = useModels({ edit: true });
  const characterUploads = useUploads("character");
  const characters = useMemo(() => (characterUploads.items ?? []).slice(0, 24).map((u) => ({ id: u.id, url: u.imageUrl, name: u.name })), [characterUploads.items]);

  const shot = shotOf(world), cam = cameraOf(world), D = shot.durationS;
  // Motion has two ways to direct the camera: keyframes on the timeline, or Moves (the original ShotMap controls: pick a move, set the sliders; the camera runs it).
  const motionKind: "keys" | "moves" = cam.move ? "moves" : "keys";
  const kindNow: string = motionKind;
  const moves = cam.move ?? DEFAULT_MOVES;
  const applyMoves = (patch: Partial<MovesState>) => {
    const next = { ...(cameraOf(worldRef.current).move ?? DEFAULT_MOVES), ...patch };
    commit((w) => { const c = cameraOf(w); return editCamera(w, c.id, { move: next, keys: movesToKeys(w.items, next, shotOf(w).durationS) }); });
  };
  const useKeys = () => commit((w) => editCamera(w, cameraOf(w).id, { move: undefined }));
  const selItem = sel?.kind === "item" ? world.items.find((i) => i.id === sel.id) ?? null : null;
  const selKey = sel?.kind === "key" ? (() => { const c = world.cameras.find((x) => x.id === sel.camId); return c && c.keys[sel.index] ? { cam: c, key: c.keys[sel.index] } : null; })() : null;
  const viewMode = camEdit ? "camera" : mode === "shoot" ? "shoot" : mode;

  useEffect(() => { setScenes(listScenes(projectId)); setRecents(recentAdds()); void listModels().then(setModels); }, [projectId]);
  // save as the scene changes
  useEffect(() => { if (stage !== "editor" || !sceneId) return; const h = setTimeout(() => saveScene(projectId, sceneId, world), 400); return () => clearTimeout(h); }, [world, stage, sceneId, projectId]);
  useEffect(() => () => recordAbort.current?.abort(), []);
  const flash = useCallback((s: string) => { setNote(s); setTimeout(() => setNote((n) => (n === s ? "" : n)), 4000); }, []);
  const soon = useCallback((what: string) => flash(`${what} is coming soon.`), [flash]);

  // ---------------- the 3D view ----------------
  const wrapRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), previewRef = useRef<HTMLDivElement>(null);
  const view = useRef<WorldView | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    if (stage !== "editor") return;
    let gone = false, ro: ResizeObserver | null = null;
    void Promise.all([import("@/lib/shot/world-view"), import("@/lib/shot/render-page")]).then(([wv, rp]) => {
      if (gone || !canvasRef.current || !wrapRef.current) return;
      try { view.current = wv.createView(canvasRef.current, { helpers: true, assets, models: models.data }); } catch { setError("3D needs WebGL, which this browser has switched off."); return; }
      const fit = () => { const r = wrapRef.current!.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); view.current?.resize(r.width, r.height); };
      ro = new ResizeObserver(fit); ro.observe(wrapRef.current); fit();
      view.current.setWorld(worldRef.current); view.current.frameAll();
      setViewReady(true);
      if (!assets) void Promise.race([rp.fetchAssets().catch(() => ({})), new Promise<Assets>((r) => setTimeout(() => r({}), 4000))]).then((a) => { if (!gone && Object.keys(a).length) { setAssets(a); view.current?.setAssets(a); } });
    });
    return () => { gone = true; ro?.disconnect(); view.current?.dispose(); view.current = null; setViewReady(false); };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { view.current?.setWorld(world); }, [world, viewReady]);
  useEffect(() => { view.current?.setTime(t); }, [t, viewReady]);
  useEffect(() => { view.current?.setMode(viewMode); }, [viewMode, viewReady]);
  useEffect(() => { view.current?.select(sel); }, [sel, viewReady]);
  useEffect(() => { view.current?.setGizmo(gizmo); }, [gizmo, viewReady]);
  // where the small camera preview sits (it is drawn on the same canvas)
  useEffect(() => {
    if (!viewReady) return;
    const place = () => { const c = canvasRef.current?.getBoundingClientRect(), p = previewRef.current?.getBoundingClientRect(); view.current?.setPreview(c && p && (mode === "compose" || mode === "motion") && !camEdit ? { x: p.left - c.left + 2, y: p.top - c.top + 2, w: p.width - 4, h: p.height - 4 } : null); };
    place(); const id = setInterval(place, 500); window.addEventListener("resize", place);
    return () => { clearInterval(id); window.removeEventListener("resize", place); };
  }, [viewReady, mode, camEdit, previewBig, world.aspect, panel, size.w, size.h]);

  // the gizmo moved something: write it back
  useEffect(() => {
    if (!viewReady) return;
    view.current!.onChange((p, o) => {
      const w = worldRef.current;
      if (p?.kind === "item") {
        const it = w.items.find((i) => i.id === p.id); if (!it) return;
        const pos: Vec3 = [r2(o.position.x), r2(Math.max(-20, o.position.y)), r2(o.position.z)];
        const rot: Vec3 = [r2((o.rotation.x * 180) / Math.PI), r2((o.rotation.y * 180) / Math.PI), r2((o.rotation.z * 180) / Math.PI)];
        const scale: Vec3 = [r2(Math.max(0.01, it.scale[0] * o.scale.x)), r2(Math.max(0.01, it.scale[1] * o.scale.y)), r2(Math.max(0.01, it.scale[2] * o.scale.z))];
        if (it.keys?.length && (mode === "motion" || it.keys.length > 0) && gizmo === "translate") {
          // something that moves: in Motion a drag sets its key at the playhead; in Compose it shifts its whole path
          if (mode === "motion") { commit(setItemKey(w, it.id, { t: r2(t), pos, yaw: rot[1], ease: "smooth", ...(it.keys.find((k) => Math.abs(k.t - t) < 0.05)?.pose ? { pose: it.keys.find((k) => Math.abs(k.t - t) < 0.05)!.pose } : {}) })); return; }
          const now = itemAt(it, t), d = [pos[0] - now.pos[0], pos[1] - now.pos[1], pos[2] - now.pos[2]];
          commit(editItem(w, it.id, { pos: [r2(it.pos[0] + d[0]), r2(it.pos[1] + d[1]), r2(it.pos[2] + d[2])], keys: it.keys.map((k) => ({ ...k, pos: [r2(k.pos[0] + d[0]), r2(k.pos[1] + d[1]), r2(k.pos[2] + d[2])] as Vec3 })) }));
          return;
        }
        commit(editItem(w, it.id, gizmo === "scale" ? { scale } : gizmo === "rotate" ? { rot } : { pos }));
      } else if (p?.kind === "key") {
        const c = w.cameras.find((x) => x.id === p.camId), k = c?.keys[p.index]; if (!c || !k) return;
        const pos: Vec3 = [r2(o.position.x), r2(Math.max(0.05, o.position.y)), r2(o.position.z)];
        if (gizmo === "rotate") {
          const dist = Math.max(1, Math.hypot(k.look[0] - k.pos[0], k.look[1] - k.pos[1], k.look[2] - k.pos[2]));
          const f = { x: 0, y: 0, z: 1 }, q = o.quaternion, ix = q.w * f.x + q.y * f.z - q.z * f.y, iy = q.w * f.y + q.z * f.x - q.x * f.z, iz = q.w * f.z + q.x * f.y - q.y * f.x, iw = -q.x * f.x - q.y * f.y - q.z * f.z;
          const dir = [ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x];
          commit(editCameraKey(w, c.id, p.index, { look: [r2(k.pos[0] + dir[0] * dist), r2(k.pos[1] + dir[1] * dist), r2(k.pos[2] + dir[2] * dist)] }));
        } else {
          const d = [pos[0] - k.pos[0], pos[1] - k.pos[1], pos[2] - k.pos[2]];
          commit(editCameraKey(w, c.id, p.index, { pos, look: [r2(k.look[0] + d[0]), r2(k.look[1] + d[1]), r2(k.look[2] + d[2])] }));
        }
      }
    });
  }, [viewReady, mode, gizmo, t, commit]);

  // ---------------- playback ----------------
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = ((now - last) / 1000) * speed; last = now;
      setT((cur) => { const n = cur + dt; if (n >= D) { if (loop) return n % D; setPlaying(false); return D; } return n; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, loop, D]);
  useEffect(() => { if (t > D) setT(D); }, [D, t]);

  // ---------------- picking and navigation ----------------
  const down = useRef<{ x: number; y: number; b: number; free?: FreeCam; pinch?: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const inCam = viewMode === "camera" || viewMode === "shoot";
  function onPointerDown(e: React.PointerEvent) {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    down.current = { x: e.clientX, y: e.clientY, b: e.button, free: inCam ? view.current?.getFree() : undefined };
    if (inCam) (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = touches.current.get(e.pointerId); touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!inCam || !down.current || !view.current || focusPick) return;
    if (touches.current.size >= 2) {
      const pts = [...touches.current.values()], d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (down.current.pinch != null) view.current.nudge((d - down.current.pinch) * 0.02, 0, 0);
      down.current.pinch = d; return;
    }
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y, f = view.current.getFree();
    if (down.current.b === 2 || e.shiftKey) view.current.nudge(0, -dx * 0.01, dy * 0.01);
    else view.current.setFree({ ...f, yaw: f.yaw - dx * 0.004, pitch: f.pitch - dy * 0.004 });
  }
  function onPointerUp(e: React.PointerEvent) {
    touches.current.delete(e.pointerId);
    const d = down.current; down.current = null;
    if (!d || !view.current || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    if (focusPick) { const m = view.current.focusAt(e.clientX, e.clientY); if (m != null) { if (camEdit) setCamFocus(m); else setShoot((s) => ({ ...s, focus: m })); } setFocusPick(false); return; }
    if (inCam) return;
    const p = view.current.pick(e.clientX, e.clientY);
    if (p?.kind === "item" && p.id === "floor") { setSel(null); return; }
    setSel(p); setIkey(null);
    if (p?.kind === "item") setInspector(true);
    if (p?.kind === "key") { const c = worldRef.current.cameras.find((x) => x.id === p.camId); if (c && mode === "motion" && c.id === cameraOf(worldRef.current).id) setT(c.keys[p.index].t); }
  }
  function onWheel(e: React.WheelEvent) { if (inCam && view.current) view.current.nudge(-e.deltaY * 0.01, 0, 0); }

  // ---------------- editing helpers ----------------
  function add(n: NewItem, at?: Vec3) {
    const target = at ?? (() => { const c = view.current?.editCamera().target; if (!c) return undefined; const n = worldRef.current.items.length; return [r2(c[0] + ((n % 3) - 1) * 0.8), 0, r2(c[2] + ((Math.floor(n / 3) % 3) - 1) * 0.8)] as Vec3; })();
    const made = addItem(worldRef.current, n, target);
    if (!made.id) { flash("The scene is full."); return; }
    commit(made.world); setSel({ kind: "item", id: made.id }); setInspector(true); rememberAdd(n); setRecents(recentAdds());
  }
  function addCam() {
    const w = worldRef.current, now = cameraAt(w, cameraOf(w), t).key;
    const made = addCamera(w, { ...now, pos: [r2(now.pos[0] + 2), now.pos[1], r2(now.pos[2] + 1)] });
    if (!made.id) { flash("You have the most cameras a scene can hold."); return; }
    commit(addShot(made.world, made.id)); setSel({ kind: "key", camId: made.id, index: 0 }); flash("New camera on its own shot.");
  }
  function addKeyHere() {
    const w = worldRef.current, now = cameraAt(w, cam, t).key;
    const r = setCameraKey(w, cam.id, { ...now, t: r2(t), ease: "smooth" });
    if (r.index < 0) return;
    commit(r.world); setSel({ kind: "key", camId: cam.id, index: r.index });
  }
  function setCamFocus(m: number) { if (camEdit) view.current?.setFrameLens(camLens.lensMm, camLens.fStop, m); setCamLens((l) => ({ ...l, focusM: m })); }
  const [camLens, setCamLens] = useState({ lensMm: 35, fStop: 8, focusM: 7 });
  function enterCamera(camId: string, index: number) {
    const k = worldRef.current.cameras.find((c) => c.id === camId)?.keys[index]; if (!k) return;
    setPlaying(false); setT(k.t); setCamEdit({ camId, index }); setCamLens({ lensMm: k.lensMm, fStop: k.fStop, focusM: k.focusM });
    void import("@/lib/shot/world-view").then(({ freeCamOf }) => { view.current?.setFree(freeCamOf(k)); view.current?.setFrameLens(k.lensMm, k.fStop, k.focusM); });
  }
  function doneCamera() {
    if (!camEdit || !view.current) return;
    const f = view.current.getFree();
    void import("@/lib/shot/world-view").then(({ lookFrom }) => {
      commit((w) => editCameraKey(w, camEdit.camId, camEdit.index, { pos: f.pos.map(r2) as Vec3, look: lookFrom(f, Math.max(1, camLens.focusM)).map(r2) as Vec3, lensMm: camLens.lensMm, fStop: camLens.fStop, focusM: r2(camLens.focusM) }));
      setCamEdit(null); setFocusPick(false); view.current?.hideFocus();
    });
  }
  useEffect(() => { if (camEdit) view.current?.setFrameLens(camLens.lensMm, camLens.fStop, camLens.focusM); }, [camLens, camEdit]);
  useEffect(() => { if (mode === "shoot" && !camEdit) view.current?.setFrameLens(shoot.lens, shoot.fStop, shoot.focus); }, [shoot.lens, shoot.fStop, shoot.focus, mode, camEdit, viewReady]);
  // entering Shoot starts from where the active camera is at the playhead
  useEffect(() => {
    if (mode !== "shoot" || !viewReady) return;
    const now = cameraAt(worldRef.current, cameraOf(worldRef.current), t).key;
    setShoot((s) => ({ ...s, lens: Math.round(now.lensMm), fStop: now.fStop, focus: r2(now.focusM) }));
    void import("@/lib/shot/world-view").then(({ freeCamOf }) => view.current?.setFree(freeCamOf(now)));
  }, [mode, viewReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard
  useEffect(() => {
    if (stage !== "editor") return;
    const held = new Set<string>();
    let raf = 0;
    const fly = () => {
      if (view.current && (viewMode === "camera" || viewMode === "shoot")) {
        const s = held.has("shift") ? 0.25 : 0.08;
        const fw = (held.has("w") ? 1 : 0) - (held.has("s") ? 1 : 0), rt = (held.has("d") ? 1 : 0) - (held.has("a") ? 1 : 0), up = (held.has("e") ? 1 : 0) - (held.has("q") ? 1 : 0);
        if (fw || rt || up) view.current.nudge(fw * s, rt * s, up * s);
      }
      raf = held.size ? requestAnimationFrame(fly) : 0;
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if (e.key === "Escape") { if (camEdit) { doneCamera(); return; } if (focusPick) { setFocusPick(false); return; } if (sel) { setSel(null); return; } return; }
      if (typing) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); redo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "d" && sel?.kind === "item") { e.preventDefault(); const r = duplicateItem(worldRef.current, sel.id); if (r.id) { commit(r.world); setSel({ kind: "item", id: r.id }); } return; }
      if (e.altKey && (e.code === "KeyC" || e.code === "KeyM" || e.code === "KeyK")) { e.preventDefault(); if (e.code === "KeyC") add({ kind: "shape", shape: "cube" }); else if (e.code === "KeyM") add({ kind: "person" }); else addCam(); return; }
      if (viewMode === "camera" || viewMode === "shoot") { if (["w", "a", "s", "d", "q", "e", "shift"].includes(k)) { held.add(k); if (!raf) raf = requestAnimationFrame(fly); e.preventDefault(); } return; }
      if (k === " ") { e.preventDefault(); setPlaying((p) => !p); return; }
      if (k === "k" && mode === "motion") { e.preventDefault(); addKeyHere(); return; }
      if (k === "w") setGizmo("translate"); else if (k === "e") setGizmo("rotate"); else if (k === "r") setGizmo("scale"); else if (k === "f") view.current?.frameAll();
      else if ((k === "delete" || k === "backspace") && sel) { e.preventDefault(); deleteSelection(); }
    };
    const onUp = (e: KeyboardEvent) => { held.delete(e.key.toLowerCase()); };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); cancelAnimationFrame(raf); };
  });
  function deleteSelection() {
    const w = worldRef.current;
    if (sel?.kind === "item" && sel.id !== "floor") { commit(removeItem(w, sel.id)); setSel(null); }
    else if (sel?.kind === "key") { const c = w.cameras.find((x) => x.id === sel.camId); if (c && c.keys.length > 1) { commit(removeCameraKey(w, sel.camId, sel.index)); setSel(null); } else flash("A camera keeps at least one keyframe."); }
  }

  // ---------------- start screen ----------------
  const ask = useCallback(async (askMode: "build" | "scene" | "motion", text: string, extra: { refs?: RefPick[]; frames?: string[]; world?: World } = {}) => {
    setBusy(askMode === "build" ? "Building your scene…" : askMode === "motion" ? "Planning the camera…" : "Updating the scene…"); setError("");
    try {
      const res = await fetch("/api/shot/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: askMode, text, refs: (extra.refs ?? []).map((r) => ({ type: r.type, id: r.id })), frames: extra.frames ?? [], world: extra.world ?? worldRef.current }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.world) { setError(res.status === 503 ? "The assistant is switched off in preview mode." : d.error ?? "That could not be done. Please try again."); return null; }
      return d as { world: World; summary: string };
    } catch { setError("Could not reach the assistant. Check your connection."); return null; } finally { setBusy(""); }
  }, []);
  function openWorld(w: World, id = newSceneId()) {
    past.current = []; future.current = []; setWorldState(w); setSceneId(id); setStage("editor"); setMode("compose"); setSel(null); setT(0); setPanel(typeof window !== "undefined" && window.innerWidth < 800 ? null : "outliner");
    saveScene(projectId, id, w); setScenes(listScenes(projectId));
  }
  async function start(c: StartChoice) {
    if (c.kind === "open") { const w = loadScene(c.id); if (w) openWorld(w, c.id); else setError("That scene could not be opened."); return; }
    if (c.kind === "template") { const tpl = TEMPLATES.find((x) => x.id === c.id); if (tpl) openWorld(tpl.make()); return; }
    if (c.kind === "none") { openWorld(emptyWorld()); return; }
    let frames: string[] = [];
    if (c.kind === "drawing") frames = [c.frame];
    if (c.kind === "video") { const f = (await Promise.all([0.05, 0.5, 0.92].map((a) => frameFromVideo(c.video.url, a)))).filter((x): x is string => !!x); if (!f.length) { setError("That video could not be read."); return; } frames = f; }
    const text = c.kind === "prompt" ? c.text : `${c.text}`.trim();
    const r = await ask("build", text, { refs: c.kind === "image" ? c.refs : [], frames, world: emptyWorld("Untitled Scene", c.kind === "prompt" ? c.text : "") });
    if (r) { openWorld(r.world); flash(r.summary); }
  }

  // ---------------- assistant inside the editor ----------------
  async function sendAsk() {
    const text = askText.trim(); if (!text || busy) return;
    const r = await ask(mode === "motion" ? "motion" : "scene", text);
    if (r) { commit(r.world); setAskText(""); setAskOpen(false); flash(r.summary); if (mode === "motion") { setT(0); setPlaying(true); } }
  }

  // ---------------- shoot ----------------
  async function capture() {
    if (!view.current || !canvasRef.current) return;
    const style = STYLES.find((s) => s.id === shoot.style) ?? STYLES[0];
    view.current.drawNow();
    const c = canvasRef.current, ar = ASPECT_RATIO[world.aspect], W = c.width, H = c.height;
    let fw = W, fh = W / ar; if (fh > H) { fh = H; fw = H * ar; }
    const crop = document.createElement("canvas"), k = Math.min(1, 1280 / Math.max(fw, fh)); crop.width = Math.round(fw * k); crop.height = Math.round(fh * k);
    crop.getContext("2d")!.drawImage(c, (W - fw) / 2, (H - fh) / 2, fw, fh, 0, 0, crop.width, crop.height);
    const preview = crop.toDataURL("image/jpeg", 0.85), key = `c${Date.now()}`;
    setCaptures((l) => [{ key, status: "pending" as const, preview }, ...l].slice(0, 12));
    const fail = (error: string) => setCaptures((l) => l.map((x) => (x.key === key ? { ...x, status: "failed", error } : x)));
    const model = imageModels ? toolModel(imageModels, "relight") : null;
    if (!model) { fail(imageModels ? "No picture model is available." : "Picture models are still loading. Try again."); return; }
    const blob: Blob = await new Promise((r) => crop.toBlob((b) => r(b!), "image/jpeg", 0.92));
    const up = await uploadPicture(new File([blob], "shotmap-frame.jpg", { type: "image/jpeg" }), "asset", `${FEATURE_NAME} frame`, projectId);
    if (!up.ok || !up.item) { fail(up.ok ? "The frame could not be saved." : up.error); return; }
    const scene = worldPrompt(world).split("\n").filter((l) => l.startsWith("Scene:") || l.startsWith("The ") || l.startsWith("In the scene:")).join(" ");
    const prompt = `Image 1 is a rough grey 3D blockout seen through a ${shoot.lens} mm lens at f/${shoot.fStop}. Turn it into a finished ${style.text}. Keep exactly its camera position, framing, perspective and where every person and object stands; replace every grey stand-in with the real, fully detailed thing in a real place.${scene ? ` ${scene}` : ""}${shootText.trim() ? ` Changes: ${shootText.trim()}` : ""}${shootRefs.length ? ` Use the other pictures as references for people and things.` : ""} ${shoot.fStop <= 2.8 ? "Shallow depth of field." : shoot.fStop >= 11 ? "Deep focus." : ""}`.trim();
    const ratio = model.ratios.includes(world.aspect) ? world.aspect : "auto";
    const r = await startImages({ models: imageModels!, model, auto: false, prompt, ratio, tier: shoot.quality === "high" ? toolTier(model, "relight") : "1k", qty: 1, refs: [{ type: "upload", id: up.item.id }, ...shootRefs.slice(0, Math.max(0, model.maxReferences - 1)).map((x) => ({ type: x.type, id: x.id }))], seedOn: false, seedNum: null, projectId });
    const res = r.results[0];
    if (!res?.ok || !res.id) { fail(res?.error ?? "That could not be started."); return; }
    setCaptures((l) => l.map((x) => (x.key === key ? { ...x, id: res.id } : x)));
  }
  // follow the stills being made
  useEffect(() => {
    const open = captures.filter((c) => c.status === "pending" && c.id);
    if (!open.length) return;
    const h = setInterval(() => { for (const c of open) void fetch(`/api/generations/${c.id}`).then((r) => (r.ok ? r.json() : null)).then((g) => { if (!g) return; if (g.status === "completed") setCaptures((l) => l.map((x) => (x.key === c.key ? { ...x, status: "done", url: `/api/generations/${c.id}/file` } : x))); else if (g.status === "failed") setCaptures((l) => l.map((x) => (x.key === c.key ? { ...x, status: "failed", error: g.error ?? "It could not be made." } : x))); }).catch(() => {}); }, 3500);
    return () => clearInterval(h);
  }, [captures]);

  // ---------------- record, export, use ----------------
  async function recordClip(): Promise<Blob | null> {
    const ac = new AbortController(); recordAbort.current = ac; setPlaying(false); setUseMenu(false);
    setRecord({ done: 0, total: 1, label: "Recording" });
    try {
      const { recordWorld } = await import("@/lib/shot/world-record");
      return await recordWorld(worldRef.current, { quality: recQuality, assets, models: models.data, signal: ac.signal, onProgress: (done, total) => setRecord({ done, total, label: "Recording" }) });
    } catch (e) { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "The recording failed."); return null; } finally { if (recordAbort.current === ac) recordAbort.current = null; }
  }
  async function exportClip() {
    const blob = await recordClip(); setRecord(null); if (!blob) return;
    const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = `${(world.name || "scene").replace(/[^\w-]+/g, "-").slice(0, 40)}-${shot.name.replace(/\s+/g, "-")}.mp4`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function sendClip() {
    const blob = await recordClip(); if (!blob) { setRecord(null); return; }
    setRecord({ done: 0, total: 1, label: "Sending to Video Studio" });
    const up = await uploadVideo<{ id: string; url?: string | null; imageUrl?: string | null; durationSec?: number | null; width?: number | null; height?: number | null }>(new File([blob], `${FEATURE_NAME.toLowerCase()}-guide.mp4`, { type: "video/mp4" }), `${FEATURE_NAME} · ${world.name} · ${shot.name}`, projectId, (f) => setRecord({ done: f, total: 1, label: "Sending to Video Studio" }));
    setRecord(null);
    if (!up.ok) { setError(up.error); return; }
    const refs = worldRefs(world).map((c) => ({ type: "upload" as const, id: c.id, url: c.url, label: c.name }));
    onUse({ guide: { id: up.item.id, url: `/api/generations/${up.item.id}/file`, seconds: up.item.durationSec ?? shot.durationS, width: up.item.width ?? null, height: up.item.height ?? null }, prompt: worldPrompt(world, { refs: 0 }), aspect: world.aspect, seconds: shot.durationS, refs });
  }

  // ---------------- timeline ----------------
  const trackRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(60);
  useEffect(() => { const r = trackRef.current?.getBoundingClientRect(); if (r && r.width > 50) setPps(Math.max(24, (r.width - 24) / D)); }, [D, mode, size.w, panel]);
  const timeAt = (clientX: number) => { const r = trackRef.current!.getBoundingClientRect(); return clamp((clientX - r.left + trackRef.current!.scrollLeft - 12) / pps, 0, D); };
  const drag = useRef<{ kind: "head" } | { kind: "key"; camId: string; index: number; moved: boolean } | { kind: "ikey"; id: string; index: number; moved: boolean } | null>(null);
  function onTrackDown(e: React.PointerEvent) {
    const tgt = e.target as HTMLElement;
    if (tgt.closest("[data-key],[data-ikey],.ss-tl-ruler")) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const kd = tgt.closest("[data-key]") as HTMLElement | null, ik = tgt.closest("[data-ikey]") as HTMLElement | null;
    if (kd) { const [camId, i] = kd.dataset.key!.split(":"); drag.current = { kind: "key", camId, index: Number(i), moved: false }; setSel({ kind: "key", camId, index: Number(i) }); setIkey(null); setT(cam.keys[Number(i)]?.t ?? t); return; }
    if (ik) { const [id, i] = ik.dataset.ikey!.split(":"); drag.current = { kind: "ikey", id, index: Number(i), moved: false }; setIkey({ id, index: Number(i) }); setSel({ kind: "item", id }); const k = world.items.find((x) => x.id === id)?.keys?.[Number(i)]; if (k) setT(k.t); return; }
    drag.current = { kind: "head" }; setT(r2(timeAt(e.clientX)));
  }
  function onTrackMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const nt = r2(timeAt(e.clientX));
    if (d.kind === "head") { setT(nt); return; }
    if (d.kind === "key") { if (!d.moved) { past.current.push(worldRef.current); future.current = []; d.moved = true; } setWorldState((w) => moveCameraKey(w, d.camId, d.index, nt)); setT(nt); const ks = cameraOf(worldRef.current, d.camId).keys; const ni = ks.findIndex((k) => Math.abs(k.t - nt) < 0.011); if (ni >= 0) { d.index = ni; setSel({ kind: "key", camId: d.camId, index: ni }); } }
    if (d.kind === "ikey") { const it = worldRef.current.items.find((x) => x.id === d.id); const k = it?.keys?.[d.index]; if (!it || !k) return; if (!d.moved) { past.current.push(worldRef.current); future.current = []; d.moved = true; } const keys = it.keys!.map((x, i) => (i === d.index ? { ...x, t: nt } : x)).sort((a, b) => a.t - b.t); setWorldState((w) => editItem(w, d.id, { keys })); d.index = keys.findIndex((x) => x.t === nt); setIkey({ id: d.id, index: d.index }); setT(nt); }
  }
  function onTrackUp() { drag.current = null; bump((x) => x + 1); }
  function onTrackDouble(e: React.MouseEvent, row: "camera" | string) {
    if ((e.target as HTMLElement).closest("[data-key],[data-ikey]")) return;
    const at = r2(timeAt(e.clientX)); setT(at);
    if (row === "camera") { const now = cameraAt(world, cam, at).key; const r = setCameraKey(world, cam.id, { ...now, t: at, ease: "smooth" }); if (r.index >= 0) { commit(r.world); setSel({ kind: "key", camId: cam.id, index: r.index }); } return; }
    const it = world.items.find((x) => x.id === row); if (!it) return;
    const now = itemAt(it, at), base = it.keys?.length ? world : setItemKey(world, it.id, { t: 0, pos: it.pos, yaw: it.rot[1], ease: "smooth" });
    commit(setItemKey(base, it.id, { t: at, pos: now.pos, yaw: now.yaw, ease: "smooth" })); setSel({ kind: "item", id: it.id });
  }
  const movers = world.items.filter((i) => i.kind === "person" || i.kind === "vehicle" || (i.keys?.length ?? 0) > 0);
  const ticks = Array.from({ length: Math.floor(D) + 1 }, (_, i) => i);
  const tickEvery = pps < 34 ? 5 : pps < 60 ? 2 : 1;
  const keySel = sel?.kind === "key" && sel.camId === cam.id ? sel.index : -1;

  const nowCam = cameraAt(world, cam, t), fovNow = Math.round(fovFor(nowCam.key.lensMm, world.aspect));
  // frame rect for the viewfinder overlays (CSS pixels)
  const ar = ASPECT_RATIO[world.aspect];
  const frame = (() => { let fw = size.w, fh = size.w / ar; if (fh > size.h) { fh = size.h; fw = size.h * ar; } return { left: (size.w - fw) / 2, top: (size.h - fh) / 2, width: fw, height: fh }; })();

  // ---------------- render ----------------
  if (stage === "start") {
    return (
      <div className="ss-root" role="dialog" aria-label={FEATURE_NAME}>
        <StartScreen busy={!!busy} error={error || note} scenes={scenes} onStart={(c) => void start(c)} onPickImages={() => setPicker("start-images")} onPickVideo={() => setPicker("start-video")} picked={startPicked} video={startVideo}
          onDraw={() => setSketching(true)} drawing={drawing} onClose={onClose} onSoon={soon} onDeleteScene={(id) => { deleteScene(projectId, id); setScenes(listScenes(projectId)); }} />
        {sketching && <SketchPad onClose={() => setSketching(false)} onDone={(d) => { setDrawing(d); setSketching(false); }} />}
        {picker === "start-images" && <ReferencePicker max={4} picked={startPicked} onChange={setStartPicked} onClose={() => setPicker(null)} />}
        {picker === "start-video" && <ReferencePicker max={0} picked={[]} onChange={() => {}} videoMax={1} videosOnly pickedVideos={startVideo ? [startVideo] : []} onVideosChange={(v) => { setStartVideo(v[0] ?? null); if (v[0]) setPicker(null); }} onClose={() => setPicker(null)} />}
      </div>
    );
  }

  const showInspector = mode === "compose" && inspector && !!selItem && !camEdit;
  const showCamPop = !!selKey && !camEdit && mode !== "shoot";
  return (
    <div className="ss-root" role="dialog" aria-label={FEATURE_NAME}>
      <header className="ss-top">
        <div className="ss-crumb">
          <button type="button" className="ss-icon" aria-label="Close" onClick={onClose}><X size={16} /></button>
          <button type="button" className="ss-crumb-link" onClick={() => { setStage("start"); setScenes(listScenes(projectId)); }}>{FEATURE_NAME}</button>
          <ChevronRight size={13} className="ss-faint" /><b className="ss-trunc">{world.name}</b>
        </div>
        <div className="ss-modes" role="tablist" aria-label="Mode">
          {(["compose", "shoot", "motion"] as Mode[]).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "is-on" : ""} onClick={() => { if (camEdit) doneCamera(); setMode(m); setFocusPick(false); if (window.innerWidth < 860) setPanel(null); }}>{label(m)}</button>)}
        </div>
        <div className="ss-top-right">
          <button type="button" className="ss-icon" aria-label="Undo" disabled={!past.current.length} onClick={undo}><Undo2 size={15} /></button>
          <button type="button" className="ss-icon" aria-label="Redo" disabled={!future.current.length} onClick={redo}><Redo2 size={15} /></button>
          <div className="ss-use-wrap">
            <button type="button" className="ss-use" onClick={() => setUseMenu((v) => !v)} aria-expanded={useMenu}>Use video <ArrowRight size={14} /></button>
            {useMenu && (
              <div className="ss-usemenu" role="dialog" aria-label="Choose what happens next">
                <b>Choose what happens next</b>
                <div className="ss-seg" role="radiogroup" aria-label="Quality">{(["480p", "720p"] as const).map((q) => <button key={q} type="button" role="radio" aria-checked={recQuality === q} className={recQuality === q ? "is-on" : ""} onClick={() => setRecQuality(q)}>{q}</button>)}</div>
                <button type="button" className="ss-choice" onClick={() => void exportClip()}><Download size={16} /><span><b>Export</b><small>Download {shot.name} as a video</small></span></button>
                <button type="button" className="ss-choice is-strong" onClick={() => void sendClip()}><Camera size={16} /><span><b>Use video</b><small>Record {shot.name} and send it to Video Studio as the camera-motion reference</small></span></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="ss-body">
        {panel === "outliner" && !camEdit && mode !== "shoot" && (
          <Outliner world={world} sel={sel?.kind === "item" ? sel.id : null}
            onSelect={(id) => { setSel({ kind: "item", id }); setInspector(true); if (window.innerWidth < 860) setPanel(null); }} onCamera={(id) => { setSel({ kind: "key", camId: id, index: 0 }); }}
            onEdit={(id, patch) => commit((w) => editItem(w, id, patch))} onDelete={(id) => { commit((w) => removeItem(w, id)); setSel(null); }}
            onDuplicate={(id) => { const r = duplicateItem(worldRef.current, id); if (r.id) { commit(r.world); setSel({ kind: "item", id: r.id }); } }}
            onAddGroup={() => { const r = addGroup(worldRef.current); commit(r.world); if (sel?.kind === "item" && sel.id !== "floor") commit((w) => editItem(w, sel.id, { groupId: r.id })); }}
            onOpenAdd={() => setPanel("add")} onCollapse={() => setPanel(null)} onRename={(name) => setWorldState((w) => ({ ...w, name: name.slice(0, 80) }))}
            onToggleGroup={(id) => setWorldState((w) => ({ ...w, groups: w.groups.map((g) => (g.id === id ? { ...g, open: !g.open } : g)) }))}
            onMove={(id, g) => commit((w) => editItem(w, id, { groupId: g }))} onRemoveGroup={(id) => commit((w) => removeGroup(w, id))} />
        )}
        {panel === "add" && !camEdit && mode !== "shoot" && (
          <AddPanel onAdd={(n) => { add(n); if (window.innerWidth < 860) setPanel(null); }} onAddCamera={() => { addCam(); if (window.innerWidth < 860) setPanel(null); }} onClose={() => setPanel("outliner")} onAsk={() => { setAskOpen(true); setPanel("outliner"); }} recents={recents} models={models.list}
            onUploadModel={async (f) => { if (f.size > 60 * 1024 * 1024) { setError("That model is larger than 60 MB."); return; } try { const buf = await f.arrayBuffer(); const key = await putModel(f.name.replace(/\.[^.]+$/, "").slice(0, 60), buf); const m = await listModels(); setModels(m); view.current?.dispose(); view.current = null; setViewReady(false); setStage("start"); setTimeout(() => { setStage("editor"); add({ kind: "model", modelKey: key, name: f.name.replace(/\.[^.]+$/, "") }); }, 0); } catch { setError("That file could not be read as a 3D model."); } }}
            onPickCharacter={() => setPicker("character")} onPickImage={() => setPicker("image")} characters={characters} onSoon={soon} />
        )}
        {!panel && !camEdit && mode !== "shoot" && <button type="button" className="ss-reopen" aria-label="Show the scene list" onClick={() => setPanel("outliner")}><LayoutList size={15} /></button>}

        <div className={`ss-view is-${viewMode}`} ref={wrapRef}>
          <canvas ref={canvasRef} className="ss-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={(e) => touches.current.delete(e.pointerId)} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} aria-label="3D scene" />
          {(viewMode === "camera" || viewMode === "shoot") && (
            <div className="ss-finder" style={frame} aria-hidden>
              <i className="v1" /><i className="v2" /><i className="h1" /><i className="h2" />
            </div>
          )}
          {viewMode === "shoot" && (<>
            <div className="ss-hud ss-hud-l" style={{ left: frame.left + 10, top: frame.top + 10 }}>{shoot.lens}mm<br /><small>FOV {Math.round(fovFor(shoot.lens, world.aspect))}°</small></div>
            <div className="ss-hud ss-hud-r" style={{ right: size.w - frame.left - frame.width + 10, top: frame.top + 10 }}>f/{shoot.fStop}<br /><small>AF {shoot.focus.toFixed(1)}m</small></div>
          </>)}
          {camEdit && (<>
            <div className="ss-camhead"><b>Editing camera view</b> · {r2(t)}s <span className="ss-rec" /><button type="button" className="ss-done" onClick={doneCamera}>Done (Esc)</button></div>
            <div className="ss-cambar"><LensRow compact k={camLens} onEdit={(p) => setCamLens((l) => ({ ...l, ...p }))} focusPicking={focusPick} onFocusPick={() => setFocusPick((v) => !v)} /></div>
          </>)}
          {(mode === "compose" || mode === "motion") && !camEdit && (
            <div ref={previewRef} className={`ss-preview${mode === "motion" ? " is-top" : ""}${previewBig ? " is-big" : ""}`} style={{ aspectRatio: String(ar) }}>
              <span className="ss-preview-label">{cam.name} · Live view</span>
              <button type="button" className="ss-icon" aria-label={previewBig ? "Make the preview smaller" : "Make the preview bigger"} onClick={() => setPreviewBig((v) => !v)}>{previewBig ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
            </div>
          )}
          {!camEdit && mode !== "shoot" && (
            <div className="ss-viewtools">
              <button type="button" className="ss-icon" aria-label="Fit everything in view" onClick={() => view.current?.frameAll()}><Expand size={14} /></button>
              {sel?.kind === "item" && mode === "compose" && (["translate", "rotate", "scale"] as const).map((g) => <button key={g} type="button" className={`ss-icon${gizmo === g ? " is-on" : ""}`} aria-pressed={gizmo === g} aria-label={g === "translate" ? "Move" : g === "rotate" ? "Rotate" : "Scale"} onClick={() => setGizmo(g)}>{g === "translate" ? "W" : g === "rotate" ? "E" : "R"}</button>)}
            </div>
          )}
          {note && <div className="ss-note" role="status">{note}</div>}
          {error && <div className="ss-note is-error" role="alert">{error}<button type="button" className="ss-icon" aria-label="Dismiss" onClick={() => setError("")}><X size={12} /></button></div>}
          {busy && <div className="ss-note" role="status">{busy}</div>}
          {focusPick && <div className="ss-note" role="status">Tap where the camera should focus</div>}
          {showCamPop && selKey && (
            <CameraPopover camName={selKey.cam.name} k={selKey.key} isActive={selKey.cam.id === shot.cameraId} canDelete={selKey.cam.keys.length > 1}
              onEdit={(p) => commit((w) => editCameraKey(w, selKey.cam.id, (sel as { index: number }).index, p))} onEnter={() => enterCamera(selKey.cam.id, (sel as { index: number }).index)}
              onSetActive={() => commit((w) => editShot(w, shot.id, { cameraId: selKey.cam.id }))} onDelete={deleteSelection} onClose={() => setSel(null)} />
          )}
        </div>

        {showInspector && selItem && (
          <Inspector item={selItem} gizmo={gizmo} onGizmo={setGizmo} onClose={() => setInspector(false)} onDelete={deleteSelection} onLinkCharacter={() => setPicker("link-character")}
            onEdit={(patch) => commit((w) => editItem(w, selItem.id, patch))} />
        )}
      </div>

      {/* ---------- bottom: Compose ask bar / Shoot controls / Motion timeline ---------- */}
      {mode === "compose" && !camEdit && (
        <div className="ss-askbar">
          <GrowArea value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="Ask the assistant to edit your scene…" aria-label="Ask the assistant to edit your scene" rows={1} noExpand onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendAsk(); }} />
          <button type="button" className="ss-send" aria-label="Send" disabled={!askText.trim() || !!busy} onClick={() => void sendAsk()}><Send size={15} /></button>
        </div>
      )}

      {mode === "shoot" && !camEdit && (
        <div className="ss-shoot">
          {captures.length > 0 && (
            <div className="ss-caps" aria-label="Stills">
              {captures.map((c) => <button key={c.key} type="button" className={`ss-cap is-${c.status}`} onClick={() => setViewing(c)} aria-label={c.status === "pending" ? "Still being made" : c.status === "failed" ? "Still failed" : "Open the still"}><img src={c.url ?? c.preview} alt="" />{c.status === "pending" && <span className="ss-spin" />}</button>)}
            </div>
          )}
          {shoot.tab && (
            <div className="ss-shoot-panel">
              <div className="ss-tabs" role="tablist">{(["style", "frame", "lens", "depth"] as const).map((tb) => <button key={tb} type="button" role="tab" aria-selected={shoot.tab === tb} className={shoot.tab === tb ? "is-on" : ""} onClick={() => setShoot((s) => ({ ...s, tab: tb }))}>{label(tb)}</button>)}</div>
              {shoot.tab === "style" && <div className="ss-chips">{STYLES.map((s) => <button key={s.id} type="button" className={shoot.style === s.id ? "is-on" : ""} onClick={() => setShoot((x) => ({ ...x, style: s.id }))}>{s.label}</button>)}<button type="button" onClick={() => soon("Your own styles")}>My Styles <Plus size={12} /></button></div>}
              {shoot.tab === "frame" && <div className="ss-chips">{ASPECT_LIST.map((a) => <button key={a} type="button" className={world.aspect === a ? "is-on" : ""} onClick={() => commit((w) => ({ ...w, aspect: a }))}>{a}</button>)}</div>}
              {shoot.tab === "lens" && <div className="ss-chips">{LENSES.map((l) => <button key={l} type="button" className={shoot.lens === l ? "is-on" : ""} onClick={() => setShoot((x) => ({ ...x, lens: l }))}>{l}mm</button>)}</div>}
              {shoot.tab === "depth" && <div className="ss-chips">{FSTOPS.map((f) => <button key={f} type="button" className={shoot.fStop === f ? "is-on" : ""} onClick={() => setShoot((x) => ({ ...x, fStop: f }))}>f/{f}</button>)}<span className="ss-faint ss-depth">{DEPTH_WORD(shoot.fStop)}</span></div>}
              <div className="ss-capq"><span className="ss-lbl">Capture quality</span><select className="ss-select" value={shoot.quality} aria-label="Capture quality" onChange={(e) => setShoot((x) => ({ ...x, quality: e.target.value as "fast" | "high" }))}><option value="fast">Fast</option><option value="high">High</option></select></div>
            </div>
          )}
          <div className="ss-shoot-row">
            <button type="button" className="ss-settings" onClick={() => setShoot((s) => ({ ...s, tab: s.tab ? null : "style" }))} aria-expanded={!!shoot.tab}>{world.aspect} · {shoot.lens}mm · f/{shoot.fStop} {shoot.tab ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
            <span className="ss-count" aria-label="Stills taken">{captures.length}</span>
            <button type="button" className="ss-shutter" aria-label="Take a still" onClick={() => void capture()}><span /></button>
            <button type="button" className={`ss-icon${focusPick ? " is-on" : ""}`} aria-label="Pick the focus point in the scene" onClick={() => setFocusPick((v) => !v)}><Focus size={15} /></button>
          </div>
          <div className="ss-askbar is-inline">
            <button type="button" className="ss-icon" aria-label="Add reference pictures" onClick={() => setPicker("shoot-refs")}><Paperclip size={15} /></button>
            {shootRefs.length > 0 && <span className="ss-count">{shootRefs.length}</span>}
            <GrowArea value={shootText} onChange={(e) => setShootText(e.target.value)} placeholder="Describe your scene changes" aria-label="Describe your scene changes" rows={1} noExpand />
          </div>
        </div>
      )}

      {mode === "motion" && !camEdit && motionKind === "moves" && (
        <div className="ss-motion">
          <div className="ss-moves-top">
              <div className="ss-kind" role="tablist" aria-label="How to direct the camera">
                <button type="button" role="tab" aria-selected={kindNow === "keys"} className={kindNow === "keys" ? "is-on" : ""} onClick={useKeys}>Keyframes</button>
                <button type="button" role="tab" aria-selected={kindNow === "moves"} className={kindNow === "moves" ? "is-on" : ""} onClick={() => applyMoves({})}>Moves</button>
              </div>
            <button type="button" className="ss-play" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (!playing && t >= D) setT(0); setPlaying((p) => !p); }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <span className="ss-tl-time">{t.toFixed(1)} / {D} s</span>
          </div>
          <MovesPanel m={moves} onChange={applyMoves} lengthS={D} maxLengthS={MAX_SHOT_S} onLength={(v) => { commit((w) => editShot(w, shotOf(w).id, { durationS: v })); setT(0); }} />
        </div>
      )}
      {mode === "motion" && !camEdit && motionKind === "keys" && (
        <div className="ss-motion">
          <div className="ss-tl-bar">
            <div className="ss-tl-left">
              <div className="ss-kind" role="tablist" aria-label="How to direct the camera">
                <button type="button" role="tab" aria-selected={kindNow === "keys"} className={kindNow === "keys" ? "is-on" : ""} onClick={useKeys}>Keyframes</button>
                <button type="button" role="tab" aria-selected={kindNow === "moves"} className={kindNow === "moves" ? "is-on" : ""} onClick={() => applyMoves({})}>Moves</button>
              </div>
              <div className="ss-add-wrap">
                <button type="button" className="ss-pill" onClick={() => setAddMenu((v) => !v)} aria-expanded={addMenu}><Plus size={13} /> Add</button>
                {addMenu && (
                  <div className="ss-menu is-up" role="menu" onMouseLeave={() => setAddMenu(false)}>
                    <button type="button" role="menuitem" onClick={() => { add({ kind: "person" }); setAddMenu(false); }}><User size={13} /> Actor</button>
                    <button type="button" role="menuitem" onClick={() => { add({ kind: "shape", shape: "cube" }); setAddMenu(false); }}><Box size={13} /> Cube</button>
                    <button type="button" role="menuitem" onClick={() => { addCam(); setAddMenu(false); }}><Camera size={13} /> Camera</button>
                    <button type="button" role="menuitem" onClick={() => { setAskOpen(true); setAddMenu(false); }}><MessageSquare size={13} /> Ask</button>
                  </div>
                )}
              </div>
              <label className="ss-toggle" title="On: people appear in the guide video. Off: they are left out."><input type="checkbox" checked={world.simpleFigures} onChange={(e) => commit((w) => ({ ...w, simpleFigures: e.target.checked }))} /> Simple figures</label>
              <button type="button" className="ss-pill" onClick={addKeyHere} title="Add keyframe · K"><Plus size={13} /> Add keyframe</button>
              {keySel >= 0 && (<>
                <div className="ss-add-wrap">
                  <button type="button" className="ss-pill" onClick={() => setEaseMenu((v) => !v)} aria-expanded={easeMenu} aria-label="Easing">{EASES.find((e) => e.id === cam.keys[keySel]?.ease)?.label ?? "Smooth"} <ChevronDown size={12} /></button>
                  {easeMenu && (
                    <div className="ss-menu is-up" role="menu" onMouseLeave={() => setEaseMenu(false)}>
                      <div className="ss-menu-head">Applies to the selected keyframe</div>
                      {EASES.map((e) => <button key={e.id} type="button" role="menuitemradio" aria-checked={cam.keys[keySel]?.ease === e.id} onClick={() => { commit((w) => editCameraKey(w, cam.id, keySel, { ease: e.id as Ease })); setEaseMenu(false); }}>{e.label}</button>)}
                    </div>
                  )}
                </div>
                <button type="button" className="ss-icon" aria-label="Delete this keyframe" onClick={deleteSelection} disabled={cam.keys.length < 2}><X size={14} /></button>
              </>)}
              {ikey && (() => { const it = world.items.find((x) => x.id === ikey.id), k = it?.keys?.[ikey.index]; if (!it || !k) return null; return (<>
                {it.kind === "person" && <select className="ss-select is-small" aria-label="Pose from this keyframe" value={k.pose ?? ""} onChange={(e) => commit((w) => editItem(w, it.id, { keys: it.keys!.map((x, i) => (i === ikey.index ? { ...x, pose: (e.target.value || undefined) as Pose | undefined } : x)) }))}><option value="">Keep pose</option>{POSES.map((p) => <option key={p} value={p}>{label(p)}</option>)}</select>}
                <button type="button" className="ss-icon" aria-label="Delete this keyframe" onClick={() => { commit(removeItemKey(world, it.id, ikey.index)); setIkey(null); }}><X size={14} /></button>
              </>); })()}
              <button type="button" className="ss-icon" aria-label="Cut the shot at the playhead" title="Cut the shot here" onClick={() => { const n = splitShot(world, t); if (n === world) flash("Move the playhead inside the shot to cut it."); else { commit(n); setT(0); } }}><Scissors size={14} /></button>
            </div>
            <div className="ss-transport">
              <button type="button" className="ss-icon" aria-label="Go to start" onClick={() => setT(0)}><ChevronFirst size={15} /></button>
              <button type="button" className="ss-icon" aria-label="Previous keyframe" onClick={() => { const k = [...cam.keys].reverse().find((x) => x.t < t - 0.02); setT(k ? k.t : 0); }}><ChevronLeft size={15} /></button>
              <button type="button" className="ss-play" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (!playing && t >= D) setT(0); setPlaying((p) => !p); }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
              <button type="button" className="ss-icon" aria-label="Next keyframe" onClick={() => { const k = cam.keys.find((x) => x.t > t + 0.02); setT(k ? k.t : D); }}><ChevronRight size={15} /></button>
              <button type="button" className="ss-icon" aria-label="Go to end" onClick={() => setT(D)}><ChevronLast size={15} /></button>
              <button type="button" className="ss-speed" aria-label="Playback speed" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}>{speed}×</button>
              <button type="button" className={`ss-icon${loop ? " is-on" : ""}`} aria-pressed={loop} aria-label="Loop" onClick={() => setLoop((v) => !v)}><Repeat size={14} /></button>
            </div>
            <div className="ss-tl-right">
              <select className="ss-select is-small" aria-label="Aspect ratio" value={world.aspect} onChange={(e) => commit((w) => ({ ...w, aspect: e.target.value as WAspect }))}>{ASPECT_LIST.map((a) => <option key={a} value={a}>{a}</option>)}</select>
              <div className="ss-add-wrap">
                <button type="button" className="ss-pill" onClick={() => setShotMenu((v) => !v)} aria-expanded={shotMenu} aria-label="Shots"><span className="ss-dotred" /> {shot.name} <ChevronDown size={12} /></button>
                {shotMenu && (
                  <div className="ss-menu is-up is-right" role="menu" onMouseLeave={() => setShotMenu(false)}>
                    {world.shots.map((s) => <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === shot.id} onClick={() => { commit((w) => ({ ...w, shotId: s.id })); setShotMenu(false); setT(0); }}>{s.name} · {cameraOf(world, s.cameraId).name} · {s.durationS}s</button>)}
                    <button type="button" role="menuitem" onClick={() => { commit(addShot(world)); setShotMenu(false); setT(0); }}><Plus size={13} /> New shot</button>
                  </div>
                )}
              </div>
              <label className="ss-dur" title="Shot duration"><input inputMode="decimal" aria-label="Shot duration in seconds" value={D} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) commit((w) => editShot(w, shot.id, { durationS: Math.min(MAX_SHOT_S, v) })); }} />s</label>
              <button type="button" className="ss-icon" aria-label="Duplicate the shot" onClick={() => commit(duplicateShot(world))}><Copy size={14} /></button>
              <button type="button" className="ss-icon" aria-label="Delete the shot" disabled={world.shots.length < 2} onClick={() => { commit(removeShot(world, shot.id)); setT(0); }}><Trash2 size={14} /></button>
            </div>
          </div>
          {askOpen && (
            <div className="ss-askbar is-inline">
              <GrowArea value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="Describe exactly the camera move you need" aria-label="Describe the camera move" rows={1} noExpand autoFocus onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendAsk(); }} />
              <button type="button" className="ss-send" aria-label="Send" disabled={!askText.trim() || !!busy} onClick={() => void sendAsk()}><Send size={15} /></button>
              <button type="button" className="ss-icon" aria-label="Close" onClick={() => setAskOpen(false)}><X size={14} /></button>
            </div>
          )}
          <div className="ss-tl">
            <div className="ss-tl-names">
              <div className="ss-tl-ruler-pad" />
              <div className="ss-tl-name is-cam">
                <span className="ss-trunc"><Camera size={13} /> {cam.name}</span>
                <span className="ss-tl-icons">
                  <button type="button" className={`ss-icon${cam.showPath ? " is-on" : ""}`} aria-pressed={cam.showPath} aria-label="Show the camera path" onClick={() => commit((w) => editCamera(w, cam.id, { showPath: !cam.showPath }))}><Spline size={12} /></button>
                  <button type="button" className="ss-icon" aria-label="Aim at the selected thing" disabled={!selItem} onClick={() => { if (!selItem) return; const now = itemAt(selItem, t), look: Vec3 = [now.pos[0], r2(now.pos[1] + (selItem.kind === "person" ? 1.4 : 0.8)), now.pos[2]]; if (keySel >= 0) commit((w) => editCameraKey(w, cam.id, keySel, { look })); else { const r = setCameraKey(world, cam.id, { ...nowCam.key, t: r2(t), look, ease: "smooth" }); if (r.index >= 0) commit(r.world); } }}><Crosshair size={12} /></button>
                  <button type="button" className={`ss-icon${world.aspect === "9:16" ? " is-on" : ""}`} aria-label="Vertical frame" aria-pressed={world.aspect === "9:16"} onClick={() => commit((w) => ({ ...w, aspect: w.aspect === "9:16" ? "16:9" : "9:16" }))}><Smartphone size={12} /></button>
                  <button type="button" className="ss-icon" aria-label="Delete the camera" disabled={world.cameras.length < 2} onClick={() => { commit(removeCamera(world, cam.id)); setSel(null); }}><Trash2 size={12} /></button>
                </span>
              </div>
              {movers.map((m) => { const Icon = itemIcon(m); return <div key={m.id} className={`ss-tl-name${sel?.kind === "item" && sel.id === m.id ? " is-sel" : ""}`}><span className="ss-trunc"><Icon size={13} /> {m.name}</span></div>; })}
            </div>
            <div className="ss-tl-track" ref={trackRef} onPointerDown={onTrackDown} onPointerMove={onTrackMove} onPointerUp={onTrackUp} onPointerCancel={onTrackUp}>
              <div className="ss-tl-inner" style={{ width: D * pps + 24 }}>
                <div className="ss-tl-ruler">{ticks.map((s) => <span key={s} style={{ left: 12 + s * pps }} className={s % tickEvery ? "is-minor" : ""}>{s % tickEvery ? "" : `${s}s`}</span>)}</div>
                <div className="ss-tl-row is-cam" onDoubleClick={(e) => onTrackDouble(e, "camera")}>
                  <div className="ss-tl-clip" style={{ left: 12, width: D * pps }}><span>{cam.name}</span></div>
                  {cam.keys.filter((k) => k.t <= D + 0.001).map((k, i) => <button key={i} type="button" data-key={`${cam.id}:${i}`} className={`ss-diamond${keySel === i ? " is-sel" : ""}`} style={{ left: 12 + k.t * pps }} aria-label={`Keyframe at ${r2(k.t)} seconds`} />)}
                </div>
                {movers.map((m) => (
                  <div key={m.id} className="ss-tl-row" onDoubleClick={(e) => onTrackDouble(e, m.id)}>
                    {(m.keys ?? []).length > 0 && <div className="ss-tl-bar-item" style={{ left: 12 + (m.keys![0].t) * pps, width: Math.max(4, (m.keys![m.keys!.length - 1].t - m.keys![0].t) * pps) }}>{(m.keys ?? []).filter((k) => k.pose).map((k) => label(k.pose!)).join(" → ") || (m.description || "")}</div>}
                    {(m.keys ?? []).map((k, i) => <button key={i} type="button" data-ikey={`${m.id}:${i}`} className={`ss-diamond is-item${ikey?.id === m.id && ikey.index === i ? " is-sel" : ""}`} style={{ left: 12 + k.t * pps }} aria-label={`${m.name} keyframe at ${r2(k.t)} seconds`} />)}
                  </div>
                ))}
                <div className="ss-playhead" style={{ left: 12 + t * pps }}><span>{t.toFixed(1)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {record && (
        <div className="ss-modal" role="dialog" aria-label="Recording">
          <div className="ss-modal-card ss-rec-card">
            <b>{record.label}…</b>
            <span>{record.label === "Recording" ? `${record.done} / ${record.total}` : `${Math.round((record.done / Math.max(1, record.total)) * 100)}%`}</span>
            <div className="ss-progress"><i style={{ width: `${Math.round((record.done / Math.max(1, record.total)) * 100)}%` }} /></div>
            {record.label === "Recording" && <button type="button" className="ss-wide" onClick={() => { recordAbort.current?.abort(); setRecord(null); }}>Cancel</button>}
          </div>
        </div>
      )}
      {viewing && (
        <div className="ss-modal" role="dialog" aria-label="Still" onClick={() => setViewing(null)}>
          <div className="ss-modal-card ss-still" onClick={(e) => e.stopPropagation()}>
            <div className="ss-side-head"><b>{viewing.status === "pending" ? "Generating preview…" : viewing.status === "failed" ? "It could not be made" : "Still"}</b><button type="button" className="ss-icon" aria-label="Close" onClick={() => setViewing(null)}><X size={15} /></button></div>
            <img src={viewing.url ?? viewing.preview} alt="" />
            {viewing.error && <p className="ss-error">{viewing.error}</p>}
            {viewing.url && <a className="ss-wide is-strong" href={`${viewing.url}?download=1`}><Download size={14} /> Download</a>}
          </div>
        </div>
      )}
      {picker === "character" && <ReferencePicker max={1} picked={[]} note="Choose a picture of the person. A mannequin stands in for them and the picture goes to Video Studio with the guide." onChange={(p) => { const c = p[0]; if (c) { add({ kind: "person", character: { id: c.id, url: c.url, name: c.label.slice(0, 60) } }); setPicker(null); } }} onClose={() => setPicker(null)} />}
      {picker === "link-character" && selItem && <ReferencePicker max={1} picked={[]} onChange={(p) => { const c = p[0]; if (c) { commit((w) => editItem(w, selItem.id, { character: { id: c.id, url: c.url, name: c.label.slice(0, 60) } })); setPicker(null); } }} onClose={() => setPicker(null)} />}
      {picker === "image" && <ReferencePicker max={1} picked={[]} onChange={(p) => { const c = p[0]; if (!c) return; setPicker(null); void imageAspect(c.url).then((aspect) => add({ kind: "image", image: { type: c.type, id: c.id, url: c.url, aspect: clamp(aspect, 0.1, 10) } })); }} onClose={() => setPicker(null)} />}
      {picker === "shoot-refs" && <ReferencePicker max={3} picked={shootRefs} onChange={setShootRefs} onClose={() => setPicker(null)} />}
    </div>
  );
}
export type { CamKey, Item };
