// "Moves": the manual way to direct the camera in ShotMap's Motion mode. Pick a move (and a second one), set Rotate, Vertical, Distance, Speed, Lens and Shake,
// and the camera's keyframes are worked out for you round the subject. The result is ordinary keyframes on the timeline, so they can still be dragged and eased.
import { cameraFor, DEFAULT_SETUP, type CastItem, type PresetId, type Setup } from "./setup";
import { MAX_KEYS, type CamKey, type Item, type Vec3 } from "./world";

export type MovesState = { preset: PresetId; preset2: PresetId | null; combine: "together" | "then"; split: number; rotate: number; vertical: number; distance: number; speed: number; lensMm: number; shake: number };
export const DEFAULT_MOVES: MovesState = { preset: "push-in", preset2: null, combine: "together", split: 0.5, rotate: 0, vertical: 0, distance: 4, speed: 1, lensMm: 35, shake: 0 };

/** The subject the camera works round: the first person (else the first vehicle, else the first thing), and where it is at time t. */
export function subjectOf(items: Item[]): { at: (t: number) => { x: number; z: number }; start: { x: number; z: number } } {
  const it = items.find((i) => i.kind === "person" && i.visible) ?? items.find((i) => i.kind === "vehicle" && i.visible) ?? items.find((i) => i.visible);
  if (!it) return { at: () => ({ x: 0, z: 0 }), start: { x: 0, z: 0 } };
  const keys = [...(it.keys ?? [])].sort((a, b) => a.t - b.t);
  const at = (t: number) => {
    if (!keys.length) return { x: it.pos[0], z: it.pos[2] };
    if (t <= keys[0].t) return { x: keys[0].pos[0], z: keys[0].pos[2] };
    for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) { const a = keys[i - 1], b = keys[i], u = (t - a.t) / Math.max(1e-6, b.t - a.t); return { x: a.pos[0] + (b.pos[0] - a.pos[0]) * u, z: a.pos[2] + (b.pos[2] - a.pos[2]) * u }; }
    const l = keys[keys.length - 1]; return { x: l.pos[0], z: l.pos[2] };
  };
  return { at, start: at(0) };
}

/** Camera keyframes for the chosen move over `durationS` seconds, round the world's main subject. */
export function movesToKeys(items: Item[], m: MovesState, durationS: number): CamKey[] {
  const sub = subjectOf(items);
  const cast: CastItem = { ...DEFAULT_SETUP.cast[0], x: sub.start.x, z: sub.start.z };
  const setup: Setup = { ...DEFAULT_SETUP, cast: [cast], preset: m.preset, preset2: m.preset2, combine: m.combine, split: m.split, rotate: m.rotate, vertical: m.vertical, speed: m.speed, lensMm: m.lensMm, distance: m.distance, durationS, shake: m.shake };
  const cam = cameraFor(setup, sub.at);
  let keys = cam.keys;
  if (keys.length > MAX_KEYS) { const step = (keys.length - 1) / (MAX_KEYS - 1); keys = Array.from({ length: MAX_KEYS }, (_, i) => keys[Math.round(i * step)]); }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return keys.map((k): CamKey => {
    const pos = k.pos.map(r2) as Vec3, look = k.lookAt.map(r2) as Vec3;
    const dist = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
    return { t: r2(Math.min(durationS, Math.max(0, k.t))), pos, look, lensMm: k.lensMm, fStop: 8, focusM: Math.max(0.3, r2(dist)), ease: "smooth" };
  });
}
