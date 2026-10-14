import type { AudioJob, Generation, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { chargeFor, getModelById } from "@/lib/models";

// A paid render is charged when it finishes, so its price has to be HELD while it runs: otherwise several renders started at once all see the same
// balance and all go ahead. The render row is created inside the same per-person lock that reads the balance, and a running render (pending or
// saving) counts as holding its price. Returns the row, or the numbers for the "not enough credits" message.
// Voice Studio jobs hold their price the same way (AudioJob.creditsHeld while "pending"), and count against the same balance as renders.
async function heldNow(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const running = await tx.generation.findMany({ where: { userId, status: { in: ["pending", "saving"] } }, select: { model: true, creditsHeld: true } });
  // A video row carries its own price (it depends on length, quality and sound); an image row uses its model's.
  const renders = running.reduce((n, r) => n + (r.creditsHeld ?? chargeFor(getModelById(r.model)) ?? 0), 0);
  const audio = await tx.audioJob.aggregate({ where: { userId, status: "pending" }, _sum: { creditsHeld: true } });
  return renders + (audio._sum.creditsHeld ?? 0);
}

export async function createGenerationHeld(userId: string, cost: number | null, data: Prisma.GenerationUncheckedCreateInput): Promise<{ row: Generation } | { have: number; held: number }> {
  if (cost == null) return { row: await db.generation.create({ data }) };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`; // the same lock spendCredits takes
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const have = sum._sum.delta ?? 0;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held };
    return { row: await tx.generation.create({ data }) };
  });
}

export async function createAudioJobHeld(userId: string, cost: number | null, data: Prisma.AudioJobUncheckedCreateInput): Promise<{ row: AudioJob } | { have: number; held: number }> {
  if (cost == null) return { row: await db.audioJob.create({ data }) };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const have = sum._sum.delta ?? 0;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held };
    return { row: await tx.audioJob.create({ data }) };
  });
}
