// The six Phase 0 test blockouts (docs/shotmap/audit.md). Each is a complete, valid scene built from plain data.
import { SCENE_VERSION, sceneSchema, type ColorId, type Scene } from "./schema";

const base = (id: string, durationS: number, over: Record<string, unknown>): Scene => sceneSchema.parse({
  id, version: SCENE_VERSION, fps: 24, durationS, seed: 7,
  set: { groundColor: "#e9ecef", groundSize: 160, sky: "#cfd8e3", props: [] }, actors: [], vehicles: [], cameras: [], shots: [], ...over,
});
const person = (id: string, color: ColorId, x: number, z: number, over: Record<string, unknown> = {}) => ({ id, label: id, color, heightM: 1.75, marks: [{ t: 0, pos: [x, z] as [number, number] }], actions: [], ...over });
const shot = (cam: string, end: number, aspect: "16:9" | "9:16" = "16:9") => [{ id: "s1", cameraId: cam, startS: 0, endS: end, aspect }];
const wall = (id: string, x: number, z: number, w: number, d: number, rotY = 0) => ({ id, kind: "box" as const, pos: [x, 1.6, z] as [number, number, number], size: [w, 3.2, d] as [number, number, number], rotY, color: "#c9ced6" });

/** 1. Slow push-in on one standing actor (one axis, 8 s). */
export const t1 = base("t1-pushin", 8, {
  actors: [person("hero", "red", -0.45, 0), person("partner", "blue", 0.45, 0, { build: "woman", heightM: 1.65 })], set: { groundColor: "#e9ecef", groundSize: 160, sky: "#cfd8e3", props: [wall("back", 0, -4, 12, 0.3)] },
  cameras: [{ id: "cam", name: "Push in", rig: "dolly", sensor: "FF", interpolation: "smooth", shake: { amount: 0, frequency: 1.6, seed: 1 }, keys: [{ t: 0, pos: [0, 1.5, 6], lookAt: [0, 1.45, 0], lensMm: 35, roll: 0 }, { t: 8, pos: [0, 1.5, 2.4], lookAt: [0, 1.5, 0], lensMm: 35, roll: 0 }] }],
  shots: shot("cam", 8),
});

/** 2. 180 degree orbit round one actor (several axes, 10 s). */
const orbit = [0, 1, 2, 3, 4, 5, 6].map((i) => { const a = (i / 6) * Math.PI; const t = (i / 6) * 10; return { t, pos: [4 * Math.sin(a), 1.6, 4 * Math.cos(a)] as [number, number, number], lookAt: [0, 1.4, 0] as [number, number, number], lensMm: 35, roll: 0 }; });
export const t2 = base("t2-orbit", 10, {
  actors: [person("hero", "blue", 0, 0)], set: { groundColor: "#e9ecef", groundSize: 160, sky: "#cfd8e3", props: [wall("w1", 0, -6, 14, 0.3), wall("w2", 7, 0, 0.3, 14)] },
  cameras: [{ id: "cam", name: "Orbit 180", rig: "orbit", sensor: "FF", interpolation: "smooth", shake: { amount: 0, frequency: 1.6, seed: 1 }, keys: orbit }], shots: shot("cam", 10),
});

/** 3. Locked off at shin height, 15 mm, a grey actor walks right up to the lens (9:16). */
export const t3 = base("t3-shin", 8, {
  actors: [
    person("walker", "grey", 0, -7, { marks: [{ t: 0, pos: [0.15, -7] }, { t: 8, pos: [0.15, 3.6] }] }),
    person("a", "red", -2.5, -6), person("b", "green", 2.2, -8, { actions: [{ t: 0, pose: "squatting" }] }), person("c", "amber", 4, -5), person("d", "violet", -4.5, -9),
  ],
  set: { groundColor: "#dfe3e8", groundSize: 160, sky: "#cfd8e3", props: [wall("left", -8, -6, 0.3, 24), wall("right", 8, -6, 0.3, 24), wall("far", 0, -16, 20, 0.3)] },
  cameras: [{ id: "cam", name: "Shin-height 15 mm, locked off", rig: "tripod", sensor: "FF", interpolation: "smooth", shake: { amount: 0, frequency: 1.6, seed: 1 }, keys: [{ t: 0, pos: [0, 0.15, 5], lookAt: [0, 0.55, 0], lensMm: 15, roll: 0 }] }],
  shots: shot("cam", 8, "9:16"),
});

