import { db } from "@/lib/db";

// A limit that parallel requests cannot slip past: the check and the record happen together under a per-person lock.
// Returns false (and records nothing) when the person has already used `limit` in the last `windowMs`.
export async function claimUsage(userId: string, kind: string, limit: number, windowMs: number): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`usage:${kind}:${userId}`}))`;
    const used = await tx.usageEvent.count({ where: { userId, kind, createdAt: { gte: new Date(Date.now() - windowMs) } } });
    if (used >= limit) return false;
    await tx.usageEvent.create({ data: { userId, kind } });
    // Old rows are no use to any window; tidy this person's as we go.
    await tx.usageEvent.deleteMany({ where: { userId, kind, createdAt: { lt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } } });
    return true;
  });
}
