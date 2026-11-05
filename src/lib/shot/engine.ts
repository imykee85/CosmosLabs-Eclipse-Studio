// ShotMap engine: everything that decides where things are at a given time. Pure functions of (scene, time), no clock, no randomness
// except seeded noise, so the editor, the guide renderer and the tests all see exactly the same frame.
import { ASPECTS, SENSORS, type AspectId, type Actor, type Camera, type Pose, type Scene, type Vehicle } from "./schema";

export type V3 = [number, number, number];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const smooth = (k: number) => k * k * (3 - 2 * k);

/** Vertical field of view in degrees for a lens on a sensor, cropped to the frame's aspect ratio. */
export function fovDeg(lensMm: number, sensor: keyof typeof SENSORS, aspect: AspectId): number {
  const w = SENSORS[sensor], h = w / ASPECTS[aspect];
  return (2 * Math.atan(h / (2 * lensMm)) * 180) / Math.PI;
}

/** Seeded generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Smooth, repeatable hand shake: a few sines with seeded phases, so the same seed always gives the same wobble. Returns six values in about -1..1. */
export function shakeAt(seed: number, freq: number, t: number): number[] {
  const r = rng(seed * 9973 + 17);
  const out: number[] = [];
  for (let ch = 0; ch < 6; ch++) {
    let v = 0;
    for (let k = 1; k <= 3; k++) v += Math.sin(2 * Math.PI * freq * k * 0.61 * t + r() * 6.283) / k;
    out.push(v / 1.83);
  }
  return out;
}

