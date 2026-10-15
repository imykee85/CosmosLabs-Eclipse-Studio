import { db } from "./db";
import type { ReferenceRef } from "./references";

// "Auto" aspect ratio: with a reference picture the result takes the reference's shape (the nearest ratio the model offers); with none, the model's usual one.
export const AUTO_RATIO = "auto";

const parse = (r: string): number | null => {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(r);
  return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
};

/** The allowed ratio closest to width:height (compared on a log scale, so 2:1 is as far from 1:1 as 1:2 is). */
export function nearestRatio(width: number, height: number, allowed: readonly string[]): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  const target = Math.log(width / height);
  let best: string | null = null, gap = Infinity;
  for (const r of allowed) {
    const v = parse(r);
    if (v === null) continue;
    const d = Math.abs(Math.log(v) - target);
    if (d < gap) { gap = d; best = r; }
  }
  return best;
}

/** Width and height of one of the person's own pictures (an upload or a finished render), or null when not recorded. */
export async function referenceSize(userId: string, ref: ReferenceRef | undefined): Promise<{ width: number; height: number } | null> {
  if (!ref) return null;
  const row = ref.type === "upload"
    ? await db.upload.findFirst({ where: { id: ref.id, userId }, select: { width: true, height: true } })
    : await db.generation.findFirst({ where: { id: ref.id, userId }, select: { width: true, height: true, aspectRatio: true } });
  if (row?.width && row?.height) return { width: row.width, height: row.height };
  const ratio = row && "aspectRatio" in row && typeof row.aspectRatio === "string" ? parse(row.aspectRatio) : null;
  return ratio ? { width: ratio * 1000, height: 1000 } : null;
}

/** Turns "auto" into a ratio the model offers: the first reference picture's shape, else `fallback`. */
export async function resolveAutoRatio(userId: string, firstRef: ReferenceRef | undefined, allowed: readonly string[], fallback: string | undefined): Promise<string | undefined> {
  const size = await referenceSize(userId, firstRef);
  return (size ? nearestRatio(size.width, size.height, allowed) : null) ?? fallback;
}

/** The reference's own width and height when "Auto" was chosen and a reference has a known size: the shape the result must end up with. */
export async function autoTarget(userId: string, firstRef: ReferenceRef | undefined): Promise<{ w: number; h: number } | null> {
  const size = await referenceSize(userId, firstRef);
  return size ? { w: size.width, h: size.height } : null;
}
