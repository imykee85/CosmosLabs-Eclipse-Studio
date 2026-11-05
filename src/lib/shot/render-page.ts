// Browser side of the guide renderer: builds the three.js scene from a Scene and draws one frame at a time (no clock, so frames repeat exactly).
// It is bundled for the render job and for the Phase 0 test script; the editor will reuse the same builders.
import * as THREE from "three";
import { BODY, actorAt, cameraAt, hipHeight, poseJoints, vehicleAt, type Joints } from "./engine";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FURNITURE_HEIGHT, MODEL_FILES, MODEL_NAMES, XBOT_CLIP, type ModelName } from "./assets";
import { ASPECTS, colorHex, type Actor, type AspectId, type Scene, type Vehicle } from "./schema";

/** Parsed model files, by name. Anything missing is simply not used. */
export type Assets = Partial<Record<ModelName, { scene: THREE.Object3D; animations: THREE.AnimationClip[] }>>;
const b64ToBuffer = (b64: string) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
/** Parses model files given as base64 (the render job) or as ArrayBuffers (the editor). A file that does not parse is left out. */
export async function loadAssets(files: Partial<Record<ModelName, string | ArrayBuffer>>): Promise<Assets> {
  const out: Assets = {}, loader = new GLTFLoader();
  await Promise.all(MODEL_NAMES.map(async (n) => {
    const f = files[n]; if (!f) return;
    try { const g = await loader.parseAsync(typeof f === "string" ? b64ToBuffer(f) : f, ""); out[n] = { scene: g.scene, animations: g.animations }; } catch { /* keep the stand-in */ }
  }));
  return out;
}
let assetCache: Promise<Assets> | null = null;
/** The editor's copy: fetches /shot-models once and keeps it. */
export function fetchAssets(): Promise<Assets> {
  assetCache ??= (async () => {
    const files: Partial<Record<ModelName, ArrayBuffer>> = {};
    await Promise.all(MODEL_NAMES.map(async (n) => { try { const r = await fetch(`/shot-models/${MODEL_FILES[n].file}`); if (r.ok) files[n] = await r.arrayBuffer(); } catch { /* offline: stand-ins */ } }));
    return loadAssets(files);
  })();
  return assetCache;
}
const bentPose = (pose: string) => ["sitting", "squatting", "driving"].includes(pose);
const bonesOf = (root: THREE.Object3D) => { const o: Record<string, THREE.Object3D> = {}; root.traverse((n) => { if (n.name.startsWith("mixamorig")) o[n.name.slice(9).replace(/^:/, "")] = n; }); return o; };
const tintTo = (root: THREE.Object3D, hex: string) => root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshLambertMaterial({ color: hex }); });
/** A copy of a loaded model scaled to `height` metres, standing on the ground with its middle at x 0, z 0. */
function fitModel(src: THREE.Object3D, height: number, skinned: boolean) {
  const root = skinned ? cloneSkinned(src) : src.clone(true), holder = new THREE.Group();
  holder.add(root); holder.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(root, true), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = size.y > 0 ? height / size.y : 1; root.scale.multiplyScalar(k); root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  return { holder, root };
}

