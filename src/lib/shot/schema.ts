// ShotMap scene: a rough 3D blockout of a shot (stand-in people and vehicles, props, cameras) that is turned into a guide video.
// Plain data, validated with zod. All lengths are metres, all times seconds. The engine (engine.ts) reads this and nothing else.
import { z } from "zod";

export const FEATURE_NAME = "ShotMap";
export const SCENE_VERSION = 1;

/** Ten fixed, high-contrast colours. A colour is an actor's identity in the prompt, so each is used once per scene. */
export const PALETTE = [
  { id: "red", name: "red", hex: "#e0302b" }, { id: "blue", name: "blue", hex: "#2f6fe0" }, { id: "green", name: "green", hex: "#2fae4a" },
  { id: "amber", name: "amber", hex: "#f0a81c" }, { id: "violet", name: "violet", hex: "#8a3fd1" }, { id: "cyan", name: "cyan", hex: "#18c3d6" },
  { id: "magenta", name: "magenta", hex: "#d63a9a" }, { id: "orange", name: "orange", hex: "#f06a1c" }, { id: "teal", name: "teal", hex: "#1c8c7c" },
  { id: "grey", name: "grey", hex: "#8c8c8c" },
] as const;
export type ColorId = (typeof PALETTE)[number]["id"];
const color = z.enum(PALETTE.map((c) => c.id) as [ColorId, ...ColorId[]]);

const t = z.number().min(0).max(120);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const vec2 = z.tuple([z.number(), z.number()]); // x, z on the ground

export const POSES = ["standing", "walking", "running", "squatting", "half-squat", "sitting", "hands-in-pockets", "leaning", "lying", "driving", "drinking", "smoking", "waving", "pointing", "arms-up", "reaching", "sitting-drinking", "sitting-smoking", "sitting-waving", "sitting-pointing", "lounging"] as const;
export type Pose = (typeof POSES)[number];
/** Poses where the person is on a seat (the seat snapping and the bent-leg mannequin use this). */
export const isSeated = (p: string) => p === "sitting" || p === "lounging" || p.startsWith("sitting-");

export const SENSORS = { S16: 12.5, S35: 24.9, FF: 36, "65": 54.1 } as const; // sensor width in mm
export type SensorId = keyof typeof SENSORS;
export const RIGS = ["tripod", "handheld", "dolly", "crane", "orbit", "drone", "follow"] as const;
export const ASPECTS = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "2.39:1": 2.39 } as const;
export type AspectId = keyof typeof ASPECTS;

const actor = z.object({
  id: z.string().min(1).max(40), label: z.string().max(60), color, build: z.enum(["man", "woman"]).default("man"), heightM: z.number().min(0.4).max(2.4).default(1.75),
  parentId: z.string().max(40).optional(), // rides in a vehicle
  marks: z.array(z.object({ t, pos: vec2, facing: z.number().optional() })).min(1).max(60),
  actions: z.array(z.object({ t, pose: z.enum(POSES) })).max(80).default([]),
});
const vehicle = z.object({
  id: z.string().min(1).max(40), label: z.string().max(60), color, type: z.enum(["car", "sports", "pickup", "truck", "van", "bike"]).default("car"),
  path: z.array(z.object({ t, pos: vec2 })).min(1).max(60),
});
const prop = z.object({
  id: z.string().min(1).max(40), kind: z.enum(["box", "cylinder", "plane"]).default("box"), pos: vec3, size: vec3, rotY: z.number().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#d9d9d9"), opacity: z.number().min(0.1).max(1).default(1), label: z.string().max(60).optional(),
});
const camKey = z.object({ t, pos: vec3, lookAt: vec3, lensMm: z.number().min(8).max(300).default(35), roll: z.number().min(-45).max(45).default(0) });
const camera = z.object({
  id: z.string().min(1).max(40), name: z.string().max(60), rig: z.enum(RIGS).default("tripod"), sensor: z.enum(["S16", "S35", "FF", "65"]).default("FF"),
  trackSubjectId: z.string().max(40).optional(), keys: z.array(camKey).min(1).max(120),
  interpolation: z.enum(["smooth", "linear"]).default("smooth"),
  shake: z.object({ amount: z.number().min(0).max(1).default(0), frequency: z.number().min(0.2).max(8).default(1.6), seed: z.number().int().default(1) }).default({ amount: 0, frequency: 1.6, seed: 1 }),
});
const shot = z.object({ id: z.string().min(1).max(40), cameraId: z.string().min(1).max(40), startS: t, endS: t, aspect: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]).default("16:9") });

export const sceneSchema = z.object({
  id: z.string().min(1).max(60), version: z.literal(SCENE_VERSION), fps: z.number().int().min(12).max(60).default(24),
  durationS: z.number().min(1).max(120), seed: z.number().int().default(1), notes: z.string().max(4000).optional(),
  set: z.object({ groundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#e9ecef"), groundSize: z.number().min(10).max(2000).default(120), sky: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#cfd8e3"), props: z.array(prop).max(400).default([]) }),
  models: z.array(z.object({ id: z.string().min(1).max(40), type: z.enum(["chair", "sofa"]), pos: z.tuple([z.number(), z.number(), z.number()]), rotY: z.number().default(0), scale: z.number().min(0.2).max(4).default(1) })).max(40).default([]),
  actors: z.array(actor).max(40).default([]), vehicles: z.array(vehicle).max(20).default([]),
  cameras: z.array(camera).min(1).max(12), shots: z.array(shot).min(1).max(12),
}).superRefine((s, ctx) => {
  const used = new Set<string>();
  for (const x of [...s.actors, ...s.vehicles]) {
    if (x.color !== "grey" && used.has(x.color)) ctx.addIssue({ code: "custom", message: `colour ${x.color} is used twice` });
    used.add(x.color);
  }
  const ids = new Set<string>();
  for (const x of [...s.actors, ...s.vehicles, ...s.cameras]) { if (ids.has(x.id)) ctx.addIssue({ code: "custom", message: `id ${x.id} is used twice` }); ids.add(x.id); }
  const cams = new Set(s.cameras.map((c) => c.id));
  for (const sh of s.shots) {
    if (!cams.has(sh.cameraId)) ctx.addIssue({ code: "custom", message: `shot ${sh.id} uses an unknown camera` });
    if (sh.endS <= sh.startS || sh.endS > s.durationS + 1e-6) ctx.addIssue({ code: "custom", message: `shot ${sh.id} has a bad time range` });
  }
  const veh = new Set(s.vehicles.map((v) => v.id));
  for (const a of s.actors) if (a.parentId && !veh.has(a.parentId)) ctx.addIssue({ code: "custom", message: `actor ${a.id} rides in an unknown vehicle` });
});
export type Scene = z.infer<typeof sceneSchema>;
export type Actor = z.infer<typeof actor>;
export type Vehicle = z.infer<typeof vehicle>;
export type Camera = z.infer<typeof camera>;
export type Prop = z.infer<typeof prop>;
export const parseScene = (raw: unknown) => sceneSchema.safeParse(raw);
export const colorHex = (id: ColorId) => PALETTE.find((c) => c.id === id)!.hex;