type Key<T> = { t: number; v: T };
function sample<T extends number[]>(keys: Key<T>[], t: number, mode: "smooth" | "linear"): T {
  if (keys.length === 1 || t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  if (mode === "linear") return a.v.map((x, n) => lerp(x, b.v[n], k)) as T;
  // Catmull-Rom through the keys, uniform in the segment, so a path never jumps at a key
  const p0 = (keys[i - 1] ?? a).v, p1 = a.v, p2 = b.v, p3 = (keys[i + 2] ?? b).v, k2 = k * k, k3 = k2 * k;
  return p1.map((_, n) => 0.5 * (2 * p1[n] + (-p0[n] + p2[n]) * k + (2 * p0[n] - 5 * p1[n] + 4 * p2[n] - p3[n]) * k2 + (-p0[n] + 3 * p1[n] - 3 * p2[n] + p3[n]) * k3)) as T;
}

export type CamState = { pos: V3; lookAt: V3; lensMm: number; roll: number; fov: number };
export function cameraAt(scene: Scene, cam: Camera, t: number, aspect: AspectId): CamState {
  const keys = cam.keys.map((k) => ({ t: k.t, v: [...k.pos, ...k.lookAt, k.lensMm, k.roll] as number[] }));
  const s = sample(keys, t, cam.interpolation);
  let pos: V3 = [s[0], s[1], s[2]], lookAt: V3 = [s[3], s[4], s[5]], roll = s[7];
  const lensMm = Math.max(8, s[6]);
  if (cam.trackSubjectId) { const p = thingAt(scene, cam.trackSubjectId, t); if (p) lookAt = [p.pos[0], p.pos[1] + 0.9, p.pos[2]]; }
  if (cam.shake.amount > 0) {
    const n = shakeAt(cam.shake.seed, cam.shake.frequency, t), a = cam.shake.amount;
    pos = [pos[0] + n[0] * 0.025 * a, pos[1] + n[1] * 0.02 * a, pos[2] + n[2] * 0.025 * a];
    lookAt = [lookAt[0] + n[3] * 0.05 * a, lookAt[1] + n[4] * 0.04 * a, lookAt[2] + n[5] * 0.05 * a];
    roll += n[0] * 0.9 * a;
  }
  return { pos, lookAt, lensMm, roll, fov: fovDeg(lensMm, cam.sensor, aspect) };
}

export type Placed = { pos: V3; facing: number; pose: Pose; poseT: number };
function groundAt(keys: { t: number; pos: [number, number] }[], t: number): { x: number; z: number; dx: number; dz: number } {
  const k = keys.map((m) => ({ t: m.t, v: [m.pos[0], m.pos[1]] as number[] }));
  const p = sample(k, t, "smooth"), q = sample(k, t + 0.05, "smooth");
  return { x: p[0], z: p[1], dx: q[0] - p[0], dz: q[1] - p[1] };
}
function poseAt(actions: Actor["actions"], t: number): { pose: Pose; since: number } {
  let pose: Pose = "standing", since = -99;
  for (const a of [...actions].sort((x, y) => x.t - y.t)) if (a.t <= t) { pose = a.pose; since = a.t; }
  return { pose, since };
}

export function vehicleAt(v: Vehicle, t: number): Placed {
  const g = groundAt(v.path, t), moving = Math.hypot(g.dx, g.dz) > 1e-5;
  const prev = groundAt(v.path, Math.max(0, t - 0.1)), head = Math.atan2(g.dx || prev.dx, g.dz || prev.dz);
  return { pos: [g.x, 0, g.z], facing: moving || prev.dx || prev.dz ? head : 0, pose: "driving", poseT: 0 };
}
export function actorAt(scene: Scene, a: Actor, t: number): Placed {
  const { pose, since } = poseAt(a.actions, t);
  if (a.parentId) {
    const v = scene.vehicles.find((x) => x.id === a.parentId);
    if (v) { const p = vehicleAt(v, t); const off = a.marks[0].pos; const c = Math.cos(p.facing), s = Math.sin(p.facing); return { pos: [p.pos[0] + off[0] * c + off[1] * s, 0.5, p.pos[2] - off[0] * s + off[1] * c], facing: p.facing, pose: "driving", poseT: t - since }; }
  }
  const g = groundAt(a.marks, t), speed = Math.hypot(g.dx, g.dz) / 0.05;
  const manual = a.marks.filter((m) => m.facing != null && m.t <= t).pop();
  const facing = speed > 0.05 ? Math.atan2(g.dx, g.dz) : manual?.facing != null ? (manual.facing * Math.PI) / 180 : 0;
  return { pos: [g.x, 0, g.z], facing, pose: speed > 3.2 ? "running" : speed > 0.25 && pose === "standing" ? "walking" : pose, poseT: t - since };
}
export function thingAt(scene: Scene, id: string, t: number): Placed | null {
  const a = scene.actors.find((x) => x.id === id); if (a) return actorAt(scene, a, t);
  const v = scene.vehicles.find((x) => x.id === id); return v ? vehicleAt(v, t) : null;
}

/** How a pose changes the stand-in body: height scale, drop, forward lean (radians), eased over a quarter of a second. */
export function poseShape(pose: Pose, since: number, walkPhase: number): { scaleY: number; drop: number; lean: number; bob: number } {
  const table: Record<Pose, { scaleY: number; drop: number; lean: number }> = {
    standing: { scaleY: 1, drop: 0, lean: 0 }, walking: { scaleY: 1, drop: 0, lean: 0.05 }, running: { scaleY: 1, drop: 0, lean: 0.25 },
    squatting: { scaleY: 0.55, drop: 0, lean: 0.12 }, "half-squat": { scaleY: 0.78, drop: 0, lean: 0.1 }, sitting: { scaleY: 0.62, drop: 0.3, lean: 0 },
    "hands-in-pockets": { scaleY: 1, drop: 0, lean: 0.04 }, leaning: { scaleY: 1, drop: 0, lean: 0.18 }, lying: { scaleY: 0.3, drop: 0, lean: 1.4 }, driving: { scaleY: 0.62, drop: 0, lean: 0 },
  };
  const to = table[pose], k = smooth(Math.min(1, Math.max(0, since / 0.25)));
  const from = table.standing;
  const moving = pose === "walking" || pose === "running";
  return { scaleY: lerp(from.scaleY, to.scaleY, k), drop: lerp(from.drop, to.drop, k), lean: lerp(from.lean, to.lean, k), bob: moving ? Math.abs(Math.sin(walkPhase)) * (pose === "running" ? 0.07 : 0.035) : 0 };
}
export { lerp3 };
