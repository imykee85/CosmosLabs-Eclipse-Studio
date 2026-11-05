// ShotMap setup: what the person edits in the panel (a small, phone-friendly model), and the builder that turns it into a full Scene for the engine.
// Presets write the camera keys; the person only sets a few numbers. Everything here is pure and tested.
import { PALETTE, SCENE_VERSION, sceneSchema, type ColorId, type Pose, type Prop, type Scene, type Camera, type AspectId } from "./schema";
import { actorAt, vehicleAt } from "./engine";

export const MAX_CAST = 10;
export const KITS = [
  { id: "studio", label: "Studio", ground: "#e9ecef", sky: "#cfd8e3" }, { id: "street", label: "Street", ground: "#d3d6db", sky: "#cfd8e3" },
  { id: "yard", label: "Yard", ground: "#dfe3e8", sky: "#cfd8e3" }, { id: "desert", label: "Desert road", ground: "#d8c9a8", sky: "#e6d3b3" }, { id: "room", label: "Room", ground: "#cfd3d8", sky: "#aeb6c2" },
] as const;
export type KitId = (typeof KITS)[number]["id"];

export const PRESETS = [
  { id: "push-in", label: "Push in", hint: "Moves toward the subject" }, { id: "pull-out", label: "Pull out", hint: "Moves away from the subject" },
  { id: "orbit-180", label: "Orbit 180°", hint: "Half way round the subject" }, { id: "orbit-360", label: "Orbit 360°", hint: "All the way round" },
  { id: "pan", label: "Pan", hint: "Turns on the spot" }, { id: "crane-up", label: "Crane up", hint: "Rises while looking down at the subject" },
  { id: "low-hero", label: "Low hero", hint: "Low angle, slow push" }, { id: "shin", label: "Shin height", hint: "Locked off, very low, wide lens" },
  { id: "handheld", label: "Handheld", hint: "Drifts with a little shake" }, { id: "follow", label: "Follow", hint: "Moves alongside the subject" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

export type CastItem = {
  id: string; kind: "person" | "vehicle"; label: string; color: ColorId; x: number; z: number;
  moves: boolean; toX: number; toZ: number; build: "man" | "woman"; pose: Pose; pose2: Pose | null; pose2At: number; extra?: { pose: Pose; at: number }[]; vtype: "car" | "sports" | "pickup" | "truck" | "van" | "bike";
  /** The id of the vehicle a person rides in (they sit inside it and follow it). */
  rides?: string;
};
export type Setup = {
  kit: KitId; cast: CastItem[]; objects?: SceneObject[]; preset: PresetId; lensMm: number; height: number; distance: number; durationS: number; shake: number; aspect: AspectId; seed: number;
};

export const DEFAULT_SETUP: Setup = {
  kit: "studio", cast: [{ id: "p1", kind: "person", label: "", color: "red", x: 0, z: 0, moves: false, toX: 0, toZ: 3, build: "man", pose: "standing", pose2: null, pose2At: 3, vtype: "car" }],
  preset: "push-in", lensMm: 35, height: 1.5, distance: 4, durationS: 8, shake: 0, aspect: "16:9", seed: 7,
};

export const nextColor = (cast: CastItem[]): ColorId | null => PALETTE.find((c) => c.id !== "grey" && !cast.some((m) => m.color === c.id))?.id ?? null;
export const colorName = (id: ColorId) => PALETTE.find((c) => c.id === id)?.name ?? id;

function addCast(setup: Setup, kind: "person" | "vehicle"): Setup {
  const color = nextColor(setup.cast);
  if (!color || setup.cast.length >= MAX_CAST) return setup;
  const n = setup.cast.filter((m) => m.kind === kind).length + 1, id = `${kind === "person" ? "p" : "v"}${Date.now().toString(36)}${n}`;
  const base: CastItem = { id, kind, label: "", color, x: kind === "person" ? (n - 1) * 1.2 : 0, z: kind === "person" ? 0 : 2.5 * n, moves: kind === "vehicle", toX: kind === "vehicle" ? 24 : 0, toZ: kind === "vehicle" ? 2.5 * n : 3, build: kind === "person" && n % 2 === 0 ? "woman" : "man", pose: "standing", pose2: null, pose2At: 3, vtype: "car" };
  if (kind === "vehicle") base.x = 0;
  return { ...setup, cast: [...setup.cast, base] };
}
export const addPerson = (s: Setup) => addCast(s, "person");
export const addVehicle = (s: Setup) => addCast(s, "vehicle");
export function removeCast(s: Setup, id: string): Setup { return { ...s, cast: s.cast.filter((m) => m.id !== id && m.rides !== id) }; }

function kitProps(kit: KitId): Prop[] {
  const wall = (id: string, x: number, z: number, w: number, d: number): Prop => ({ id, kind: "box", pos: [x, 1.6, z], size: [w, 3.2, d], rotY: 0, color: "#c9ced6", opacity: 1 });
  if (kit === "street") return [wall("l", -9, -4, 0.3, 40), wall("r", 9, -4, 0.3, 40)];
  if (kit === "yard") return [wall("back", 0, -10, 24, 0.3), wall("l", -9, -2, 0.3, 16), wall("r", 9, -2, 0.3, 16)];
  if (kit === "room") return [wall("back", 0, -6, 14, 0.3), wall("l", -7, 0, 0.3, 12), wall("r", 7, 0, 0.3, 12), { id: "table", kind: "box", pos: [0, 0.4, -3], size: [2.4, 0.8, 0.8], rotY: 0, color: "#a8adb6", opacity: 1 }];
  return [];
}

/** Where the subject stands in the middle of the shot: the first person (or the first vehicle), the camera looks at them. */
export function focusOf(s: Setup): { x: number; z: number } {
  const m = s.cast.find((c) => c.kind === "person" && !c.rides) ?? s.cast[0];
  return m ? { x: m.x, z: m.z } : { x: 0, z: 0 };
}

/** Camera keys for a preset, round the focus point. Azimuth 0 puts the camera in front of the subject (positive z) looking toward negative z. */
export function cameraFor(s: Setup, subjectAt: (t: number) => { x: number; z: number }): Camera {
  const { distance: d, height: h, durationS: T, lensMm: lens } = s, f = focusOf(s), eye = 1.35;
  const pos = (a: number, dist: number, y: number, c = f): [number, number, number] => [c.x + dist * Math.sin(a), y, c.z + dist * Math.cos(a)];
  const key = (t: number, p: [number, number, number], look: [number, number, number], l = lens) => ({ t, pos: p, lookAt: look, lensMm: l, roll: 0 });
  const at: [number, number, number] = [f.x, eye, f.z];
  let keys: Camera["keys"] = []; let rig: Camera["rig"] = "dolly", shake = s.shake;
  switch (s.preset) {
    case "push-in": keys = [key(0, pos(0, d * 1.5, h), at), key(T, pos(0, Math.max(1.2, d * 0.6), h), at)]; break;
    case "pull-out": keys = [key(0, pos(0, Math.max(1.2, d * 0.6), h), at), key(T, pos(0, d * 1.5, h), at)]; break;
    case "orbit-180": case "orbit-360": {
      rig = "orbit"; const total = s.preset === "orbit-180" ? Math.PI : Math.PI * 2, n = s.preset === "orbit-180" ? 6 : 10;
      keys = Array.from({ length: n + 1 }, (_, i) => key((i / n) * T, pos((i / n) * total, d, h), at)); break;
    }
    case "pan": rig = "tripod"; keys = [key(0, pos(0, d, h), [f.x - d * 0.55, eye, f.z]), key(T, pos(0, d, h), [f.x + d * 0.55, eye, f.z])]; break;
    case "crane-up": rig = "crane"; keys = [key(0, pos(0, d, 0.5), at), key(T, pos(0, d, Math.max(h * 2.4, 3.2)), [f.x, 0.9, f.z])]; break;
    case "low-hero": keys = [key(0, pos(0.15, d, 0.35, f), [f.x, 1.6, f.z], Math.min(lens, 24)), key(T, pos(0.1, Math.max(1.4, d * 0.7), 0.35, f), [f.x, 1.6, f.z], Math.min(lens, 24))]; break;
    case "shin": rig = "tripod"; keys = [key(0, pos(0, d, 0.15), [f.x, 0.55, f.z], 15)]; break;
    case "handheld": rig = "handheld"; shake = Math.max(shake, 0.45); keys = [key(0, pos(-0.35, d, h), at), key(T / 2, pos(0, d * 0.9, h - 0.05), at), key(T, pos(0.35, d * 0.8, h), at)]; break;
    case "follow": {
      rig = "follow"; const n = Math.max(2, Math.round(T * 2));
      keys = Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * T, p = subjectAt(t); return key(t, [p.x - d * 0.7, h, p.z + d * 0.5], [p.x, eye, p.z]); }); break;
    }
  }
  return { id: "cam", name: PRESETS.find((p) => p.id === s.preset)?.label ?? "Camera", rig, sensor: "FF", interpolation: "smooth", shake: { amount: shake, frequency: 1.8, seed: s.seed }, keys } as Camera;
}

