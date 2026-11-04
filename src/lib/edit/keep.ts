import { db } from "@/lib/db";
import { composeRetouch } from "@/lib/edit/composite";
import { getObjectBytes, saveImageBytes, storageEnabled } from "@/lib/storage";

// Keeping an edit as a version, and the editing timeline. The routes under /api/edit call these; they are separate so they can be tested against a database.
export const OPS = ["prompt", "visual", "replace", "erase"] as const;
export type KeepOp = (typeof OPS)[number];
const MAX_MASK = 400_000;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export type KeepResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/** Keep one variation as a version of the picture it came from. Edit: the render is tagged as a child. Retouch: only the selected area is pasted back onto the original and that picture is saved. */
export async function keepEdit(userId: string, body: unknown): Promise<KeepResult> {
  const b = obj(body);
  const op = OPS.find((o) => o === b.op);
  const parentId = typeof b.parentId === "string" && b.parentId.length < 64 ? b.parentId : "";
  const resultId = typeof b.resultId === "string" && b.resultId.length < 64 ? b.resultId : "";
  if (!op || !parentId || !resultId || parentId === resultId) return { ok: false, status: 400, error: "Choose a finished edit to keep." };
  const rows = await db.generation.findMany({ where: { id: { in: [parentId, resultId] }, userId, status: "completed", deletedAt: null, kind: "image" } });
  const parent = rows.find((r) => r.id === parentId), result = rows.find((r) => r.id === resultId);
  if (!parent || !result) return { ok: false, status: 409, error: "Those pictures are not finished yet." };
  const userPrompt = typeof b.prompt === "string" ? b.prompt.trim().slice(0, 4000) : "";
  const pins = Array.isArray(b.pins) ? b.pins.slice(0, 20).flatMap((p: unknown) => { const q = obj(p); return typeof q.x === "number" && typeof q.y === "number" ? [{ x: Math.min(1, Math.max(0, q.x)), y: Math.min(1, Math.max(0, q.y)), text: String(q.text ?? "").slice(0, 400) }] : []; }) : undefined;
  const meta = { editOf: parentId, op, ...(userPrompt ? { userPrompt } : {}), ...(pins?.length ? { pins } : {}), aiEdited: true };
  if (op === "prompt" || op === "visual") {
    await db.generation.update({ where: { id: result.id }, data: { params: { ...obj(result.params), ...meta } } });
    return { ok: true, id: result.id };
  }
  const maskB64 = typeof b.mask === "string" ? b.mask.replace(/^data:image\/png;base64,/, "") : "";
  if (!maskB64 || maskB64.length > MAX_MASK) return { ok: false, status: 400, error: "The selection is missing or too large." };
  const mask = new Uint8Array(Buffer.from(maskB64, "base64"));
  if (!(mask[0] === 0x89 && mask[1] === 0x50 && mask[2] === 0x4e && mask[3] === 0x47)) return { ok: false, status: 400, error: "The selection is not a valid picture." };
  if (!storageEnabled || !parent.storageKey || !result.storageKey) return { ok: false, status: 503, error: "Retouch needs file storage, which is not set up yet." };
  const same = await db.generation.findFirst({ where: { userId, deletedAt: null, params: { path: ["editRaw"], equals: result.id } }, select: { id: true } });
  if (same) return { ok: true, id: same.id };
  const [original, raw] = await Promise.all([getObjectBytes(parent.storageKey, 40 * 1024 * 1024), getObjectBytes(result.storageKey, 40 * 1024 * 1024)]);
  const out = await composeRetouch({ original, result: raw, mask });
  const saved = await saveImageBytes(userId, out.bytes, "image/png");
  const made = await db.generation.create({
    data: { userId, prompt: result.prompt, imageUrl: "", status: "completed", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, width: saved.width, height: saved.height, projectId: parent.projectId, model: result.model, provider: result.provider, resolution: result.resolution, aspectRatio: parent.aspectRatio, seed: result.seed, kind: "image", params: { ...meta, editRaw: result.id, mask: maskB64, retouched: true } },
  });
  return { ok: true, id: made.id };
}

export type HistoryStep = { id: string; parentId: string | null; op: string; prompt: string; createdAt: string };

/** The timeline of one picture: up to the original it was made from, then every step made from it and from those steps (branches included), at most 60. */
export async function editHistory(userId: string, id: string): Promise<HistoryStep[] | null> {
  const pick = { id: true, params: true, prompt: true, createdAt: true } as const;
  const first = await db.generation.findFirst({ where: { id, userId, kind: "image" }, select: pick });
  if (!first) return null;
  let cur = first;
  for (let i = 0; i < 40; i++) {
    const up: unknown = obj(cur.params).editOf;
    if (typeof up !== "string") break;
    const parent = await db.generation.findFirst({ where: { id: up, userId, kind: "image" }, select: pick });
    if (!parent) break;
    cur = parent;
  }
  const steps: HistoryStep[] = [{ id: cur.id, parentId: null, op: "original", prompt: cur.prompt.slice(0, 160), createdAt: cur.createdAt.toISOString() }];
  const queue = [cur.id];
  while (queue.length && steps.length < 60) {
    const parentId = queue.shift() as string;
    const kids = await db.generation.findMany({ where: { userId, kind: "image", deletedAt: null, params: { path: ["editOf"], equals: parentId } }, orderBy: { createdAt: "asc" }, take: 20, select: pick });
    for (const k of kids) {
      if (steps.length >= 60 || steps.some((s) => s.id === k.id)) continue;
      const p = obj(k.params);
      steps.push({ id: k.id, parentId, op: typeof p.op === "string" ? p.op : "prompt", prompt: String(p.userPrompt ?? k.prompt).slice(0, 160), createdAt: k.createdAt.toISOString() });
      queue.push(k.id);
    }
  }
  return steps;
}