const mat = (hex: string) => new THREE.MeshLambertMaterial({ color: hex });
type Rig = { g: THREE.Group; h: number; pelvis: THREE.Group; torso: THREE.Group; hips: THREE.Group[]; knees: THREE.Group[]; shoulders: THREE.Group[]; elbows: THREE.Group[] };
/** A smooth human mannequin, man or woman: ellipsoid head, neck, chest, waist and pelvis, tapered limbs with round joints, hands and feet. One colour, so the colour names the person. */
function personMesh(a: Actor): Rig {
  const m = mat(colorHex(a.color)), h = a.heightM, B = BODY, w = a.build === "woman";
  const ell = (rx: number, ry: number, rz: number) => { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m); e.scale.set(rx * h, ry * h, rz * h); return e; };
  // a limb from y = 0 down to y = -len, radius rTop at the top and rBot at the bottom, with a swell in the middle (muscle)
  const limb = (len: number, rTop: number, rBot: number, swell: number) => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len * h)];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2((rBot + (rTop - rBot) * t + swell * Math.sin(Math.PI * t)) * h, (-len + len * t) * h)); }
    pts.push(new THREE.Vector2(0, 0));
    return new THREE.Mesh(new THREE.LatheGeometry(pts, 14), m);
  };
  const g = new THREE.Group(), pelvis = new THREE.Group(), torso = new THREE.Group();
  g.add(pelvis); pelvis.add(torso);
  const hipHalf = w ? 0.056 : 0.05, shoulderHalf = w ? 0.108 : 0.13;
  // pelvis, waist, chest, neck, head
  const pel = ell(w ? 0.108 : 0.088, 0.062, 0.075); pel.position.y = 0.012 * h; pelvis.add(pel);
  const waist = ell(w ? 0.07 : 0.076, 0.08, w ? 0.062 : 0.07); waist.position.y = 0.1 * h; torso.add(waist);
  const chest = ell(w ? 0.088 : 0.124, w ? 0.105 : 0.092, w ? 0.072 : 0.088); chest.position.y = 0.215 * h; torso.add(chest);
  if (w) for (const s of [1, -1]) { const b = ell(0.034, 0.034, 0.036); b.position.set(s * 0.04 * h, 0.225 * h, 0.066 * h); torso.add(b); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * h, 0.03 * h, 0.06 * h, 12), m); neck.position.y = (B.torso + 0.012) * h; torso.add(neck);
  const head = ell(w ? 0.052 : 0.058, 0.07, w ? 0.063 : 0.068); head.position.y = (B.torso + 0.095) * h; torso.add(head);
  const jaw = ell(w ? 0.038 : 0.046, 0.04, w ? 0.05 : 0.054); jaw.position.set(0, (B.torso + 0.062) * h, 0.012 * h); torso.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012 * h, 0.034 * h, 8), m); nose.rotation.x = Math.PI / 2; nose.position.set(0, (B.torso + 0.09) * h, 0.074 * h); torso.add(nose);
  const hips: THREE.Group[] = [], knees: THREE.Group[] = [], shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const hip = new THREE.Group(); hip.position.x = side * hipHalf * h; pelvis.add(hip); hips.push(hip);
    hip.add(limb(B.thigh, w ? 0.057 : 0.056, w ? 0.034 : 0.036, w ? 0.004 : 0.007));
    const knee = new THREE.Group(); knee.position.y = -B.thigh * h; hip.add(knee); knees.push(knee);
    const kj = ell(0.032, 0.032, 0.032); knee.add(kj);
    const shin = limb(B.shin, 0.034, 0.02, w ? 0.004 : 0.007); shin.rotation.y = 0; knee.add(shin);
    const foot = ell(0.027, 0.02, 0.07); foot.position.set(0, -B.shin * h + 0.012 * h, 0.034 * h); knee.add(foot);
    const sh = new THREE.Group(); sh.position.set(side * shoulderHalf * h, (B.torso - 0.035) * h, 0); torso.add(sh); shoulders.push(sh);
    sh.add(ell(w ? 0.036 : 0.044, w ? 0.036 : 0.044, w ? 0.036 : 0.044));
    sh.add(limb(B.upperArm, w ? 0.03 : 0.037, w ? 0.024 : 0.028, w ? 0.002 : 0.005));
    const el = new THREE.Group(); el.position.y = -B.upperArm * h; sh.add(el); elbows.push(el);
    el.add(ell(0.026, 0.026, 0.026));
    el.add(limb(B.foreArm, w ? 0.026 : 0.03, 0.017, w ? 0.002 : 0.005));
    const hand = ell(0.02, 0.042, 0.012); hand.position.y = -(B.foreArm + 0.036) * h; el.add(hand);
  }
  return { g, h, pelvis, torso, hips, knees, shoulders, elbows };
}
function poseRig(r: Rig, j: Joints) {
  r.pelvis.position.y = hipHeight(j, r.h);
  r.g.rotation.x = j.pitch; r.torso.rotation.x = j.lean;
  for (let i = 0; i < 2; i++) { r.hips[i].rotation.x = -j.hip[i]; r.knees[i].rotation.x = j.knee[i]; r.shoulders[i].rotation.x = -j.shoulder[i]; r.elbows[i].rotation.x = -j.elbow[i]; }
}
function vehicleMesh(v: Vehicle) {
  const g = new THREE.Group(), m = mat(colorHex(v.color));
  const closed = v.type === "truck" || v.type === "van"; // cars and pickups are open so the driver stand-in shows
  const L = v.type === "truck" ? 6.5 : v.type === "van" ? 5 : v.type === "bike" ? 2 : v.type === "pickup" ? 5 : 4.3, W = v.type === "bike" ? 0.5 : 1.9, H = closed ? 1.7 : 0.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), m); body.position.y = 0.55 + H / 2;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.55, L * 0.45), mat("#f4f4f4")); cab.position.set(0, 0.55 + H + 0.2, -L * 0.05);
  g.add(body); if (closed) g.add(cab);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18), mat("#222")); w.rotation.z = Math.PI / 2; w.position.set(x * (W / 2), 0.36, z * L * 0.32); g.add(w); }
  return g;
}

