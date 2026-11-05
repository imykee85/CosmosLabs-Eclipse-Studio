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

export type Placed = { pos: V3; facing: number; pose: Pose; poseT: number; walked: number };
function groundAt(keys: { t: number; pos: [number, number] }[], t: number): { x: number; z: number; dx: number; dz: number } {
  const k = keys.map((m) => ({ t: m.t, v: [m.pos[0], m.pos[1]] as number[] }));
  const p = sample(k, t, "smooth"), q = sample(k, t + 0.05, "smooth");
  return { x: p[0], z: p[1], dx: q[0] - p[0], dz: q[1] - p[1] };
}
/** Distance walked along the marks up to time t (metres), used to time the stride. */
function walkedTo(marks: Actor["marks"], t: number): number {
  let d = 0, prev = groundAt(marks, 0);
  for (let u = 0.1; u < t + 0.05; u += 0.1) { const g = groundAt(marks, Math.min(u, t)); d += Math.hypot(g.x - prev.x, g.z - prev.z); prev = g; }
  return d;
}
function poseAt(actions: Actor["actions"], t: number): { pose: Pose; since: number } {
  let pose: Pose = "standing", since = -99;
  for (const a of [...actions].sort((x, y) => x.t - y.t)) if (a.t <= t) { pose = a.pose; since = a.t; }
  return { pose, since };
}

export function vehicleAt(v: Vehicle, t: number): Placed {
  const g = groundAt(v.path, t), moving = Math.hypot(g.dx, g.dz) > 1e-5;
  const prev = groundAt(v.path, Math.max(0, t - 0.1)), head = Math.atan2(g.dx || prev.dx, g.dz || prev.dz);
  return { pos: [g.x, 0, g.z], facing: moving || prev.dx || prev.dz ? head : 0, pose: "driving", poseT: 0, walked: 0 };
}
export function actorAt(scene: Scene, a: Actor, t: number): Placed {
  const { pose, since } = poseAt(a.actions, t);
  if (a.parentId) {
    const v = scene.vehicles.find((x) => x.id === a.parentId);
    if (v) { const p = vehicleAt(v, t); const off = a.marks[0].pos; const c = Math.cos(p.facing), s = Math.sin(p.facing); return { pos: [p.pos[0] + off[0] * c + off[1] * s, 0.5, p.pos[2] - off[0] * s + off[1] * c], facing: p.facing, pose: "driving", poseT: t - since, walked: 0 }; }
  }
  const g = groundAt(a.marks, t), speed = Math.hypot(g.dx, g.dz) / 0.05;
  const manual = a.marks.filter((m) => m.facing != null && m.t <= t).pop();
  const facing = speed > 0.05 ? Math.atan2(g.dx, g.dz) : manual?.facing != null ? (manual.facing * Math.PI) / 180 : 0;
  return { pos: [g.x, 0, g.z], facing, pose: speed > 3.2 ? "running" : speed > 0.25 && pose === "standing" ? "walking" : pose, poseT: t - since, walked: walkedTo(a.marks, t) };
}
export function thingAt(scene: Scene, id: string, t: number): Placed | null {
  const a = scene.actors.find((x) => x.id === id); if (a) return actorAt(scene, a, t);
  const v = scene.vehicles.find((x) => x.id === id); return v ? vehicleAt(v, t) : null;
}

/** The stand-in body's joint angles in radians. Hips and shoulders: positive swings the limb forward. Knees and elbows: positive bends back / in. Lean: positive tips the torso forward. */
export type Joints = { hip: [number, number]; knee: [number, number]; shoulder: [number, number]; elbow: [number, number]; lean: number; pitch: number };
const J = (o: Partial<Joints>): Joints => ({ hip: [0, 0], knee: [0, 0], shoulder: [0, 0], elbow: [0.12, 0.12], lean: 0, pitch: 0, ...o });
const sym = (v: number): [number, number] => [v, v];
const TABLE: Record<Pose, Joints> = {
  standing: J({}), walking: J({}), running: J({ lean: 0.25 }),
  squatting: J({ hip: sym(1.9), knee: sym(2.3), shoulder: sym(0.7), elbow: sym(0.35), lean: 0.55 }),
  "half-squat": J({ hip: sym(0.95), knee: sym(1.25), shoulder: sym(0.35), elbow: sym(0.3), lean: 0.32 }),
  sitting: J({ hip: sym(1.57), knee: sym(1.57), shoulder: sym(0.35), elbow: sym(0.9), lean: 0.05 }),
  "hands-in-pockets": J({ shoulder: sym(-0.18), elbow: sym(0.55) }), leaning: J({ lean: 0.32, hip: sym(0.08), shoulder: sym(0.3), elbow: sym(0.6) }),
  lying: J({ pitch: -Math.PI / 2, shoulder: [0.1, 0.1] }), driving: J({ hip: sym(1.45), knee: sym(1.45), shoulder: sym(0.85), elbow: sym(0.55), lean: 0.08 }),
};
const lerpJ = (a: Joints, b: Joints, k: number): Joints => {
  const m = (x: number, y: number) => lerp(x, y, k), p = (x: [number, number], y: [number, number]): [number, number] => [m(x[0], y[0]), m(x[1], y[1])];
  return { hip: p(a.hip, b.hip), knee: p(a.knee, b.knee), shoulder: p(a.shoulder, b.shoulder), elbow: p(a.elbow, b.elbow), lean: m(a.lean, b.lean), pitch: m(a.pitch, b.pitch) };
};
/** The body at a moment: the pose eased in over a quarter of a second, with the walking or running swing added. `phase` advances with distance walked (radians). */
export function poseJoints(pose: Pose, since: number, phase: number): Joints {
  const k = smooth(Math.min(1, Math.max(0, since / 0.25))), j = lerpJ(TABLE.standing, TABLE[pose], k);
  if (pose === "walking" || pose === "running") {
    const run = pose === "running", s = Math.sin(phase), c = Math.cos(phase), amp = run ? 0.85 : 0.45;
    j.hip = [s * amp, -s * amp]; j.knee = [Math.max(0, -c * (run ? 1.3 : 0.6)) + (run ? 0.3 : 0.05), Math.max(0, c * (run ? 1.3 : 0.6)) + (run ? 0.3 : 0.05)];
    j.shoulder = [-s * amp * 0.9, s * amp * 0.9]; j.elbow = run ? [1.3, 1.3] : [0.25, 0.25]; j.lean = run ? 0.25 : 0.05;
  }
  return j;
}
/** Body proportions as fractions of the height, and how high the hips sit so the lower foot stands on the ground. */
export const BODY = { thigh: 0.245, shin: 0.245, foot: 0.04, torso: 0.3, upperArm: 0.17, foreArm: 0.16, hipHalf: 0.05, shoulderHalf: 0.13, headR: 0.065 } as const;
export function hipHeight(j: Joints, h: number): number {
  if (j.pitch < -1) return 0.1 * h; // lying
  const reach = (hip: number, knee: number) => BODY.thigh * Math.cos(hip) + BODY.shin * Math.cos(hip - knee) + BODY.foot;
  return Math.max(reach(j.hip[0], j.knee[0]), reach(j.hip[1], j.knee[1])) * h;
}
export { lerp3 };
