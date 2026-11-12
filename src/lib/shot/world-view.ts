// The ShotMap 3D view (browser only): draws a World with three.js for the editor (orbit, pick, move/rotate/scale, camera keyframes and paths,
// a preview of the rolling camera) and for the recorder (exactly what the camera sees, no helpers). Nothing here keeps time: the caller sets it.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { hipHeight, poseJoints } from "./engine";
import { XBOT_CLIP, FURNITURE_HEIGHT } from "./assets";
import { bentPose, bonesOf, fitModel, personMesh, poseRig, swingForward, tintTo, vehicleMesh, type Assets, type Rig } from "./render-page";
import { OBJECTS } from "./setup";
import type { Actor, Vehicle, ColorId } from "./schema";
import { ASPECT_RATIO, baseSize, cameraAt, cameraOf, itemAt, shotOf, type CamKey, type Item, type Vec3, type World } from "./world";

export type ViewMode = "compose" | "shoot" | "motion" | "camera";
export type Gizmo = "translate" | "rotate" | "scale";
export type Pick = { kind: "item"; id: string } | { kind: "key"; camId: string; index: number } | null;
export type Rect = { x: number; y: number; w: number; h: number };
export type FreeCam = { pos: Vec3; yaw: number; pitch: number };

const D2R = Math.PI / 180;
const mat = (hex: string, opacity = 1) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82, metalness: 0.02 }); if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; } return m; };
const free = (o: THREE.Object3D) => o.traverse((n) => { const m = n as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose?.(); });
const looking = (k: { pos: Vec3; look: Vec3 }): FreeCam => { const d = new THREE.Vector3(k.look[0] - k.pos[0], k.look[1] - k.pos[1], k.look[2] - k.pos[2]).normalize(); return { pos: [...k.pos] as Vec3, yaw: Math.atan2(d.x, d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))) }; };
export const freeCamOf = looking;
export function lookFrom(f: FreeCam, dist = 6): Vec3 { return [f.pos[0] + Math.sin(f.yaw) * Math.cos(f.pitch) * dist, f.pos[1] + Math.sin(f.pitch) * dist, f.pos[2] + Math.cos(f.yaw) * Math.cos(f.pitch) * dist]; }

function boatMesh(color: string) {
  const g = new THREE.Group(), m = mat(color), white = mat("#f2f2f2");
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 7, 4, 1), white); hull.rotation.set(Math.PI / 2, Math.PI / 4, 0); hull.scale.set(1, 1, 0.5); hull.position.y = 0.55;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 4), white); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.55); bow.position.set(0, 0.55, 4.25);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 6), m); deck.position.y = 1.0;
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06), mat("#7d8fa6", 0.7)); screen.position.set(0, 1.3, 0.8); screen.rotation.x = -0.4;
  g.add(hull, bow, deck, screen); return g;
}
function shapeMesh(it: Item): THREE.Object3D {
  const [w, h, d] = baseSize(it), m = mat(it.color, it.shape === "floor" && it.id === "floor" ? 1 : 1);
  let geo: THREE.BufferGeometry;
  switch (it.shape) {
    case "sphere": geo = new THREE.SphereGeometry(0.5, 32, 20); break;
    case "cylinder": geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
    case "cone": geo = new THREE.ConeGeometry(0.5, 1, 32); break;
    case "torus": geo = new THREE.TorusGeometry(0.35, 0.15, 16, 40); geo.rotateX(Math.PI / 2); geo.scale(1, 1, 1); break;
    default: geo = new THREE.BoxGeometry(1, 1, 1);
  }
  const mesh = new THREE.Mesh(geo, m);
  if (it.shape === "torus") { mesh.scale.set(w / 1, 1, d / 1); mesh.position.y = 0.15; } else { mesh.scale.set(w, h, d); mesh.position.y = h / 2; }
  return mesh;
}
function objectMesh(it: Item, assets: Assets): THREE.Object3D {
  const g = new THREE.Group();
  if (it.object === "sheen-chair" || it.object === "velvet-sofa") {
    const which = it.object === "sheen-chair" ? "chair" : "sofa", a = assets[which];
    if (a) { const { holder } = fitModel(a.scene, FURNITURE_HEIGHT[which], false); g.add(holder); return g; }
    const [w, h, d] = baseSize(it), b = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.5, d), mat(it.color)); b.position.y = h * 0.25; g.add(b); return g;
  }
  const def = OBJECTS.find((o) => o.id === it.object);
  for (const p of def?.parts ?? []) {
    const geo = p.k === "cylinder" ? new THREE.CylinderGeometry(p.size[0] / 2, p.size[0] / 2, p.size[1], 24) : new THREE.BoxGeometry(...p.size);
    const mesh = new THREE.Mesh(geo, mat(p.c ?? it.color)); mesh.position.set(...p.at); g.add(mesh);
  }
  return g;
}