// One WebGL renderer per canvas: the editor rebuilds the scene on every edit and a canvas cannot get a second context after the first is lost.
const renderers = new WeakMap<HTMLCanvasElement, THREE.WebGLRenderer>();
/** Frees a canvas's renderer for good (when the panel closes). */
export function release(canvas: HTMLCanvasElement) { const r = renderers.get(canvas); if (r) { r.dispose(); r.forceContextLoss(); renderers.delete(canvas); } }

/** Everything in the scene that is not the camera: light, ground, set pieces, people, vehicles. `pose(t)` places the people and vehicles at time t. */
function populate(scene: Scene, three: THREE.Scene, assets: Assets = {}) {
  three.add(new THREE.AmbientLight(0xffffff, 0.85)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-8, 14, 10); three.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(scene.set.groundSize, scene.set.groundSize), mat(scene.set.groundColor)); ground.rotation.x = -Math.PI / 2; three.add(ground);
  const modelled = new Set<string>();
  for (const m of scene.models) {
    const a = assets[m.type]; if (!a) continue;
    const { holder } = fitModel(a.scene, FURNITURE_HEIGHT[m.type] * m.scale, false);
    holder.position.set(...m.pos); holder.rotation.y = (m.rotY * Math.PI) / 180; three.add(holder); modelled.add(m.id + "-");
  }
  for (const p of scene.set.props) {
    if ([...modelled].some((x) => p.id.startsWith(x))) continue;
    const geo = p.kind === "cylinder" ? new THREE.CylinderGeometry(p.size[0] / 2, p.size[0] / 2, p.size[1], 24) : new THREE.BoxGeometry(...p.size);
    const pm = mat(p.color); if (p.opacity < 1) { pm.transparent = true; pm.opacity = p.opacity; pm.depthWrite = false; } const m = new THREE.Mesh(geo, pm); m.position.set(...p.pos); m.rotation.y = (p.rotY * Math.PI) / 180; three.add(m);
  }
  const people = scene.actors.map((a) => {
    const rig = personMesh(a), x = assets.xbot;
    if (!x || !x.animations.length) return { a, ...rig, xg: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null, clips: new Map<string, THREE.AnimationClip>() };
    const { holder, root } = fitModel(x.scene, a.heightM, true); tintTo(root, colorHex(a.color));
    const mixer = new THREE.AnimationMixer(root), clips = new Map(x.animations.map((c) => [c.name, c] as const)); holder.visible = false;
    return { a, ...rig, xg: holder, mixer, clips };
  });
  for (const p of people) { three.add(p.g); if (p.xg) three.add(p.xg); }
  const cars = scene.vehicles.map((v) => ({ v, g: vehicleMesh(v) })); for (const c of cars) three.add(c.g);
  return {
    pose(t: number) {
      for (const c of cars) { const p = vehicleAt(c.v, t); c.g.position.set(...p.pos); c.g.rotation.y = p.facing; }
      for (const p of people) {
        const pl = actorAt(scene, p.a, t);
        p.g.position.set(pl.pos[0], pl.pos[1], pl.pos[2]); p.g.rotation.y = pl.facing;
        const use = p.xg && p.mixer ? XBOT_CLIP[pl.pose] : undefined, clip = use ? p.clips.get(use.clip) : undefined;
        if (p.xg && p.mixer && use && clip) {
          p.g.visible = false; p.xg.visible = true; p.xg.position.set(pl.pos[0], pl.pos[1], pl.pos[2]); p.xg.rotation.y = pl.facing;
          const tt = use.strideM ? (pl.walked / use.strideM) * clip.duration : pl.poseT; p.mixer.stopAllAction(); p.mixer.clipAction(clip).reset().play(); p.mixer.setTime(((tt % clip.duration) + clip.duration) % clip.duration);
        } else if (p.xg && p.mixer && p.clips.get("idle") && bentPose(pl.pose)) {
          // no clip for this pose: the mannequin stands at rest, then its legs are bent by the same joint angles as the stand-in
          const j = poseJoints(pl.pose, pl.poseT, 0), idle = p.clips.get("idle")!; p.g.visible = false; p.xg.visible = true; p.xg.rotation.y = pl.facing;
          p.mixer.stopAllAction(); p.mixer.clipAction(idle).reset().play(); p.mixer.setTime(0); p.xg.position.set(pl.pos[0], pl.pos[1], pl.pos[2]); p.xg.updateMatrixWorld(true);
          const bones = bonesOf(p.xg), hips = bones["Hips"]; if (hips) {
            const rest = hips.getWorldPosition(new THREE.Vector3()).y - pl.pos[1];
            (["Left", "Right"] as const).forEach((side, i) => { const u = bones[side + "UpLeg"], l = bones[side + "Leg"]; if (u) u.rotateX(-j.hip[i]); if (l) l.rotateX(j.knee[i]); });
            p.xg.position.y = pl.pos[1] + hipHeight(j, p.a.heightM) - rest;
          }
        } else { p.g.visible = true; if (p.xg) p.xg.visible = false; poseRig(p, poseJoints(pl.pose, pl.poseT, pl.walked * (pl.pose === "running" ? 2.1 : 4.5))); }
      }
    },
  };
}
const freeScene = (three: THREE.Scene) => three.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); });
const rendererFor = (canvas: HTMLCanvasElement, preserve: boolean) => { const r = renderers.get(canvas) ?? new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve }); renderers.set(canvas, r); return r; };

