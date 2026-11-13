// ShotMap world: the scene the editor builds (Compose), the cameras and their keyframes (Motion) and the shots. Plain data and pure functions,
// so the editor, the browser recorder, the server and the tests all see the same thing. Lengths are metres, angles degrees, times seconds.
// Every item stands on its own position: pos is the middle of its base (y 0 is the floor).
import { z } from "zod";
import { PALETTE, POSES, isSeated, type ColorId, type Pose } from "./schema";
import { OBJECTS, type ObjType } from "./setup";
import { moveCamAt, type MovesState } from "./moves";

export type Vec3 = [number, number, number];
export const EASES = [
  { id: "smooth", label: "Smooth" }, { id: "linear", label: "Linear" }, { id: "in", label: "Ease In" }, { id: "out", label: "Ease Out" }, { id: "inout", label: "Ease In-Out" },
] as const;
export type Ease = (typeof EASES)[number]["id"];
export const SHAPES = [
  { id: "cube", label: "Cube", key: "⌥C" }, { id: "sphere", label: "Sphere", key: "⌥B" }, { id: "cylinder", label: "Cylinder", key: "⌥Y" },
  { id: "cone", label: "Cone", key: "⌥N" }, { id: "plane", label: "Plane", key: "⌥P" }, { id: "torus", label: "Torus", key: "⌥T" },
  { id: "wall", label: "Wall", key: "⌥L" }, { id: "floor", label: "Floor", key: "⌥X" },
] as const;
export type ShapeKind = (typeof SHAPES)[number]["id"];
export const VTYPES = ["car", "sports", "pickup", "truck", "van", "bike", "boat"] as const;
export type VType = (typeof VTYPES)[number];
export const FURNITURE_MODELS = [{ id: "sheen-chair", label: "Lounge chair", file: "chair" }, { id: "velvet-sofa", label: "Velvet sofa", file: "sofa" }] as const;
export const ASPECT_LIST = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;
export type WAspect = (typeof ASPECT_LIST)[number];
export const ASPECT_RATIO: Record<WAspect, number> = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "21:9": 21 / 9 };
export const LENSES = [14, 24, 35, 50, 85, 135, 200] as const;
export const FSTOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22] as const;
export const MAX_ITEMS = 120, MAX_KEYS = 60, MAX_SHOT_S = 30, MAX_CAMERAS = 8, MAX_SHOTS = 8;

export type ItemKind = "shape" | "object" | "person" | "vehicle" | "image" | "model";
/** A motion keyframe for an item (people, vehicles or anything else that moves): where it is, which way it faces and, for people, the pose from then on. */
export type ItemKey = { t: number; pos: Vec3; yaw: number; pose?: Pose; ease: Ease };
export type Item = {
  id: string; name: string; kind: ItemKind; groupId: string | null;
  pos: Vec3; rot: Vec3; scale: Vec3; color: string; visible: boolean; locked: boolean;
  shape?: ShapeKind; object?: ObjType | (typeof FURNITURE_MODELS)[number]["id"]; vtype?: VType;
  build?: "man" | "woman"; pose?: Pose; tint?: ColorId;
  /** What it is in the final video ("a climber in a red jacket", "a white day cruiser"). Goes into the prompt. */
  description?: string;
  /** A 2D picture standing in the scene (an upload or a render) and its width / height. */
  image?: { type: "upload" | "render"; id: string; url: string; aspect: number };
  /** A character picture (Ingredients) this person stands in for: it is handed to Video Studio as a reference. */
  character?: { id: string; url: string; name: string };
  /** A 3D model the person uploaded: kept in this browser (IndexedDB) under this key. */
  modelKey?: string;
  keys?: ItemKey[];
};
export type CamKey = { t: number; pos: Vec3; look: Vec3; lensMm: number; fStop: number; focusM: number; ease: Ease };
/** `move`: when set, the camera is driven by a move (see moves.ts) instead of its keyframes; the keys then only hold a sample of it. */
export type WCamera = { id: string; name: string; keys: CamKey[]; showPath: boolean; move?: MovesState };
export type Shot = { id: string; name: string; cameraId: string; durationS: number };
export type Group = { id: string; name: string; open: boolean };
export type World = {
  v: 1; name: string; prompt: string; look: string; sky: string; ground: string;
  groups: Group[]; items: Item[]; cameras: WCamera[]; shots: Shot[]; shotId: string; aspect: WAspect; simpleFigures: boolean; seed: number;
};