type Figure = { rig: Rig | null; xg: THREE.Group | null; mixer: THREE.AnimationMixer | null; clips: Map<string, THREE.AnimationClip>; height: number };
type Node = { item: Item; root: THREE.Group; inner: THREE.Group; fig?: Figure; signature: string };

/** A camera body like a cinema camera: body, lens and a light. Grey for keyframes, blue when chosen, white for the camera at the playhead. */
function cameraBody(color: number) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.36), m); body.position.z = -0.1;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 20), m); lens.rotation.x = Math.PI / 2; lens.position.z = 0.17;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.2), m); top.position.set(0, 0.2, -0.12);
  g.add(body, lens, top); return g;
}

export type ViewOptions = { helpers: boolean; assets?: Assets; models?: Map<string, ArrayBuffer> };
export function createView(canvas: HTMLCanvasElement, opts: ViewOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !opts.helpers });
  renderer.setPixelRatio(opts.helpers ? Math.min(2, window.devicePixelRatio || 1) : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const world3 = new THREE.Group(), helpers = new THREE.Group(), labels = new THREE.Group(); scene.add(world3, helpers);
  helpers.add(labels);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404452, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-10, 18, 12); scene.add(sun);
  const grid = new THREE.GridHelper(400, 400, 0x6a6f86, 0x34374a); grid.position.y = 0.07; (grid.material as THREE.Material).depthWrite = false; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.55; scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: "#1f2128", roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const axisX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-200, 0.08, 0), new THREE.Vector3(200, 0.08, 0)]), new THREE.LineBasicMaterial({ color: 0x9a3a4a })); scene.add(axisX);
  const axisZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.08, -200), new THREE.Vector3(0, 0.08, 200)]), new THREE.LineBasicMaterial({ color: 0x5a5f78 })); scene.add(axisZ);

  const edit = new THREE.PerspectiveCamera(42, 1, 0.4, 900); edit.position.set(9, 7, 14);
  const shotCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.15, 1500);
  const orbit = opts.helpers ? new OrbitControls(edit, canvas) : null;
  if (orbit) { orbit.enableDamping = true; orbit.dampingFactor = 0.12; orbit.target.set(0, 1, 0); orbit.screenSpacePanning = true; orbit.maxPolarAngle = Math.PI * 0.495; }
  const gizmo = opts.helpers ? new TransformControls(edit, canvas) : null;
  const gizmoHelper = gizmo?.getHelper(); if (gizmoHelper) scene.add(gizmoHelper);
  if (gizmo) gizmo.setSize(0.9);
  const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffffff); selBox.visible = false; helpers.add(selBox);
  const camLayer = new THREE.Group(); helpers.add(camLayer);
  const liveCam = cameraBody(0xf2f2f2), frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); helpers.add(liveCam, frustum);
  const focusMark = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 32), new THREE.MeshBasicMaterial({ color: 0xf0c419, side: THREE.DoubleSide, depthTest: false })); focusMark.visible = false; scene.add(focusMark);

  let W = 1, H = 1, world: World | null = null, t = 0, mode: ViewMode = "compose", selected: Pick = null, assets = opts.assets ?? {};
  const nodes = new Map<string, Node>(), keyRigs: THREE.Object3D[] = [];
  let free_: FreeCam = { pos: [0, 1.6, 7], yaw: Math.PI, pitch: 0 };
  let previewRect: Rect | null = null, dofOn = true, frame = 0, disposed = false, labelStep = 0;
  const listeners: { change?: (p: Pick, o: THREE.Object3D) => void; render?: () => void } = {};
  const gltf = new GLTFLoader(), modelCache = new Map<string, THREE.Object3D>();

  // ---- scene building ----
  function signature(it: Item) { return JSON.stringify([it.kind, it.shape, it.object, it.vtype, it.build, it.color, it.tint, it.image?.url, it.modelKey, it.scale, world?.simpleFigures]); }
  function buildNode(it: Item): Node {
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); root.userData.itemId = it.id;
    let fig: Figure | undefined;
    if (it.kind === "shape") inner.add(shapeMesh(it));
    else if (it.kind === "object") inner.add(objectMesh(it, assets));
    else if (it.kind === "vehicle") {
      if (it.vtype === "boat") inner.add(boatMesh(it.color));
      else inner.add(vehicleMesh({ id: it.id, label: it.name, color: (it.tint ?? "grey") as ColorId, type: (it.vtype ?? "car") as Vehicle["type"], path: [{ t: 0, pos: [0, 0] }] } as Vehicle));
    } else if (it.kind === "image" && it.image) {
      const [w, h] = baseSize(it), plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true }));
      plane.position.y = h / 2; inner.add(plane);
      new THREE.TextureLoader().load(it.image.url, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; (plane.material as THREE.MeshBasicMaterial).map = tex; (plane.material as THREE.MeshBasicMaterial).needsUpdate = true; invalidate(); });
    } else if (it.kind === "model") {
      const holder = new THREE.Group(); inner.add(holder);
      const put = (src: THREE.Object3D) => { const { holder: h } = fitModel(src, 1, false); holder.add(h); invalidate(); };
      const cached = it.modelKey ? modelCache.get(it.modelKey) : undefined;
      if (cached) put(cached);
      else { const buf = it.modelKey ? opts.models?.get(it.modelKey) : undefined; const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat("#8a8f9c", 0.6)); box.position.y = 0.5; holder.add(box);
        if (buf) gltf.parseAsync(buf.slice(0), "").then((g) => { modelCache.set(it.modelKey!, g.scene); holder.remove(box); put(g.scene); }).catch(() => {}); }
    } else if (it.kind === "person") {
      const h = it.build === "woman" ? 1.65 : 1.78, actor = { id: it.id, label: it.name, color: (it.tint ?? "grey") as ColorId, build: it.build ?? "man", heightM: h, marks: [{ t: 0, pos: [0, 0] }], actions: [] } as Actor;
      const rig = personMesh(actor); inner.add(rig.g);
      const x = assets.xbot; let xg: THREE.Group | null = null, mixer: THREE.AnimationMixer | null = null; const clips = new Map<string, THREE.AnimationClip>();
      if (x && x.animations.length) { const f = fitModel(x.scene, h, true); tintTo(f.root, it.color); xg = f.holder; xg.visible = false; inner.add(xg); mixer = new THREE.AnimationMixer(f.root); for (const c of x.animations) clips.set(c.name, c); }
      fig = { rig, xg, mixer, clips, height: h };
    }
    if (it.kind !== "shape" && it.kind !== "image" && it.kind !== "model") inner.scale.set(1, 1, 1);
    root.traverse((o) => { o.userData.itemId = it.id; const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; } });
    return { item: it, root, inner, fig, signature: signature(it) };
  }
  function place(n: Node) {
    const it = n.item, now = itemAt(it, t), sc = it.kind === "shape" || it.kind === "image" ? [1, 1, 1] : it.scale;
    n.root.position.set(...now.pos); n.root.rotation.set(it.rot[0] * D2R, now.yaw * D2R, it.rot[2] * D2R); n.root.scale.set(1, 1, 1);
    if (it.kind === "shape") n.inner.scale.set(it.scale[0], it.scale[1], it.scale[2]); else if (it.kind === "image") n.inner.scale.set(it.scale[0], it.scale[1], 1); else n.inner.scale.set(sc[0], sc[1], sc[2]);
    n.root.visible = it.visible && !(it.kind === "person" && world && !world.simpleFigures && !opts.helpers);
    const f = n.fig; if (!f) return;
    const useClip = f.xg && f.mixer ? XBOT_CLIP[now.pose] : undefined, clip = useClip ? f.clips.get(useClip.clip) : undefined;
    if (f.xg && f.mixer && useClip && clip) {
      f.rig!.g.visible = false; f.xg.visible = true; f.xg.position.set(0, 0, 0);
      const tt = useClip.strideM ? (now.walked / useClip.strideM) * clip.duration : (now.since < 90 ? now.since : t);
      f.mixer.stopAllAction(); f.mixer.clipAction(clip).reset().play(); f.mixer.setTime(((tt % clip.duration) + clip.duration) % clip.duration);
    } else if (f.xg && f.mixer && f.clips.get("idle") && bentPose(now.pose)) {
      const j = poseJoints(now.pose, now.since, 0), idle = f.clips.get("idle")!; f.rig!.g.visible = false; f.xg.visible = true;
      f.mixer.stopAllAction(); f.mixer.clipAction(idle).reset().play(); f.mixer.setTime(0); f.xg.position.set(0, 0, 0); n.root.updateMatrixWorld(true);
      const bones = bonesOf(f.xg), hips = bones["Hips"];
      if (hips) {
        const rest = hips.getWorldPosition(new THREE.Vector3()).y - n.root.position.y;
        (["Left", "Right"] as const).forEach((side, i) => { const u = bones[side + "UpLeg"], l = bones[side + "Leg"]; if (u) u.rotateX(-j.hip[i]); if (l) l.rotateX(j.knee[i]); const arm = bones[side + "Arm"], fore = bones[side + "ForeArm"]; if (arm) swingForward(f.xg!, arm, j.shoulder[i]); if (fore) swingForward(f.xg!, fore, j.elbow[i]); });
        f.xg.position.y = hipHeight(j, f.height) - rest;
      }
    } else { if (f.xg) f.xg.visible = false; f.rig!.g.visible = true; poseRig(f.rig!, poseJoints(now.pose, now.since, now.walked * (now.pose === "running" ? 2.1 : 4.5))); }
  }
  function rebuildCameras() {
    for (const o of [...camLayer.children]) { camLayer.remove(o); free(o); }
    keyRigs.length = 0;
    if (!world || !opts.helpers) return;
    const activeId = shotOf(world).cameraId;
    for (const cam of world.cameras) {
      if (!cam.showPath && cam.id !== activeId) continue;
      const dur = Math.max(...world.shots.filter((s) => s.cameraId === cam.id).map((s) => s.durationS), cam.keys[cam.keys.length - 1].t, 1);
      if (cam.keys.length > 1 && cam.showPath) {
        const pts: THREE.Vector3[] = []; for (let i = 0; i <= 120; i++) pts.push(new THREE.Vector3(...cameraAt(world, cam, (i / 120) * dur).key.pos));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: cam.id === activeId ? 0xd9dcff : 0x8a8fa8 })); camLayer.add(line);
      }
      cam.keys.forEach((k, i) => {
        const sel = selected?.kind === "key" && selected.camId === cam.id && selected.index === i;
        const body = cameraBody(sel ? 0x4f6bff : 0x15161b); body.position.set(...k.pos); body.lookAt(...k.look);
        body.userData.camKey = { camId: cam.id, index: i }; body.traverse((o) => { o.userData.camKey = body.userData.camKey; });
        camLayer.add(body); keyRigs.push(body);
      });
    }
  }
  function updateLabels() {
    if (!world || !opts.helpers) return;
    let ext = 8; for (const it of world.items) if (it.id !== "floor") ext = Math.max(ext, Math.abs(it.pos[0]) + 2, Math.abs(it.pos[2]) + 2);
    for (const c of world.cameras) for (const k of c.keys) ext = Math.max(ext, Math.abs(k.pos[0]) + 1, Math.abs(k.pos[2]) + 1);
    const step = ext <= 10 ? 2 : ext <= 32 ? 5 : ext <= 70 ? 10 : 25; if (step === labelStep) return; labelStep = step;
    for (const o of [...labels.children]) { labels.remove(o); free(o); }
    const n = Math.min(12, Math.ceil(ext / step));
    const label = (txt: string, x: number, z: number) => {
      const c = document.createElement("canvas"); c.width = 128; c.height = 48; const g = c.getContext("2d")!; g.font = "600 30px Inter, system-ui, sans-serif"; g.fillStyle = "rgba(220,224,240,.75)"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 64, 24);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.position.set(x, 0.12, z); const k = step * 0.16; s.scale.set(k * 2.66, k, 1); labels.add(s);
    };
    for (let i = -n; i <= n; i++) { if (!i) continue; label(`${i * step}m`, i * step, 0); label(`${i * step}m`, 0, i * step); }
  }
  function setWorld(next: World) {
    const prevSimple = world?.simpleFigures; world = next;
    scene.background = new THREE.Color(next.sky); scene.fog = new THREE.Fog(next.sky, 80, 900);
    (ground.material as THREE.MeshStandardMaterial).color.set(next.ground);
    const seen = new Set<string>();
    for (const it of next.items) {
      seen.add(it.id); const old = nodes.get(it.id), sig = signature(it);
      if (old && old.signature === sig && prevSimple === next.simpleFigures) { old.item = it; continue; }
      if (old) { world3.remove(old.root); free(old.root); }
      const n = buildNode(it); nodes.set(it.id, n); world3.add(n.root);
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { world3.remove(n.root); free(n.root); nodes.delete(id); }
    for (const n of nodes.values()) place(n);
    labelStep = 0; updateLabels(); rebuildCameras(); reattach(); invalidate();
  }
  function setAssets(a: Assets) { assets = a; if (world) { for (const n of nodes.values()) { world3.remove(n.root); free(n.root); } nodes.clear(); setWorld(world); } }

  // ---- time, mode, selection ----
  function setTime(next: number) { t = next; for (const n of nodes.values()) place(n); placeLive(); if (selected?.kind === "item") selBox.update(); invalidate(); }
  function placeLive() {
    if (!world) return;
    const now = cameraAt(world, cameraOf(world), t);
    liveCam.position.set(...now.key.pos); liveCam.lookAt(...now.key.look);
    liveCam.visible = opts.helpers && mode !== "camera" && mode !== "shoot";
    const ar = ASPECT_RATIO[world.aspect], d = 1.6, hh = Math.tan((now.fov * D2R) / 2) * d, hw = hh * ar, o = new THREE.Vector3(...now.key.pos);
    const fwd = new THREE.Vector3(...now.key.look).sub(o).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => o.clone().addScaledVector(fwd, d).addScaledVector(right, a * hw).addScaledVector(up, b * hh)), seg: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) seg.push(o, c[i], c[i], c[(i + 1) % 4]);
    frustum.geometry.setFromPoints(seg); frustum.visible = liveCam.visible && mode === "motion";
  }
  function setMode(m: ViewMode) {
    mode = m; if (orbit) orbit.enabled = m === "compose" || m === "motion";
    helpers.visible = opts.helpers && (m === "compose" || m === "motion");
    grid.visible = true; reattach(); placeLive(); invalidate();
  }
  function reattach() {
    if (!gizmo) return;
    gizmo.detach(); selBox.visible = false;
    if (mode !== "compose" && mode !== "motion") return;
    if (selected?.kind === "item") { const n = nodes.get(selected.id); if (n && !n.item.locked) { gizmo.attach(n.root); selBox.setFromObject(n.root); selBox.visible = true; } }
    else if (selected?.kind === "key") { const r = keyRigs.find((o) => o.userData.camKey?.camId === (selected as { camId: string }).camId && o.userData.camKey?.index === (selected as { index: number }).index); if (r) { gizmo.attach(r); } }
  }
  function select(p: Pick) { selected = p; rebuildCameras(); reattach(); invalidate(); }
  if (gizmo && orbit) {
    gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !(e as unknown as { value: boolean }).value; if (!(e as unknown as { value: boolean }).value && selected && gizmo.object) listeners.change?.(selected, gizmo.object); });
    gizmo.addEventListener("objectChange", () => { if (selected?.kind === "item") selBox.update(); invalidate(); });
  }
  orbit?.addEventListener("change", () => invalidate());

  // ---- free camera (Enter camera and Shoot) ----
  function setFree(f: FreeCam) { free_ = { pos: [...f.pos] as Vec3, yaw: f.yaw, pitch: Math.max(-1.45, Math.min(1.45, f.pitch)) }; invalidate(); }
  const getFree = () => ({ ...free_, pos: [...free_.pos] as Vec3 });
  function nudge(forward: number, right: number, up: number) {
    const f = free_, fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    setFree({ ...f, pos: [f.pos[0] + fx * forward - fz * right, Math.max(0.05, f.pos[1] + up), f.pos[2] + fz * forward + fx * right] });
  }

  // ---- drawing ----
  let composer: EffectComposer | null = null, bokeh: BokehPass | null = null;
  function ensureComposer() {
    if (composer || !dofOn) return;
    try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, shotCam)); bokeh = new BokehPass(scene, shotCam, { focus: 7, aperture: 0.002, maxblur: 0.008 }); composer.addPass(bokeh); composer.addPass(new OutputPass()); }
    catch { composer = null; dofOn = false; }
  }
  function aimShot(k: CamKey | { pos: Vec3; look: Vec3; lensMm: number }, fov: number, aspect: number) {
    shotCam.fov = fov; shotCam.aspect = aspect; shotCam.near = 0.15; shotCam.updateProjectionMatrix();
    shotCam.position.set(...k.pos); shotCam.up.set(0, 1, 0); shotCam.lookAt(...k.look);
  }
  function currentShotKey(): CamKey | null { if (!world) return null; return cameraAt(world, cameraOf(world), t).key; }
  function renderShot(x: number, y: number, w: number, h: number, withDof: boolean, fStop?: number, focusM?: number) {
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.setScissorTest(true);
    const hv = helpers.visible, gv = gizmoHelper?.visible ?? false, fv = focusMark.visible; helpers.visible = false; if (gizmoHelper) gizmoHelper.visible = false; if (!opts.helpers || mode !== "camera") focusMark.visible = false;
    if (withDof && fStop != null && fStop <= 5.6 && focusM != null) {
      ensureComposer();
      if (composer && bokeh) {
        composer.setSize(W, H);
        const u = bokeh.uniforms as unknown as Record<string, { value: number }>;
        u.focus.value = focusM; u.aperture.value = (0.0065 / fStop) * (shotCam.fov < 30 ? 1.6 : 1); u.maxblur.value = 0.012;
        renderer.setScissorTest(false); composer.render();
        helpers.visible = hv; if (gizmoHelper) gizmoHelper.visible = gv; focusMark.visible = fv; return;
      }
    }
    renderer.render(scene, shotCam);
    helpers.visible = hv; if (gizmoHelper) gizmoHelper.visible = gv; focusMark.visible = fv;
  }
  function draw() {
    frame = 0; if (disposed || !world) return;
    orbit?.update();
    // keep camera icons a readable size on screen however far away they are
    if (opts.helpers) for (const r of [...keyRigs, liveCam]) r.scale.setScalar(Math.max(1, Math.min(60, edit.position.distanceTo(r.position) / 22)));
    renderer.setClearColor(scene.background as THREE.Color);
    const ar = ASPECT_RATIO[world.aspect];
    if (mode === "camera" || mode === "shoot" || !opts.helpers) {
      // the camera's own view, framed to the shot's aspect ratio inside the canvas
      const key = opts.helpers ? { pos: free_.pos, look: lookFrom(free_), lensMm: frameLens, fStop: frameF, focusM: frameFocus } : currentShotKey()!;
      const fov = opts.helpers ? cameraFovFor(frameLens) : cameraAt(world, cameraOf(world), t).fov;
      let fw = W, fh = W / ar; if (fh > H) { fh = H; fw = H * ar; }
      const fx = Math.round((W - fw) / 2), fy = Math.round((H - fh) / 2);
      renderer.setScissorTest(false); renderer.clear();
      aimShot(key as CamKey, fov, ar);
      if (opts.helpers) { shotCam.aspect = W / H; shotCam.fov = (2 * Math.atan(Math.tan((fov * D2R) / 2) * (H / fh))) / D2R; shotCam.updateProjectionMatrix(); renderShot(0, 0, W, H, dofOn, frameF, frameFocus); }
      else renderShot(fx, fy, Math.round(fw), Math.round(fh), true, (key as CamKey).fStop, (key as CamKey).focusM);
      renderer.setScissorTest(false);
    } else {
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      edit.aspect = W / H; edit.updateProjectionMatrix();
      renderer.render(scene, edit);
      if (previewRect && previewRect.w > 10) {
        const now = cameraAt(world, cameraOf(world), t), pr = previewRect, ph = pr.w / ar;
        aimShot(now.key, now.fov, ar);
        renderShot(Math.round(pr.x), Math.round(H - pr.y - ph), Math.round(pr.w), Math.round(ph), false);
        renderer.setScissorTest(false);
      }
    }
    listeners.render?.();
  }
  let frameLens = 35, frameF = 8, frameFocus = 7;
  const cameraFovFor = (lens: number) => (world ? cameraAt({ ...world }, { id: "x", name: "x", showPath: false, keys: [{ t: 0, pos: [0, 0, 0], look: [0, 0, 1], lensMm: lens, fStop: 8, focusM: 5, ease: "smooth" }] }, 0).fov : 40);
  function invalidate() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
  function resize(w: number, h: number) { W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h)); renderer.setSize(W, H, false); invalidate(); }

  // ---- picking ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function toNdc(clientX: number, clientY: number) { const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); }
  function pick(clientX: number, clientY: number): Pick {
    toNdc(clientX, clientY); ray.setFromCamera(ndc, edit);
    const hitsK = keyRigs.length ? ray.intersectObjects(keyRigs, true) : [];
    const hits = ray.intersectObjects(world3.children, true);
    const dk = hitsK[0]?.distance ?? Infinity, di = hits.find((h) => h.object.userData.itemId && h.object.userData.itemId !== "floor")?.distance ?? Infinity;
    if (dk < di && hitsK[0]) { const ck = hitsK[0].object.userData.camKey; return { kind: "key", camId: ck.camId, index: ck.index }; }
    const h = hits.find((x) => x.object.userData.itemId && x.object.userData.itemId !== "floor");
    if (h) return { kind: "item", id: h.object.userData.itemId };
    const fl = hits.find((x) => x.object.userData.itemId === "floor"); return fl ? { kind: "item", id: "floor" } : null;
  }
  /** The distance from the camera (the free camera in camera mode) to what is under the pointer, for focus picking. */
  function focusAt(clientX: number, clientY: number): number | null {
    toNdc(clientX, clientY);
    const cam = mode === "camera" || mode === "shoot" ? shotCam : edit; ray.setFromCamera(ndc, cam);
    const hits = ray.intersectObjects([...world3.children, ground], true); if (!hits.length) return null;
    focusMark.position.copy(hits[0].point).add(new THREE.Vector3(0, 0.02, 0)); focusMark.lookAt(cam.position); focusMark.visible = true; invalidate();
    return Math.round(hits[0].distance * 10) / 10;
  }
  /** A point on the floor under the pointer (where a dropped thing lands). */
  function floorAt(clientX: number, clientY: number): Vec3 | null {
    toNdc(clientX, clientY); ray.setFromCamera(ndc, edit); const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? [Math.round(p.x * 10) / 10, 0, Math.round(p.z * 10) / 10] : null;
  }
  function frameAll() {
    if (!world || !orbit) return; const box = new THREE.Box3();
    for (const n of nodes.values()) if (n.item.id !== "floor" && n.root.visible) box.expandByObject(n.root);
    for (const c of world.cameras) for (const k of c.keys) box.expandByPoint(new THREE.Vector3(...k.pos));
    if (box.isEmpty()) box.set(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 2, 4));
    const c = box.getCenter(new THREE.Vector3()), r = Math.max(4, box.getSize(new THREE.Vector3()).length() * 0.62) * Math.max(1, Math.min(2.2, H / Math.max(1, W)));
    orbit.target.copy(c); edit.position.set(c.x + r * 0.62, c.y + r * 0.48, c.z + r * 0.9); edit.lookAt(c); invalidate();
  }
  function setGizmo(g: "translate" | "rotate" | "scale") { gizmo?.setMode(g); if (gizmo) gizmo.showY = true; invalidate(); }
  function setFrameLens(lens: number, f: number, focus: number) { frameLens = lens; frameF = f; frameFocus = focus; invalidate(); }
  function setPreview(r: Rect | null) { previewRect = r; invalidate(); }
  /** Draws the shot camera at time t once, synchronously (the recorder). */
  function drawNow() { if (frame) { cancelAnimationFrame(frame); frame = 0; } draw(); }
  function dispose() { disposed = true; if (frame) cancelAnimationFrame(frame); gizmo?.detach(); gizmo?.dispose(); orbit?.dispose(); for (const n of nodes.values()) free(n.root); free(scene); composer?.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  return {
    setWorld, setAssets, setTime, setMode, select, setGizmo, pick, focusAt, floorAt, frameAll, resize, invalidate, drawNow, dispose, setPreview, setFree, getFree, nudge, setFrameLens,
    onChange(cb: (p: Pick, o: THREE.Object3D) => void) { listeners.change = cb; },
    onRender(cb: () => void) { listeners.render = cb; },
    editCamera: () => ({ pos: edit.position.toArray() as Vec3, target: orbit?.target.toArray() as Vec3 | undefined }),
    hideFocus() { focusMark.visible = false; invalidate(); },
    canvas,
  };
}
export type WorldView = ReturnType<typeof createView>;