/** 4. Two vehicles side by side, the camera between the drivers, the lead car pulls ahead (15 s). */
const lead = (t: number) => 2 * t + 0.12 * t * t, chase = (t: number) => 2 * t + 0.05 * t * t;
const path = (f: (t: number) => number, z: number) => [0, 3, 6, 9, 12, 15].map((t) => ({ t, pos: [f(t), z] as [number, number] }));
export const t4 = base("t4-chase", 15, {
  vehicles: [{ id: "lead", label: "lead car", color: "red", type: "sports", path: path(lead, -1.7) }, { id: "chase", label: "chase car", color: "blue", type: "pickup", path: path(chase, 1.7) }],
  actors: [person("d1", "orange", 0.4, 0.3, { parentId: "lead", marks: [{ t: 0, pos: [0.4, 0.3] }] }), person("d2", "green", 0.4, 0.3, { parentId: "chase", marks: [{ t: 0, pos: [0.4, 0.3] }] })],
  set: { groundColor: "#d8c9a8", groundSize: 400, sky: "#e6d3b3", props: [] },
  cameras: [{ id: "cam", name: "Between the drivers", rig: "follow", sensor: "FF", interpolation: "smooth", shake: { amount: 0.35, frequency: 2.2, seed: 5 },
    keys: [0, 3, 6, 9, 12, 15].map((t) => ({ t, pos: [chase(t) - 2.6, 1.3, 0] as [number, number, number], lookAt: [chase(t) + 3.5, 1.0, 0] as [number, number, number], lensMm: 28, roll: 0 })) }],
  shots: shot("cam", 15),
});

/** 5. Five actors, three action changes at set times, handheld path (10 s). */
export const t5 = base("t5-crew", 10, {
  actors: [
    person("red", "red", -2.2, -1, { actions: [{ t: 0, pose: "squatting" }, { t: 6, pose: "standing" }] }),
    person("blue", "blue", 0.6, -2.4, { actions: [{ t: 0, pose: "hands-in-pockets" }] }),
    person("green", "green", 3, -1.4, { marks: [{ t: 0, pos: [3, -1.4] }, { t: 4, pos: [3, -1.4] }, { t: 9, pos: [6.5, -3.5] }] }),
    person("amber", "amber", -4.5, -3, { actions: [{ t: 0, pose: "standing" }, { t: 2, pose: "sitting" }, { t: 7, pose: "standing" }] }),
    person("violet", "violet", 1.5, 0.8),
  ],
  set: { groundColor: "#dfe3e8", groundSize: 160, sky: "#cfd8e3", props: [wall("back", 0, -8, 22, 0.3), { id: "bench", kind: "box", pos: [-4.5, 0.25, -3.3], size: [1.6, 0.5, 0.5], rotY: 0, color: "#b8bcc4" }, { id: "fence", kind: "box", pos: [7.2, 0.6, -3.5], size: [0.15, 1.2, 4], rotY: 0, color: "#b8bcc4" }] },
  cameras: [{ id: "cam", name: "Handheld along a path", rig: "handheld", sensor: "FF", interpolation: "smooth", shake: { amount: 0.55, frequency: 1.8, seed: 11 },
    keys: [{ t: 0, pos: [-3, 1.3, 6], lookAt: [-1, 1.1, -1], lensMm: 28, roll: 0 }, { t: 5, pos: [0.5, 1.2, 5.2], lookAt: [0.5, 1.1, -1.5], lensMm: 28, roll: 0 }, { t: 10, pos: [4, 1.3, 5.5], lookAt: [2.5, 1.1, -2], lensMm: 28, roll: 0 }] }],
  shots: shot("cam", 10),
});

/** 6. A mirror: the camera starts on the reflection, swings round behind the actor, ends on a close profile (12 s). The reflection is a second actor behind the mirror. */
export const t6 = base("t6-mirror", 12, {
  actors: [person("man", "orange", 0, 0, { marks: [{ t: 0, pos: [0, 0], facing: 180 }] }), person("reflection", "blue", 0, -3.2, { marks: [{ t: 0, pos: [0, -3.2], facing: 0 }] })],
  set: { groundColor: "#bfc4cc", groundSize: 60, sky: "#9aa3b0", props: [{ id: "mirror", kind: "box", pos: [0, 1.3, -1.6], size: [3, 2, 0.06], rotY: 0, opacity: 0.35, color: "#9fb4c8" }, { id: "table", kind: "box", pos: [0, 0.4, -1.3], size: [3, 0.8, 0.5], rotY: 0, color: "#a8adb6" }, wall("back", 0, -6, 12, 0.3), wall("left", -6, -2, 0.3, 10)] },
  cameras: [{ id: "cam", name: "Mirror swing", rig: "orbit", sensor: "FF", interpolation: "smooth", shake: { amount: 0.15, frequency: 1.4, seed: 3 },
    keys: [{ t: 0, pos: [1.3, 1.5, 1.2], lookAt: [0, 1.4, -3.2], lensMm: 33, roll: 0 }, { t: 4, pos: [1.6, 1.5, 0.2], lookAt: [0, 1.4, -1.2], lensMm: 33, roll: 0 }, { t: 8, pos: [0.4, 1.6, 1.6], lookAt: [0, 1.5, 0], lensMm: 40, roll: 0 }, { t: 12, pos: [-1.1, 1.55, 0.9], lookAt: [0, 1.55, 0], lensMm: 50, roll: 0 }] }],
  shots: shot("cam", 12),
});
export const TESTS = [t1, t2, t3, t4, t5, t6];
