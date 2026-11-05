// Browser side of the guide renderer: builds the three.js scene from a Scene and draws one frame at a time (no clock, so frames repeat exactly).
// It is bundled for the render job and for the Phase 0 test script; the editor will reuse the same builders.
import * as THREE from "three";
import { actorAt, cameraAt, poseShape, vehicleAt } from "./engine";
import { ASPECTS, colorHex, type Actor, type AspectId, type Scene, type Vehicle } from "./schema";

const mat = (hex: string) => new THREE.MeshLambertMaterial({ color: hex });
function personMesh(a: Actor) {
  const g = new THREE.Group(), m = mat(colorHex(a.color)), h = a.heightM, r = 0.23;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.1, h - 2 * r - 0.22), 6, 16), m); body.position.y = (h - 0.22) / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), m); head.position.y = h - 0.17;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10), m); nose.rotation.x = Math.PI / 2; nose.position.set(0, h - 0.17, 0.2);
  const inner = new THREE.Group(); inner.add(body, head, nose); g.add(inner); return { g, inner, h };
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
        const pl = actorAt(scene, p.a, t), s = poseShape(pl.pose, pl.poseT, t * 6.5);
        p.g.position.set(pl.pos[0], pl.pos[1] + s.bob - s.drop, pl.pos[2]); p.g.rotation.y = pl.facing;
        p.inner.scale.y = s.scaleY; p.inner.rotation.x = s.lean; p.inner.position.y = 0;
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