export function build(scene: Scene, width: number, height: number, existing?: HTMLCanvasElement, assets?: Assets) {
  const canvas = existing ?? document.createElement("canvas"); canvas.width = width; canvas.height = height; if (!existing) document.body.appendChild(canvas);
  const renderer = rendererFor(canvas, true);
  renderer.setSize(width, height, false); renderer.setPixelRatio(1);
  const three = new THREE.Scene(); three.background = new THREE.Color(scene.set.sky); three.fog = new THREE.Fog(scene.set.sky, 60, 220);
  const pop = populate(scene, three, assets);
  const cam = new THREE.PerspectiveCamera(40, width / height, 0.05, 600);
  let sc = scene;
  return {
    /** Camera and shot edits do not rebuild the world: the panel hands over the newer scene and draws again. */
    setScene(next: Scene) { sc = next; },
    /** Draws the shot at time t (seconds from the start of the shot) on the canvas. */
    drawAt(shotIndex: number, local: number) {
      const sh = sc.shots[shotIndex], camera = sc.cameras.find((c) => c.id === sh.cameraId)!, t = sh.startS + local;
      pop.pose(t);
      const cs = cameraAt(sc, camera, t, sh.aspect as AspectId);
      cam.fov = cs.fov; cam.aspect = ASPECTS[sh.aspect as AspectId]; cam.updateProjectionMatrix();
      cam.position.set(...cs.pos); cam.up.set(0, 1, 0); cam.lookAt(...cs.lookAt); cam.rotateZ((cs.roll * Math.PI) / 180);
      renderer.render(three, cam);
    },
    frame(shotIndex: number, index: number): string { this.drawAt(shotIndex, index / sc.fps); return canvas.toDataURL("image/jpeg", 0.92); },
    /** Frees what this scene built; the canvas keeps its renderer for the next scene. */
    dispose() { freeScene(three); },
  };
}

export type Orbit = { az: number; el: number; dist: number; tx: number; ty: number; tz: number };
/** A sensible first view of the whole set: from the front-right and above, far enough to see the cast, the camera and its path. */
export function fitOrbit(scene: Scene): Orbit {
  const pts: [number, number][] = [];
  for (const a of scene.actors) for (const m of a.marks) pts.push(m.pos);
  for (const v of scene.vehicles) for (const k of v.path) pts.push(k.pos);
  for (const c of scene.cameras) for (const k of c.keys) pts.push([k.pos[0], k.pos[2]]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), x0 = Math.min(...xs, -3), x1 = Math.max(...xs, 3), z0 = Math.min(...zs, -3), z1 = Math.max(...zs, 3);
  return { az: 0.7, el: 0.5, dist: Math.max(9, Math.hypot(x1 - x0, z1 - z0) * 1.15), tx: (x0 + x1) / 2, ty: 0.9, tz: (z0 + z1) / 2 };
}

/** The Stage view: the whole set seen from outside, the shot camera drawn as real equipment (body, lens, finder), the exact view it frames drawn as a pyramid,
 * and the path it travels. The camera follows the playhead with every move the shot has (path, lens, roll, shake). Drag to orbit, wheel or pinch to zoom. */