function castActor(m: CastItem, T: number, label: string): Scene["actors"][number] {
  const marks: Scene["actors"][number]["marks"] = m.moves && !m.rides ? [{ t: 0, pos: [m.x, m.z] }, { t: T, pos: [m.toX, m.toZ] }] : [{ t: 0, pos: [m.x, m.z] }];
  const actions: Scene["actors"][number]["actions"] = [{ t: 0, pose: m.pose }];
  if (m.pose2 && m.pose2At > 0 && m.pose2At < T) actions.push({ t: m.pose2At, pose: m.pose2 });
  for (const x of [...(m.extra ?? [])].sort((a, b) => a.at - b.at)) if (x.at > 0 && x.at < T && !actions.some((q) => q.t === x.at)) actions.push({ t: x.at, pose: x.pose });
  return { id: m.id, label, color: m.color, build: m.build, heightM: m.build === "woman" ? 1.65 : 1.78, marks, actions, ...(m.rides ? { parentId: m.rides } : {}) };
}

export function buildScene(s: Setup, id = "shot"): Scene {
  const T = Math.max(1, Math.min(30, s.durationS)), kit = KITS.find((k) => k.id === s.kit) ?? KITS[0];
  const ease = (a: number, b: number, k: number) => a + (b - a) * k;
  const vehicles = s.cast.filter((m) => m.kind === "vehicle").map((m) => ({
    id: m.id, label: m.label || colorName(m.color), color: m.color, type: m.vtype,
    path: m.moves ? [0, 0.5, 1].map((k) => { const e = k * k; return { t: k * T, pos: [ease(m.x, m.toX, e), ease(m.z, m.toZ, e)] as [number, number] }; }) : [{ t: 0, pos: [m.x, m.z] as [number, number] }],
  }));
  const people = s.cast.filter((m) => m.kind === "person").map((m) => castActor(m, T, m.label || colorName(m.color)));
  const base = { id, version: SCENE_VERSION, fps: 24, durationS: T, seed: s.seed, set: { groundColor: kit.ground, groundSize: 300, sky: kit.sky, props: [...kitProps(s.kit), ...(s.objects ?? []).flatMap(objectProps)].slice(0, 400) }, actors: people, vehicles, cameras: [] as Camera[], shots: [{ id: "s1", cameraId: "cam", startS: 0, endS: T, aspect: s.aspect }] };
  const first = sceneSchema.parse({ ...base, cameras: [{ id: "cam", name: "tmp", rig: "tripod", sensor: "FF", keys: [{ t: 0, pos: [0, 1.5, 5], lookAt: [0, 1, 0], lensMm: 35, roll: 0 }] }] });
  const subject = s.cast.find((m) => m.kind === "person" && !m.rides) ?? s.cast[0];
  const subjectAt = (t: number) => { if (!subject) return { x: 0, z: 0 }; const p = subject.kind === "vehicle" ? vehicleAt(first.vehicles.find((v) => v.id === subject.id)!, t) : actorAt(first, first.actors.find((a) => a.id === subject.id)!, t); return { x: p.pos[0], z: p.pos[2] }; };
  return sceneSchema.parse({ ...base, cameras: [cameraFor({ ...s, durationS: T }, subjectAt)] });
}