const rid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------- creating ----------
export const DEFAULT_CAMERA_KEY = (t = 0): CamKey => ({ t, pos: [0, 1.6, 7], look: [0, 1.1, 0], lensMm: 35, fStop: 8, focusM: 7, ease: "smooth" });
export function emptyWorld(name = "Untitled Scene", prompt = ""): World {
  const cam: WCamera = { id: "cam1", name: "Camera 1", keys: [DEFAULT_CAMERA_KEY(0)], showPath: true };
  return {
    v: 1, name, prompt, look: "", sky: "#1b1c22", ground: "#2a2c33", groups: [],
    items: [{ id: "floor", name: "Floor", kind: "shape", shape: "floor", groupId: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: [12, 1, 12], color: "#3a3d46", visible: true, locked: true }],
    cameras: [cam], shots: [{ id: "shot1", name: "Shot 1", cameraId: cam.id, durationS: 10 }], shotId: "shot1", aspect: "16:9", simpleFigures: true, seed: 7,
  };
}
/** Base size (width, height, depth) of an item before its scale. */
export function baseSize(it: Pick<Item, "kind" | "shape" | "object" | "vtype" | "build" | "image">): Vec3 {
  if (it.kind === "person") return [0.5, it.build === "woman" ? 1.65 : 1.78, 0.3];
  if (it.kind === "vehicle") return it.vtype === "truck" ? [2.4, 3.2, 6.5] : it.vtype === "van" ? [2, 2.4, 5] : it.vtype === "bike" ? [0.6, 1.1, 2] : it.vtype === "boat" ? [2.4, 1.4, 8] : it.vtype === "pickup" ? [1.9, 1.6, 5] : [1.9, 1.4, 4.3];
  if (it.kind === "image") return [2 * (it.image?.aspect ?? 1), 2, 0.02];
  if (it.kind === "model") return [1, 1, 1];
  if (it.kind === "object") {
    if (it.object === "sheen-chair") return [0.8, 0.95, 0.8];
    if (it.object === "velvet-sofa") return [2.1, 0.85, 0.95];
    const d = OBJECTS.find((o) => o.id === it.object);
    if (d) { let h = 0; for (const p of d.parts) h = Math.max(h, p.at[1] + p.size[1] / 2); return [d.foot[0], r2(h), d.foot[1]]; }
    return [1, 1, 1];
  }
  switch (it.shape) {
    case "plane": return [2, 0.02, 2];
    case "torus": return [1, 0.3, 1];
    case "wall": return [4, 3, 0.2];
    case "floor": return [4, 0.04, 4];
    default: return [1, 1, 1];
  }
}
const PERSON_COLORS = PALETTE.filter((c) => c.id !== "grey").map((c) => c.id as ColorId);
export const nextTint = (w: World): ColorId => PERSON_COLORS.find((c) => !w.items.some((i) => i.tint === c)) ?? "grey";
const countOf = (w: World, kind: ItemKind) => w.items.filter((i) => i.kind === kind && i.id !== "floor").length;

