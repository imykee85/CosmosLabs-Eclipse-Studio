// The small edit model behind the Editor: a picture/video track that plays one clip after another, free sound clips
// and free titles. Pure functions only, so the screen, the export and the tests share the same rules.

export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";
export const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5"];
export const FPS = 30;
export const MIN_CLIP = 0.2;

export type Clip = {
  id: string;
  kind: "video" | "image" | "audio";
  src: string;
  name: string;
  srcDur: number;   // length of the source file in seconds (images: any long number)
  in: number;       // trim start inside the source
  out: number;      // trim end inside the source
  start: number;    // place on the timeline (picture/video clips get this from layout())
  speed: number;
  volume: number;   // 0 to 1
  fadeIn: number;
  fadeOut: number;
};

export type TextItem = { id: string; text: string; start: number; dur: number; size: number; color: string; y: number };

export type Project = { aspect: Aspect; clips: Clip[]; texts: TextItem[] };

export const emptyProject = (aspect: Aspect = "16:9"): Project => ({ aspect, clips: [], texts: [] });

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const isVisual = (c: Clip) => c.kind !== "audio";
export const clipDur = (c: Clip) => Math.max(0, (c.out - c.in) / (c.speed || 1));

/** Picture and video clips play one after another: give each its start. Sound clips keep where they were put. */
export function layout(p: Project): Project {
  let t = 0;
  return { ...p, clips: p.clips.map((c) => { if (!isVisual(c)) return c; const s = { ...c, start: t }; t += clipDur(c); return s; }) };
}

export function totalDur(p: Project): number {
  let end = 0;
  for (const c of layout(p).clips) end = Math.max(end, c.start + clipDur(c));
  for (const x of p.texts) end = Math.max(end, x.start + x.dur);
  return end;
}

/** The picture or video clip showing at time t, with the matching time inside its source. */
export function activeVisual(p: Project, t: number): { clip: Clip; src: number; local: number } | null {
  for (const c of layout(p).clips) {
    if (!isVisual(c)) continue;
    const d = clipDur(c);
    if (t >= c.start && t < c.start + d) return { clip: c, src: c.in + (t - c.start) * c.speed, local: t - c.start };
  }
  return null;
}

/** 0 to 1: how much of the clip is visible/audible at `local` seconds into it (fades only). */
export function fadeFactor(c: Clip, local: number): number {
  const d = clipDur(c);
  const fi = Math.min(c.fadeIn, d / 2), fo = Math.min(c.fadeOut, d / 2);
  let f = 1;
  if (fi > 0) f = Math.min(f, local / fi);
  if (fo > 0) f = Math.min(f, (d - local) / fo);
  return Math.max(0, Math.min(1, f));
}

/** Cut a clip in two at timeline time t. Returns the project unchanged when t is not inside the clip. */
export function splitAt(p: Project, id: string, t: number): Project {
  const lp = layout(p);
  const c = lp.clips.find((x) => x.id === id);
  if (!c) return p;
  const d = clipDur(c);
  const local = t - c.start;
  if (local < MIN_CLIP || d - local < MIN_CLIP) return p;
  const cut = c.in + local * c.speed;
  const a: Clip = { ...c, out: cut, fadeOut: 0 };
  const b: Clip = { ...c, id: uid(), in: cut, start: c.start + local, fadeIn: 0 };
  const clips = p.clips.flatMap((x) => (x.id === id ? [a, b] : [x]));
  return { ...p, clips };
}

export function removeClip(p: Project, id: string): Project { return { ...p, clips: p.clips.filter((c) => c.id !== id) }; }

export function duplicateClip(p: Project, id: string): Project {
  const c = layout(p).clips.find((x) => x.id === id);
  if (!c) return p;
  const copy: Clip = { ...c, id: uid(), start: isVisual(c) ? c.start : c.start + clipDur(c) };
  const i = p.clips.findIndex((x) => x.id === id);
  const clips = p.clips.slice(); clips.splice(i + 1, 0, copy);
  return { ...p, clips };
}

/** Move a picture/video clip so it sits before the clips whose middle is later than `dropTime`. */
export function reorderVisual(p: Project, id: string, dropTime: number): Project {
  const lp = layout(p);
  const moving = lp.clips.find((c) => c.id === id);
  if (!moving || !isVisual(moving)) return p;
  const others = lp.clips.filter((c) => isVisual(c) && c.id !== id);
  const before = others.filter((c) => c.start + clipDur(c) / 2 < dropTime).length;
  const order = others.map((c) => c.id);
  order.splice(before, 0, id);
  const byId = new Map(p.clips.map((c) => [c.id, c]));
  const visual = order.map((i) => byId.get(i)!);
  let k = 0;
  return { ...p, clips: p.clips.map((c) => (isVisual(c) ? visual[k++] : c)) };
}

/** Trim the start of a clip by dt timeline seconds (positive = cut more off the front). */
export function trimStart(c: Clip, dt: number): Clip {
  const srcDelta = dt * c.speed;
  const nin = Math.max(0, Math.min(c.out - MIN_CLIP * c.speed, c.in + srcDelta));
  const applied = (nin - c.in) / c.speed;
  return { ...c, in: nin, start: isVisual(c) ? c.start : Math.max(0, c.start + applied) };
}

/** Trim the end of a clip by dt timeline seconds (positive = longer). */
export function trimEnd(c: Clip, dt: number): Clip {
  const nout = Math.max(c.in + MIN_CLIP * c.speed, Math.min(c.srcDur, c.out + dt * c.speed));
  return { ...c, out: nout };
}

export function sizeFor(aspect: Aspect, short = 720): { w: number; h: number } {
  const [a, b] = aspect.split(":").map(Number);
  const even = (v: number) => Math.round(v / 2) * 2;
  return a >= b ? { w: even((short * a) / b), h: short } : { w: short, h: even((short * b) / a) };
}

export function newClip(kind: Clip["kind"], src: string, name: string, srcDur: number): Clip {
  return { id: uid(), kind, src, name, srcDur: kind === "image" ? 3600 : srcDur, in: 0, out: kind === "image" ? 3 : srcDur, start: 0, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0 };
}

export function newText(start: number, text = "Your title"): TextItem {
  return { id: uid(), text, start, dur: 3, size: 8, color: "#ffffff", y: 0.5 };
}

export const fmtTime = (s: number) => { const v = Math.max(0, s); const m = Math.floor(v / 60); return `${m}:${(v % 60).toFixed(1).padStart(4, "0")}`; };
