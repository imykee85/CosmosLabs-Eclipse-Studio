import type { Generation, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { chargeFor, getModelById } from "@/lib/models";

// A paid render is charged when it finishes, so its price has to be HELD while it runs: otherwise several renders started at once all see the same
// balance and all go ahead. The render row is created inside the same per-person lock that reads the balance, and a running render (pending or
// saving) counts as holding its price. Returns the row, or the numbers for the "not enough credits" message.
export async function createGenerationHeld(userId: string, cost: number | null, data: Prisma.GenerationUncheckedCreateInput): Promise<{ row: Generation } | { have: number; held: number }> {
  if (cost == null) return { row: await db.generation.create({ data }) };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`; // the same lock spendCredits takes
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const have = sum._sum.delta ?? 0;
    const running = await tx.generation.findMany({ where: { userId, status: { in: ["pending", "saving"] } }, select: { model: true } });
    const held = running.reduce((n, r) => n + (chargeFor(getModelById(r.model)) ?? 0), 0);
    if (have - held < cost) return { have, held };
    return { row: await tx.generation.create({ data }) };
  });
}
