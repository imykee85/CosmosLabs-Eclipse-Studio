// Browser side of the guide renderer: builds the three.js scene from a Scene and draws one frame at a time (no clock, so frames repeat exactly).
// It is bundled for the render job and for the Phase 0 test script; the editor will reuse the same builders.
import * as THREE from "three";
import { BODY, actorAt, cameraAt, hipHeight, poseJoints, vehicleAt, type Joints } from "./engine";
import { ASPECTS, colorHex, type Actor, type AspectId, type Scene, type Vehicle } from "./schema";

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

export function build(scene: Scene, width: number, height: number, existing?: HTMLCanvasElement) {
  const canvas = existing ?? document.createElement("canvas"); canvas.width = width; canvas.height = height; if (!existing) document.body.appendChild(canvas);
  const renderer = renderers.get(canvas) ?? new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); renderers.set(canvas, renderer);
  renderer.setSize(width, height, false); renderer.setPixelRatio(1);
  const three = new THREE.Scene(); three.background = new THREE.Color(scene.set.sky); three.fog = new THREE.Fog(scene.set.sky, 60, 220);
  three.add(new THREE.AmbientLight(0xffffff, 0.85)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-8, 14, 10); three.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(scene.set.groundSize, scene.set.groundSize), mat(scene.set.groundColor)); ground.rotation.x = -Math.PI / 2; three.add(ground);
  for (const p of scene.set.props) {
    const geo = p.kind === "cylinder" ? new THREE.CylinderGeometry(p.size[0] / 2, p.size[0] / 2, p.size[1], 24) : new THREE.BoxGeometry(...p.size);
    const pm = mat(p.color); if (p.opacity < 1) { pm.transparent = true; pm.opacity = p.opacity; pm.depthWrite = false; } const m = new THREE.Mesh(geo, pm); m.position.set(...p.pos); m.rotation.y = (p.rotY * Math.PI) / 180; three.add(m);
  }
  const people = scene.actors.map((a) => ({ a, ...personMesh(a) })); for (const p of people) three.add(p.g);
  const cars = scene.vehicles.map((v) => ({ v, g: vehicleMesh(v) })); for (const c of cars) three.add(c.g);
  const cam = new THREE.PerspectiveCamera(40, width / height, 0.05, 600);
  return {
    /** Draws the shot at time t (seconds from the start of the shot) on the canvas. */
    drawAt(shotIndex: number, local: number) {
      const sh = scene.shots[shotIndex], camera = scene.cameras.find((c) => c.id === sh.cameraId)!, t = sh.startS + local;
      for (const c of cars) { const p = vehicleAt(c.v, t); c.g.position.set(...p.pos); c.g.rotation.y = p.facing; }
      for (const p of people) {
        const pl = actorAt(scene, p.a, t);
        p.g.position.set(pl.pos[0], pl.pos[1], pl.pos[2]); p.g.rotation.y = pl.facing;
        poseRig(p, poseJoints(pl.pose, pl.poseT, pl.walked * (pl.pose === "running" ? 2.1 : 4.5)));
      }
      const cs = cameraAt(scene, camera, t, sh.aspect as AspectId);
      cam.fov = cs.fov; cam.aspect = ASPECTS[sh.aspect as AspectId]; cam.updateProjectionMatrix();
      cam.position.set(...cs.pos); cam.up.set(0, 1, 0); cam.lookAt(...cs.lookAt); cam.rotateZ((cs.roll * Math.PI) / 180);
      renderer.render(three, cam);
    },
    frame(shotIndex: number, index: number): string { this.drawAt(shotIndex, index / scene.fps); return canvas.toDataURL("image/jpeg", 0.92); },
    /** Frees what this scene built; the canvas keeps its renderer for the next scene. */
    dispose() { three.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); }); },
  };
}
(globalThis as unknown as { ShotRender: unknown }).ShotRender = { build };
