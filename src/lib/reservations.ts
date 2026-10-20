import type { AudioJob, Generation, Prisma, SandboxJob } from "@prisma/client";
import { autoTopup } from "@/lib/billing";
import { db } from "@/lib/db";
import { chargeFor, getModelById } from "@/lib/models";
import { heldNow, SANDBOX_OPEN } from "@/lib/held";
import { unusable } from "@/lib/subscription";

// A paid render is charged when it finishes, so its price has to be HELD while it runs: otherwise several renders started at once all see the same
// balance and all go ahead. The render row is created inside the same per-person lock that reads the balance, and a running render (pending or
// saving) counts as holding its price. Returns the row, or the numbers for the "not enough credits" message.
// Audio Studio jobs hold their price the same way (AudioJob.creditsHeld while "pending"), and count against the same balance as renders.
export { SANDBOX_OPEN, heldNow };

// When a job cannot start for lack of credits and the person has switched on auto top-up (with a saved card), top up once and try again.
async function withTopup<R>(userId: string, cost: number, run: () => Promise<R>): Promise<R> {
  const first = await run();
  if (first && typeof first === "object" && "have" in first && "held" in first && (await autoTopup(userId, { needed: cost }))) return run();
  return first;
}

// `batch` (Soul 2 and Soul Cinema): one credit pays for up to `size` images started under the same batch id. The first request of a batch pays; the next
// ones, up to the size, are created with nothing held. Counted inside the per-person lock, so four requests started at once pay once, in any order.
export type RenderBatch = { id: string; size: number };

export function createGenerationHeld(userId: string, cost: number | null, data: Prisma.GenerationUncheckedCreateInput, batch?: RenderBatch): Promise<{ row: Generation } | { have: number; held: number; locked: number }> {
  return cost == null ? db.generation.create({ data }).then((row) => ({ row })) : withTopup(userId, cost, () => createGenerationHeldOnce(userId, cost, data, batch));
}
async function createGenerationHeldOnce(userId: string, cost: number, data: Prisma.GenerationUncheckedCreateInput, batch?: RenderBatch): Promise<{ row: Generation } | { have: number; held: number; locked: number }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`; // the same lock spendCredits takes
    if (batch) {
      const inBatch = await tx.generation.count({ where: { userId, model: data.model, params: { path: ["batchId"], equals: batch.id } } });
      if (inBatch > 0 && inBatch < batch.size) return { row: await tx.generation.create({ data: { ...data, creditsHeld: 0 } }) }; // already paid for by the first image of this batch
    }
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const u = await unusable(userId, tx);
    const locked = u.locked;
    const have = (sum._sum.delta ?? 0) - locked - u.expired;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held, locked };
    return { row: await tx.generation.create({ data }) };
  });
}

export function createAudioJobHeld(userId: string, cost: number | null, data: Prisma.AudioJobUncheckedCreateInput): Promise<{ row: AudioJob } | { have: number; held: number; locked: number }> {
  return cost == null ? db.audioJob.create({ data }).then((row) => ({ row })) : withTopup(userId, cost, () => createAudioJobHeldOnce(userId, cost, data));
}
async function createAudioJobHeldOnce(userId: string, cost: number, data: Prisma.AudioJobUncheckedCreateInput): Promise<{ row: AudioJob } | { have: number; held: number; locked: number }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const u = await unusable(userId, tx);
    const locked = u.locked;
    const have = (sum._sum.delta ?? 0) - locked - u.expired;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held, locked };
    return { row: await tx.audioJob.create({ data }) };
  });
}

/** A sandbox job row, created only when the person's balance (minus everything already held) covers its price. Runs `check` inside the same lock. */
export function createSandboxJobHeld(userId: string, cost: number, data: Prisma.SandboxJobUncheckedCreateInput, check?: (tx: Prisma.TransactionClient) => Promise<string | null>): Promise<{ row: SandboxJob } | { have: number; held: number; locked: number } | { refused: string }> {
  return withTopup(userId, cost, () => createSandboxJobHeldOnce(userId, cost, data, check));
}
async function createSandboxJobHeldOnce(userId: string, cost: number, data: Prisma.SandboxJobUncheckedCreateInput, check?: (tx: Prisma.TransactionClient) => Promise<string | null>): Promise<{ row: SandboxJob } | { have: number; held: number; locked: number } | { refused: string }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const why = check ? await check(tx) : null;
    if (why) return { refused: why };
    if (cost > 0) {
      const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
      const u = await unusable(userId, tx);
      const locked = u.locked;
      const have = (sum._sum.delta ?? 0) - locked - u.expired;
      const held = await heldNow(tx, userId);
      if (have - held < cost) return { have, held, locked };
    }
    return { row: await tx.sandboxJob.create({ data }) };
  });
}

/** Credits the person can still use: the balance minus everything running jobs hold. */
export async function freeCredits(userId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const u = await unusable(userId, tx);
    return (sum._sum.delta ?? 0) - u.locked - u.expired - (await heldNow(tx, userId));
  });
}