export function buildStage(scene: Scene, canvas: HTMLCanvasElement, width: number, height: number, orbit: Orbit, assets?: Assets) {
  canvas.width = width; canvas.height = height;
  const renderer = rendererFor(canvas, false); renderer.setSize(width, height, false); renderer.setPixelRatio(1);
  const three = new THREE.Scene(); three.background = new THREE.Color("#0d0d10");
  const pop = populate(scene, three, assets);
  const grid = new THREE.GridHelper(80, 80, 0x4a5080, 0x2a2e4a); grid.position.y = 0.02; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.5; three.add(grid);
  const sh = scene.shots[0], camData = scene.cameras.find((c) => c.id === sh.cameraId)!, aspect = ASPECTS[sh.aspect as AspectId];
  // the camera: body, lens, rim, glass, finder and a red light, built like Change Camera's
  const rig = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.45, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.26), dark);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 24), new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.35, metalness: 0.6 })); lens.rotation.x = Math.PI / 2; lens.position.z = 0.25;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xc9c9d2, roughness: 0.3, metalness: 0.8 })); rim.rotation.x = Math.PI / 2; rim.position.z = 0.37;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshBasicMaterial({ color: 0x3c4cff })); glass.position.z = 0.375;
  const finder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.14), dark); finder.position.set(0, 0.2, -0.02);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: 0xd90b0b })); light.position.set(0.17, 0.1, 0.14);
  rig.add(body, lens, rim, glass, finder, light);
  // the framed view: four edges from the lens to the far corners, the far rectangle, and a faint pyramid
  const frustum = new THREE.Group(); rig.add(frustum);
  const edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd90b0b })); frustum.add(edges);
  const faces = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xd90b0b, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })); frustum.add(faces);
  three.add(rig);
  // the path the camera travels (without shake) and its keys
  const samples: THREE.Vector3[] = [];
  // one path per shot (a cut to another camera is another path), each with its key dots
  for (const shp of scene.shots) {
    const cd = scene.cameras.find((c) => c.id === shp.cameraId)!, Ts = Math.max(0.5, shp.endS - shp.startS), still2 = { ...cd, shake: { ...cd.shake, amount: 0 } }, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) { const c = cameraAt(scene, still2, shp.startS + (i / 80) * Ts, shp.aspect as AspectId); pts.push(new THREE.Vector3(...c.pos)); }
    const pathN = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x8a5cf5, dashSize: 0.35, gapSize: 0.2 })); pathN.computeLineDistances(); three.add(pathN);
    for (const k of cd.keys) { if (k.t < shp.startS - 1e-6 || k.t > shp.endS + 1e-6) continue; const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8a5cf5 })); d.position.set(...k.pos); three.add(d); }
  }
  void samples;
  const view = new THREE.PerspectiveCamera(42, width / height, 0.1, 800);
  const tmp = new THREE.Vector3();
  return {
    drawAt(local: number) {
      const t = sh.startS + local, cur = scene.shots.find((x) => t >= x.startS && t < x.endS) ?? scene.shots[scene.shots.length - 1], camNow = scene.cameras.find((c) => c.id === cur.cameraId) ?? camData;
      pop.pose(t);
      const cs = cameraAt(scene, camNow, t, sh.aspect as AspectId);
      rig.position.set(...cs.pos); rig.up.set(0, 1, 0); rig.lookAt(...cs.lookAt); rig.rotateZ((cs.roll * Math.PI) / 180);
      const k = Math.max(1, orbit.dist * 0.055); rig.scale.setScalar(k);
      const D = Math.min(9, Math.max(2.5, tmp.set(...cs.lookAt).distanceTo(rig.position))) / k; // depth of the drawn view, in rig units
      const hh = Math.tan((cs.fov * Math.PI) / 360) * D, hw = hh * aspect, c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => new THREE.Vector3(x, y, D));
      const apex = new THREE.Vector3(0, 0, 0.37), seg: THREE.Vector3[] = [];
      for (let i = 0; i < 4; i++) { seg.push(apex, c[i], c[i], c[(i + 1) % 4]); }
      edges.geometry.setFromPoints(seg);
      faces.geometry.setFromPoints([apex, c[0], c[1], apex, c[1], c[2], apex, c[2], c[3], apex, c[3], c[0]]);
      view.aspect = width / height; view.updateProjectionMatrix();
      view.position.set(orbit.tx + orbit.dist * Math.sin(orbit.az) * Math.cos(orbit.el), orbit.ty + orbit.dist * Math.sin(orbit.el), orbit.tz + orbit.dist * Math.cos(orbit.az) * Math.cos(orbit.el));
      view.lookAt(orbit.tx, orbit.ty, orbit.tz);
      renderer.render(three, view);
    },
    dispose() { freeScene(three); },
  };
}
(globalThis as unknown as { ShotRender: unknown }).ShotRender = { build, loadAssets };
