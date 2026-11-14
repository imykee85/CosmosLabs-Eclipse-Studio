import { db } from "@/lib/db";
import { deleteObject, storageEnabled } from "@/lib/storage";

// Upload links hand a browser a one-time place in storage. A person can start an upload and never finish it, and the file would stay forever.
// Each link we hand out is remembered here; a daily sweep deletes the file when nothing in the database uses it 24 hours later.
// Only keys we handed out are ever touched, and a key that a finished upload recorded is never deleted.

export const SWEEP_AFTER_MS = 24 * 3600_000;
const BATCH = 300;

/** Remembers a handed-out upload key. Never throws: a failure to remember only means the file could be left behind. */
export async function notePendingUpload(userId: string, key: string): Promise<void> {
  try { await db.pendingUpload.create({ data: { userId, key } }); } catch (err) { console.error("pending upload not recorded", err); }
}

async function inUse(key: string): Promise<boolean> {
  const [up, gen, au] = await Promise.all([
    db.upload.findFirst({ where: { storageKey: key }, select: { id: true } }),
    db.generation.findFirst({ where: { storageKey: key }, select: { id: true } }),
    db.audioJob.findFirst({ where: { storageKey: key }, select: { id: true } }),
  ]);
  return Boolean(up || gen || au);
}

export type SweepResult = { checked: number; deleted: number; kept: number };

export async function sweepAbandonedUploads(now = Date.now()): Promise<SweepResult> {
  if (!storageEnabled) return { checked: 0, deleted: 0, kept: 0 };
  const rows = await db.pendingUpload.findMany({ where: { createdAt: { lt: new Date(now - SWEEP_AFTER_MS) } }, orderBy: { createdAt: "asc" }, take: BATCH });
  let deleted = 0, kept = 0;
  for (const r of rows) {
    try {
      if (await inUse(r.key)) kept++;
      else { await deleteObject(r.key); deleted++; }
      await db.pendingUpload.delete({ where: { id: r.id } });
    } catch (err) {
      console.error("upload sweep: could not clean", r.key, err);
    }
  }
  return { checked: rows.length, deleted, kept };
}