export type NewItem = { kind: "shape"; shape: ShapeKind } | { kind: "object"; object: Item["object"] } | { kind: "person"; build?: "man" | "woman"; character?: Item["character"] } | { kind: "vehicle"; vtype?: VType } | { kind: "image"; image: NonNullable<Item["image"]> } | { kind: "model"; modelKey: string; name: string };
/** A new item placed a little apart from the others so they do not pile up. */
export function makeItem(w: World, n: NewItem, at?: Vec3): Item {
  const k = w.items.length, spot: Vec3 = at ?? [r2(((k % 5) - 2) * 1.4), 0, r2(-Math.floor(k / 5) * 1.6)];
  const base = { id: rid(n.kind[0]), groupId: null, pos: spot, rot: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3, visible: true, locked: false };
  if (n.kind === "shape") {
    const label = SHAPES.find((s) => s.id === n.shape)?.label ?? "Shape";
    return { ...base, kind: "shape", shape: n.shape, name: `${label} ${countOf(w, "shape") + 1}`, color: n.shape === "wall" || n.shape === "floor" ? "#8b909c" : "#c9ccd4" };
  }
  if (n.kind === "object") {
    const label = FURNITURE_MODELS.find((m) => m.id === n.object)?.label ?? OBJECTS.find((o) => o.id === n.object)?.label ?? "Object";
    return { ...base, kind: "object", object: n.object, name: label, color: "#b59b7e" };
  }
  if (n.kind === "person") {
    const tint = nextTint(w), i = countOf(w, "person") + 1;
    return { ...base, kind: "person", build: n.build ?? (i % 2 === 0 ? "woman" : "man"), pose: "standing", tint, name: n.character?.name || `Actor ${i}`, color: PALETTE.find((c) => c.id === tint)!.hex, ...(n.character ? { character: n.character, description: "" } : {}) };
  }
  if (n.kind === "vehicle") {
    const tint = nextTint(w);
    return { ...base, kind: "vehicle", vtype: n.vtype ?? "car", tint, name: `${n.vtype === "boat" ? "Boat" : "Vehicle"} ${countOf(w, "vehicle") + 1}`, color: PALETTE.find((c) => c.id === tint)!.hex };
  }
  if (n.kind === "image") return { ...base, kind: "image", image: n.image, name: `Image ${countOf(w, "image") + 1}`, color: "#ffffff" };
  return { ...base, kind: "model", modelKey: n.modelKey, name: n.name.slice(0, 60) || "3D model", color: "#c9ccd4" };
}
export function addItem(w: World, n: NewItem, at?: Vec3): { world: World; id: string } {
  if (w.items.length >= MAX_ITEMS) return { world: w, id: "" };
  const it = makeItem(w, n, at);
  return { world: { ...w, items: [...w.items, it] }, id: it.id };
}
export const editItem = (w: World, id: string, patch: Partial<Item>): World => ({ ...w, items: w.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
export const removeItem = (w: World, id: string): World => ({ ...w, items: w.items.filter((i) => i.id !== id) });
export function duplicateItem(w: World, id: string): { world: World; id: string } {
  const src = w.items.find((i) => i.id === id); if (!src || w.items.length >= MAX_ITEMS) return { world: w, id: "" };
  const copy: Item = { ...structuredClone(src), id: rid(src.kind[0]), name: `${src.name} copy`.slice(0, 60), locked: false, pos: [r2(src.pos[0] + 1), src.pos[1], r2(src.pos[2] + 1)] };
  if (copy.tint) { copy.tint = nextTint(w); copy.color = PALETTE.find((c) => c.id === copy.tint)!.hex; }
  return { world: { ...w, items: [...w.items, copy] }, id: copy.id };
}
export function addGroup(w: World, name?: string): { world: World; id: string } {
  const id = rid("g"); return { world: { ...w, groups: [...w.groups, { id, name: (name || `Group ${w.groups.length + 1}`).slice(0, 60), open: true }] }, id };
}
export const removeGroup = (w: World, id: string): World => ({ ...w, groups: w.groups.filter((g) => g.id !== id), items: w.items.map((i) => (i.groupId === id ? { ...i, groupId: null } : i)) });

// ---------- cameras, shots, keyframes ----------
export const shotOf = (w: World): Shot => w.shots.find((s) => s.id === w.shotId) ?? w.shots[0];
export const cameraOf = (w: World, id?: string): WCamera => w.cameras.find((c) => c.id === (id ?? shotOf(w).cameraId)) ?? w.cameras[0];
export function addCamera(w: World, from?: CamKey): { world: World; id: string } {
  if (w.cameras.length >= MAX_CAMERAS) return { world: w, id: "" };
  const n = w.cameras.reduce((m, c) => Math.max(m, Number(c.name.replace(/\D+/g, "")) || 0), 0) + 1, id = rid("c");
  const k = from ? { ...from, t: 0 } : { ...DEFAULT_CAMERA_KEY(0), pos: [4, 1.6, 6] as Vec3 };
  return { world: { ...w, cameras: [...w.cameras, { id, name: `Camera ${n}`, keys: [k], showPath: true }] }, id };
}
export function removeCamera(w: World, id: string): World {
  if (w.cameras.length < 2) return w;
  const rest = w.cameras.filter((c) => c.id !== id);
  return { ...w, cameras: rest, shots: w.shots.map((s) => (s.cameraId === id ? { ...s, cameraId: rest[0].id } : s)) };
}
/** Editing keyframes hands the camera back to its keys (unless the same patch sets a move). */
export const editCamera = (w: World, id: string, patch: Partial<WCamera>): World => ({ ...w, cameras: w.cameras.map((c) => { if (c.id !== id) return c; const n = { ...c, ...patch }; if (patch.keys && !("move" in patch)) delete n.move; return n; }) });
/** Sets a camera's keyframe at time t (replacing one within 0.05 s), keeping keys in time order. Returns the key's index. */
export function setCameraKey(w: World, camId: string, key: CamKey): { world: World; index: number } {
  const cam = cameraOf(w, camId), t = r2(clamp(key.t, 0, MAX_SHOT_S));
  const others = cam.keys.filter((k) => Math.abs(k.t - t) > 0.05);
  if (others.length >= MAX_KEYS) return { world: w, index: -1 };
  const keys = [...others, { ...key, t }].sort((a, b) => a.t - b.t);
  return { world: editCamera(w, camId, { keys }), index: keys.findIndex((k) => k.t === t) };
}
export function moveCameraKey(w: World, camId: string, index: number, t: number): World {
  const cam = cameraOf(w, camId); const k = cam.keys[index]; if (!k) return w;
  const nt = r2(clamp(t, 0, MAX_SHOT_S)); if (cam.keys.some((x, i) => i !== index && Math.abs(x.t - nt) < 0.05)) return w;
  return editCamera(w, camId, { keys: cam.keys.map((x, i) => (i === index ? { ...x, t: nt } : x)).sort((a, b) => a.t - b.t) });
}
export function removeCameraKey(w: World, camId: string, index: number): World {
  const cam = cameraOf(w, camId); if (cam.keys.length < 2) return w;
  return editCamera(w, camId, { keys: cam.keys.filter((_, i) => i !== index) });
}
export const editCameraKey = (w: World, camId: string, index: number, patch: Partial<CamKey>): World => {
  const cam = cameraOf(w, camId); return editCamera(w, camId, { keys: cam.keys.map((k, i) => (i === index ? { ...k, ...patch } : k)) });
};
export function addShot(w: World, cameraId?: string): World {
  if (w.shots.length >= MAX_SHOTS) return w;
  const n = w.shots.reduce((m, s) => Math.max(m, Number(s.name.replace(/\D+/g, "")) || 0), 0) + 1, id = rid("s");
  return { ...w, shots: [...w.shots, { id, name: `Shot ${n}`, cameraId: cameraId ?? shotOf(w).cameraId, durationS: shotOf(w).durationS }], shotId: id };
}
export function duplicateShot(w: World): World {
  if (w.shots.length >= MAX_SHOTS || w.cameras.length >= MAX_CAMERAS) return w;
  const cur = shotOf(w), cam = cameraOf(w), { world, id } = addCamera(w);
  const copied = editCamera(world, id, { keys: structuredClone(cam.keys), name: `${cam.name} copy`.slice(0, 60) });
  return addShot(copied, id);
}
export function removeShot(w: World, id: string): World {
  if (w.shots.length < 2) return w;
  const shots = w.shots.filter((s) => s.id !== id);
  return { ...w, shots, shotId: w.shotId === id ? shots[0].id : w.shotId };
}
export const editShot = (w: World, id: string, patch: Partial<Shot>): World => ({ ...w, shots: w.shots.map((s) => (s.id === id ? { ...s, ...patch, ...(patch.durationS != null ? { durationS: r2(clamp(patch.durationS, 1, MAX_SHOT_S)) } : {}) } : s)) });
/** Cuts the shot at time t: the first part stays, the rest becomes a new shot on a copy of the camera with its keys moved to start at 0. */
export function splitShot(w: World, t: number): World {
  const sh = shotOf(w), cam = cameraOf(w);
  if (t <= 0.5 || t >= sh.durationS - 0.5 || w.shots.length >= MAX_SHOTS || w.cameras.length >= MAX_CAMERAS) return w;
  const at = cameraAt(w, cam, t), before = cam.keys.filter((k) => k.t < t - 0.05), after = cam.keys.filter((k) => k.t > t + 0.05);
  const firstKeys = [...before, { ...at.key, t: r2(t) }], restKeys = [{ ...at.key, t: 0 }, ...after.map((k) => ({ ...k, t: r2(k.t - t) }))];
  let next = editCamera(w, cam.id, { keys: firstKeys });
  next = editShot(next, sh.id, { durationS: r2(t) });
  const made = addCamera(next); next = editCamera(made.world, made.id, { keys: restKeys });
  const idx = next.shots.findIndex((s) => s.id === sh.id), id = rid("s");
  const shot: Shot = { id, name: `Shot ${next.shots.length + 1}`, cameraId: made.id, durationS: r2(sh.durationS - t) };
  const shots = [...next.shots.slice(0, idx + 1), shot, ...next.shots.slice(idx + 1)];
  return { ...next, shots, shotId: id };
}
/** Item motion keys (people, vehicles, anything that moves). */
export function setItemKey(w: World, id: string, key: ItemKey): World {
  const it = w.items.find((i) => i.id === id); if (!it) return w;
  const t = r2(clamp(key.t, 0, MAX_SHOT_S)), others = (it.keys ?? []).filter((k) => Math.abs(k.t - t) > 0.05);
  if (others.length >= MAX_KEYS) return w;
  return editItem(w, id, { keys: [...others, { ...key, t }].sort((a, b) => a.t - b.t) });
}
export function removeItemKey(w: World, id: string, index: number): World {
  const it = w.items.find((i) => i.id === id); if (!it?.keys) return w;
  const keys = it.keys.filter((_, i) => i !== index);
  return editItem(w, id, keys.length ? { keys } : { keys: undefined });
}

// ---------- sampling ----------
export const easeFn = (e: Ease, k: number): number => {
  const c = clamp(k, 0, 1);
  if (e === "in") return c * c * c;
  if (e === "out") return 1 - (1 - c) ** 3;
  if (e === "inout") return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
  return c;
};
/** Values through keys at time t. A segment's ease is the one on the key it arrives at ("applies to the selected keyframe"). Linear goes in straight lines; every other ease follows a smooth curve (Catmull-Rom) and only changes the timing. */
export function sampleKeys(keys: { t: number; ease: Ease; v: number[] }[], t: number): number[] {
  if (!keys.length) return [];
  if (keys.length === 1 || t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1]; if (t >= last.t) return last.v;
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], raw = (t - a.t) / Math.max(1e-6, b.t - a.t), k = easeFn(b.ease, raw);
  if (b.ease === "linear") return a.v.map((x, n) => x + (b.v[n] - x) * k);
  const p0 = (keys[i - 1] ?? a).v, p1 = a.v, p2 = b.v, p3 = (keys[i + 2] ?? b).v, k2 = k * k, k3 = k2 * k;
  return p1.map((_, n) => 0.5 * (2 * p1[n] + (-p0[n] + p2[n]) * k + (2 * p0[n] - 5 * p1[n] + 4 * p2[n] - p3[n]) * k2 + (-p0[n] + 3 * p1[n] - 3 * p2[n] + p3[n]) * k3));
}
const SENSOR_W = 36;
/** Vertical field of view (degrees) for a lens on a full-frame sensor, cropped to the frame's aspect ratio. */
export function fovFor(lensMm: number, aspect: WAspect): number {
  // the frame is cut from a 36 x 24 mm sensor: wide frames use its full width, taller frames its full height
  const ar = ASPECT_RATIO[aspect], h = ar >= SENSOR_W / 24 ? SENSOR_W / ar : 24;
  return (2 * Math.atan(h / (2 * Math.max(4, lensMm))) * 180) / Math.PI;
}
export type CamNow = { key: CamKey; fov: number };
export function cameraAt(w: World, cam: WCamera, t: number): CamNow {
  if (cam.move) {
    const dur = w.shots.find((s) => s.cameraId === cam.id)?.durationS ?? 8, r = moveCamAt(w.items, cam.move, dur, t);
    return { key: { ...r.key, t }, fov: fovFor(r.key.lensMm, w.aspect) };
  }
  const s = sampleKeys(cam.keys.map((k) => ({ t: k.t, ease: k.ease, v: [...k.pos, ...k.look, k.lensMm, k.fStop, k.focusM] })), t);
  const key: CamKey = { t, pos: [s[0], s[1], s[2]], look: [s[3], s[4], s[5]], lensMm: Math.max(4, s[6]), fStop: s[7], focusM: Math.max(0.1, s[8]), ease: "smooth" };
  return { key, fov: fovFor(key.lensMm, w.aspect) };
}
export type ItemNow = { pos: Vec3; yaw: number; pose: Pose; since: number; walked: number; speed: number };
/** Where an item is at time t: its keys if it has any, else where it stands. People switch to walking or running when they move. */
export function itemAt(it: Item, t: number): ItemNow {
  const keys = it.keys ?? [];
  if (!keys.length) return { pos: it.pos, yaw: it.rot[1], pose: it.pose ?? "standing", since: 99, walked: 0, speed: 0 };
  const series = keys.map((k) => ({ t: k.t, ease: k.ease, v: [...k.pos, k.yaw] }));
  const s = sampleKeys(series, t), q = sampleKeys(series, t + 0.05);
  const speed = Math.hypot(q[0] - s[0], q[2] - s[2]) / 0.05;
  let pose: Pose = it.pose ?? "standing", since = 99;
  for (const k of keys) if (k.t <= t && k.pose) { pose = k.pose; since = t - k.t; }
  let walked = 0; if (it.kind === "person") { let prev = sampleKeys(series, 0); for (let u = 0.1; u < t + 0.05; u += 0.1) { const g = sampleKeys(series, Math.min(u, t)); walked += Math.hypot(g[0] - prev[0], g[2] - prev[2]); prev = g; } }
  const moving = speed > 0.25 && it.kind === "person" && !isSeated(pose) && pose !== "lying";
  const yaw = moving && (pose === "standing" || pose === "walking" || pose === "running") ? (Math.atan2(q[0] - s[0], q[2] - s[2]) * 180) / Math.PI : s[3];
  return { pos: [s[0], s[1], s[2]], yaw, pose: moving && pose === "standing" ? (speed > 3.2 ? "running" : "walking") : pose, since, walked, speed };
}

// ---------- the prompt for Video Studio ----------
const lensWords = (mm: number) => (mm <= 18 ? "ultra wide" : mm <= 30 ? "wide" : mm <= 60 ? "natural" : "telephoto");
const defaultName = (it: Item) => /^(Actor|Cube|Sphere|Cylinder|Cone|Plane|Torus|Wall|Floor|Vehicle|Boat|Image|Group) \d+$/.test(it.name) || it.name === "Floor";
/** The prompt that goes with the guide clip: follow the camera exactly, keep placement and scale, replace every stand-in with the real thing. Eclipse's own wording. */
export function worldPrompt(w: World, opts: { look?: string; refs?: number } = {}): string {
  const sh = shotOf(w), cam = cameraOf(w), first = cam.keys[0], lastK = cam.keys[cam.keys.length - 1];
  const lines: string[] = [];
  lines.push(`Use video 1 as the camera-motion reference. For the first ${r2(sh.durationS)} seconds, reproduce its camera path exactly: trajectory, timing, speed, acceleration, height, rotation, lens behaviour, framing and parallax.`);
  lines.push("Keep only the approximate placement and scale of what is in video 1. Do not copy its grey placeholder shapes, mannequins, flat colours, grid, floor lines or lighting: replace every stand-in with the real, fully detailed thing in a real location.");
  const lens = first.lensMm === lastK.lensMm ? `${Math.round(first.lensMm)} mm (${lensWords(first.lensMm)})` : `${Math.round(first.lensMm)} mm to ${Math.round(lastK.lensMm)} mm`;
  lines.push(`Lens ${lens}${first.fStop <= 2.8 ? ", shallow depth of field" : first.fStop >= 11 ? ", deep focus" : ""}. One continuous shot, no cuts.`);
  if (w.prompt.trim()) lines.push(`Scene: ${w.prompt.trim()}`);
  const people = w.items.filter((i) => i.kind === "person" && i.visible), things = w.items.filter((i) => i.kind !== "person" && i.visible && i.id !== "floor");
  let ref = opts.refs ?? 0;
  for (const p of people) {
    const who = p.description?.trim() || (p.character ? `the person in image ${++ref}` : p.build === "woman" ? "a woman" : "a man");
    const acts = (p.keys ?? []).filter((k) => k.pose && k.pose !== (p.pose ?? "standing")).map((k) => `${k.pose!.replace(/-/g, " ")} from ${r2(k.t)} s`);
    const moves = (p.keys ?? []).length > 1 && (p.keys ?? []).some((k, i, a) => i && Math.hypot(k.pos[0] - a[0].pos[0], k.pos[2] - a[0].pos[2]) > 0.3);
    lines.push(`The ${p.tint ?? "grey"} mannequin (${p.name}) is ${who}${p.pose && p.pose !== "standing" ? `, ${p.pose.replace(/-/g, " ")}` : ""}${moves ? ", moving along its path" : ""}${acts.length ? `; then ${acts.join(", then ")}` : ""}.`);
  }
  const named = things.filter((t) => t.description?.trim() || !defaultName(t)).slice(0, 20);
  if (named.length) lines.push(`In the scene: ${named.map((t) => t.description?.trim() || t.name).join("; ")}.`);
  if (!w.simpleFigures) lines.push("No people appear unless the prompt above names them.");
  const look = opts.look ?? w.look; if (look.trim()) lines.push(`Look: ${look.trim()}`);
  lines.push("Keep identities, clothing and products consistent, no extra people, no text or logos.");
  return lines.join("\n");
}
/** Character pictures linked to people in the scene, in the order the prompt names them. */
export const worldRefs = (w: World) => w.items.filter((i) => i.kind === "person" && i.visible && i.character && !i.description?.trim()).map((i) => i.character!);

// ---------- saved copies and answers from the assistant ----------
const v3 = z.tuple([z.number(), z.number(), z.number()]);
const ease = z.enum(["smooth", "linear", "in", "out", "inout"]);
const itemSchema = z.object({
  id: z.string().min(1).max(40), name: z.string().max(60), kind: z.enum(["shape", "object", "person", "vehicle", "image", "model"]), groupId: z.string().max(40).nullable(),
  pos: v3, rot: v3, scale: v3, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), visible: z.boolean(), locked: z.boolean(),
  shape: z.enum(SHAPES.map((s) => s.id) as [ShapeKind, ...ShapeKind[]]).optional(), object: z.string().max(40).optional(), vtype: z.enum(VTYPES).optional(),
  build: z.enum(["man", "woman"]).optional(), pose: z.enum(POSES).optional(), tint: z.enum(PALETTE.map((c) => c.id) as [ColorId, ...ColorId[]]).optional(),
  description: z.string().max(400).optional(),
  image: z.object({ type: z.enum(["upload", "render"]), id: z.string().max(80), url: z.string().max(500), aspect: z.number().min(0.1).max(10) }).optional(),
  character: z.object({ id: z.string().max(80), url: z.string().max(500), name: z.string().max(80) }).optional(),
  modelKey: z.string().max(80).optional(),
  keys: z.array(z.object({ t: z.number().min(0).max(MAX_SHOT_S), pos: v3, yaw: z.number(), pose: z.enum(POSES).optional(), ease })).max(MAX_KEYS).optional(),
});
const camSchema = z.object({ id: z.string().min(1).max(40), name: z.string().max(60), showPath: z.boolean(), move: z.object({ preset: z.string(), preset2: z.string().nullable(), combine: z.enum(["together", "then"]), split: z.number(), rotate: z.number(), vertical: z.number(), distance: z.number(), speed: z.number(), lensMm: z.number(), shake: z.number() }).optional(), keys: z.array(z.object({ t: z.number().min(0).max(MAX_SHOT_S), pos: v3, look: v3, lensMm: z.number().min(4).max(400), fStop: z.number().min(1).max(32), focusM: z.number().min(0.1).max(1000), ease })).min(1).max(MAX_KEYS) });
export const worldSchema = z.object({
  v: z.literal(1), name: z.string().max(80), prompt: z.string().max(4000), look: z.string().max(1000), sky: z.string().regex(/^#[0-9a-fA-F]{6}$/), ground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  groups: z.array(z.object({ id: z.string().max(40), name: z.string().max(60), open: z.boolean() })).max(40), items: z.array(itemSchema).max(MAX_ITEMS),
  cameras: z.array(camSchema).min(1).max(MAX_CAMERAS), shots: z.array(z.object({ id: z.string().max(40), name: z.string().max(60), cameraId: z.string().max(40), durationS: z.number().min(1).max(MAX_SHOT_S) })).min(1).max(MAX_SHOTS),
  shotId: z.string().max(40), aspect: z.enum(ASPECT_LIST), simpleFigures: z.boolean(), seed: z.number().int(),
});
/** A saved world read back (from this browser or a template). Anything broken gives null, so the editor starts fresh instead of crashing. */
export function readWorld(raw: unknown): World | null {
  const p = worldSchema.safeParse(raw); if (!p.success) return null;
  const w = p.data as World;
  const cams = new Set(w.cameras.map((c) => c.id));
  return { ...w, shots: w.shots.map((s) => (cams.has(s.cameraId) ? s : { ...s, cameraId: w.cameras[0].id })), shotId: w.shots.some((s) => s.id === w.shotId) ? w.shotId : w.shots[0].id };
}
export const clampVec = (v: unknown, lo: number, hi: number, d: Vec3): Vec3 => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v.map((x) => r2(clamp(x as number, lo, hi))) as Vec3) : d);
export { clamp, r2 };