/** A vehicle with a driver: adding a vehicle also seats a person in it. */
export function addVehicleWithDriver(s: Setup): Setup {
  const before = s.cast.length, withV = addVehicle(s);
  if (withV.cast.length === before) return s;
  const v = withV.cast[withV.cast.length - 1], color = nextColor(withV.cast);
  if (!color || withV.cast.length >= MAX_CAST) return withV;
  const driver: CastItem = { id: v.id + "d", kind: "person", label: "", color, x: 0.4, z: 0.3, moves: false, toX: 0, toZ: 0, build: "man", pose: "driving", pose2: null, pose2At: 3, vtype: "car", rides: v.id };
  return { ...withV, cast: [...withV.cast, driver] };
}


// ---- Objects: things real cameras shoot around. Each is a few plain boxes and cylinders (neutral grey/wood tones, never the cast colours). ----
export type ObjType = "table" | "chair" | "bench" | "sofa" | "bed" | "counter" | "crate" | "pillar" | "lamppost" | "tree" | "fence" | "door" | "window" | "stairs" | "barrier" | "horse";
export type SceneObject = { id: string; type: ObjType; x: number; z: number; rot: number; scale: number };
type Part = { k: "box" | "cylinder"; at: [number, number, number]; size: [number, number, number]; c?: string };
const WOOD = "#b59b7e", STONE = "#b9bec6", DARK = "#7d848f", HIDE = "#a9805a";
const legs = (w: number, d: number, h: number, t: number, c: string): Part[] => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ k: "box" as const, at: [a * (w / 2 - t / 2), h / 2, b * (d / 2 - t / 2)], size: [t, h, t], c }));
export const OBJECTS: { id: ObjType; label: string; foot: [number, number]; parts: Part[] }[] = [
  { id: "table", label: "Table", foot: [1.4, 0.8], parts: [{ k: "box", at: [0, 0.75, 0], size: [1.4, 0.06, 0.8], c: WOOD }, ...legs(1.4, 0.8, 0.72, 0.07, WOOD)] },
  { id: "chair", label: "Chair", foot: [0.45, 0.45], parts: [{ k: "box", at: [0, 0.45, 0], size: [0.45, 0.05, 0.45], c: WOOD }, { k: "box", at: [0, 0.75, -0.2], size: [0.45, 0.55, 0.05], c: WOOD }, ...legs(0.45, 0.45, 0.43, 0.05, WOOD)] },
  { id: "bench", label: "Bench", foot: [1.6, 0.45], parts: [{ k: "box", at: [0, 0.45, 0], size: [1.6, 0.06, 0.45], c: WOOD }, { k: "box", at: [-0.7, 0.22, 0], size: [0.07, 0.44, 0.4], c: DARK }, { k: "box", at: [0.7, 0.22, 0], size: [0.07, 0.44, 0.4], c: DARK }] },
  { id: "sofa", label: "Sofa", foot: [1.9, 0.9], parts: [{ k: "box", at: [0, 0.22, 0], size: [1.9, 0.44, 0.9], c: DARK }, { k: "box", at: [0, 0.7, -0.35], size: [1.9, 0.5, 0.2], c: DARK }, { k: "box", at: [-0.9, 0.5, 0.05], size: [0.2, 0.3, 0.8], c: DARK }, { k: "box", at: [0.9, 0.5, 0.05], size: [0.2, 0.3, 0.8], c: DARK }] },
  { id: "bed", label: "Bed", foot: [1.6, 2.1], parts: [{ k: "box", at: [0, 0.3, 0], size: [1.6, 0.5, 2.1], c: STONE }, { k: "box", at: [0, 0.65, -0.8], size: [0.9, 0.12, 0.4], c: "#d9dde3" }, { k: "box", at: [0, 0.8, -1.05], size: [1.6, 0.8, 0.08], c: WOOD }] },
  { id: "counter", label: "Counter", foot: [2.2, 0.7], parts: [{ k: "box", at: [0, 0.48, 0], size: [2.2, 0.96, 0.7], c: STONE }] },
  { id: "crate", label: "Crate", foot: [0.8, 0.8], parts: [{ k: "box", at: [0, 0.4, 0], size: [0.8, 0.8, 0.8], c: WOOD }] },
  { id: "pillar", label: "Pillar", foot: [0.6, 0.6], parts: [{ k: "cylinder", at: [0, 1.6, 0], size: [0.6, 3.2, 0.6], c: STONE }] },
  { id: "lamppost", label: "Lamp post", foot: [0.3, 0.3], parts: [{ k: "cylinder", at: [0, 2, 0], size: [0.14, 4, 0.14], c: DARK }, { k: "box", at: [0.25, 3.95, 0], size: [0.7, 0.12, 0.2], c: DARK }] },
  { id: "tree", label: "Tree", foot: [2.4, 2.4], parts: [{ k: "cylinder", at: [0, 1.1, 0], size: [0.35, 2.2, 0.35], c: HIDE }, { k: "cylinder", at: [0, 3.4, 0], size: [2.4, 2.4, 2.4], c: "#9fb39a" }] },
  { id: "fence", label: "Fence", foot: [3, 0.1], parts: [{ k: "box", at: [0, 0.6, 0], size: [3, 0.9, 0.08], c: WOOD }, { k: "box", at: [-1.45, 0.55, 0], size: [0.1, 1.1, 0.1], c: WOOD }, { k: "box", at: [1.45, 0.55, 0], size: [0.1, 1.1, 0.1], c: WOOD }] },
  { id: "door", label: "Door", foot: [1, 0.1], parts: [{ k: "box", at: [0, 1.05, 0], size: [0.95, 2.1, 0.08], c: WOOD }] },
  { id: "window", label: "Window", foot: [1.3, 0.1], parts: [{ k: "box", at: [0, 1.5, 0], size: [1.3, 1.2, 0.06], c: "#c8dbe8" }] },
  { id: "stairs", label: "Stairs", foot: [1.4, 1.6], parts: [0, 1, 2, 3].map((i) => ({ k: "box" as const, at: [0, 0.09 + i * 0.18, -0.6 + i * 0.4] as [number, number, number], size: [1.4, 0.18 + i * 0.18, 0.4] as [number, number, number], c: STONE })) },
  { id: "barrier", label: "Barrier", foot: [2, 0.4], parts: [{ k: "box", at: [0, 0.4, 0], size: [2, 0.8, 0.4], c: STONE }] },
  { id: "horse", label: "Horse", foot: [0.5, 2], parts: [
    { k: "box", at: [0, 1.25, 0], size: [0.55, 0.6, 1.5], c: HIDE }, { k: "box", at: [0, 1.7, 0.85], size: [0.26, 0.75, 0.3], c: HIDE }, { k: "box", at: [0, 2.05, 1.1], size: [0.22, 0.28, 0.55], c: HIDE },
    { k: "box", at: [0, 1.2, -0.85], size: [0.08, 0.55, 0.08], c: DARK },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ k: "box" as const, at: [a * 0.18, 0.47, b * 0.55] as [number, number, number], size: [0.12, 0.94, 0.12] as [number, number, number], c: HIDE })),
  ] },
];
export const MAX_OBJECTS = 20;
export function addObject(s: Setup, type: ObjType): Setup {
  const list = s.objects ?? []; if (list.length >= MAX_OBJECTS) return s;
  return { ...s, objects: [...list, { id: `o${Date.now().toString(36)}${list.length}`, type, x: -2.5 + (list.length % 4) * 1.6, z: -2 - Math.floor(list.length / 4) * 1.5, rot: 0, scale: 1 }] };
}
export const removeObject = (s: Setup, id: string): Setup => ({ ...s, objects: (s.objects ?? []).filter((o) => o.id !== id) });
/** One object as props: parts are placed round the object's own centre, turned by `rot` (the same way a mesh turns about the vertical axis) and scaled. */
export function objectProps(o: SceneObject): Prop[] {
  const def = OBJECTS.find((d) => d.id === o.type); if (!def) return [];
  const a = (o.rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a), k = Math.max(0.2, Math.min(4, o.scale));
  return def.parts.map((p, i) => ({
    id: `${o.id}-${i}`.slice(0, 40), kind: p.k, rotY: o.rot, color: p.c ?? STONE, opacity: 1,
    pos: [o.x + (p.at[0] * cs + p.at[2] * sn) * k, p.at[1] * k, o.z + (-p.at[0] * sn + p.at[2] * cs) * k] as [number, number, number],
    size: [p.size[0] * k, p.size[1] * k, p.size[2] * k] as [number, number, number],
  }));
}
