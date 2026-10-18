import type { AudioJob, Generation, Prisma, SandboxJob } from "@prisma/client";
import { autoTopup } from "@/lib/billing";
import { db } from "@/lib/db";
import { chargeFor, getModelById } from "@/lib/models";

// A paid render is charged when it finishes, so its price has to be HELD while it runs: otherwise several renders started at once all see the same
// balance and all go ahead. The render row is created inside the same per-person lock that reads the balance, and a running render (pending or
// saving) counts as holding its price. Returns the row, or the numbers for the "not enough credits" message.
// Voice Studio jobs hold their price the same way (AudioJob.creditsHeld while "pending"), and count against the same balance as renders.
export const SANDBOX_OPEN = ["queued", "creating", "running", "collecting"];

async function heldNow(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const running = await tx.generation.findMany({ where: { userId, status: { in: ["pending", "saving"] } }, select: { model: true, creditsHeld: true } });
  // A video row carries its own price (it depends on length, quality and sound); an image row uses its model's.
  const renders = running.reduce((n, r) => n + (r.creditsHeld ?? chargeFor(getModelById(r.model)) ?? 0), 0);
  const audio = await tx.audioJob.aggregate({ where: { userId, status: "pending" }, _sum: { creditsHeld: true } });
  // Sandbox jobs (merging sound into a video, running a mini tool, a Core build session) hold their price until they settle.
  const sandbox = await tx.sandboxJob.aggregate({ where: { userId, status: { in: SANDBOX_OPEN }, creditsCharged: 0 }, _sum: { creditsReserved: true } });
  return renders + (audio._sum.creditsHeld ?? 0) + (sandbox._sum.creditsReserved ?? 0);
}

// When a job cannot start for lack of credits and the person has switched on auto top-up (with a saved card), top up once and try again.
async function withTopup<R>(userId: string, cost: number, run: () => Promise<R>): Promise<R> {
  const first = await run();
  if (first && typeof first === "object" && "have" in first && "held" in first && (await autoTopup(userId, { needed: cost }))) return run();
  return first;
}

export function createGenerationHeld(userId: string, cost: number | null, data: Prisma.GenerationUncheckedCreateInput): Promise<{ row: Generation } | { have: number; held: number }> {
  return cost == null ? db.generation.create({ data }).then((row) => ({ row })) : withTopup(userId, cost, () => createGenerationHeldOnce(userId, cost, data));
}
async function createGenerationHeldOnce(userId: string, cost: number, data: Prisma.GenerationUncheckedCreateInput): Promise<{ row: Generation } | { have: number; held: number }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`; // the same lock spendCredits takes
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const have = sum._sum.delta ?? 0;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held };
    return { row: await tx.generation.create({ data }) };
  });
}

export function createAudioJobHeld(userId: string, cost: number | null, data: Prisma.AudioJobUncheckedCreateInput): Promise<{ row: AudioJob } | { have: number; held: number }> {
  return cost == null ? db.audioJob.create({ data }).then((row) => ({ row })) : withTopup(userId, cost, () => createAudioJobHeldOnce(userId, cost, data));
}
async function createAudioJobHeldOnce(userId: string, cost: number, data: Prisma.AudioJobUncheckedCreateInput): Promise<{ row: AudioJob } | { have: number; held: number }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const have = sum._sum.delta ?? 0;
    const held = await heldNow(tx, userId);
    if (have - held < cost) return { have, held };
    return { row: await tx.audioJob.create({ data }) };
  });
}

/** A sandbox job row, created only when the person's balance (minus everything already held) covers its price. Runs `check` inside the same lock. */
export function createSandboxJobHeld(userId: string, cost: number, data: Prisma.SandboxJobUncheckedCreateInput, check?: (tx: Prisma.TransactionClient) => Promise<string | null>): Promise<{ row: SandboxJob } | { have: number; held: number } | { refused: string }> {
  return withTopup(userId, cost, () => createSandboxJobHeldOnce(userId, cost, data, check));
}
async function createSandboxJobHeldOnce(userId: string, cost: number, data: Prisma.SandboxJobUncheckedCreateInput, check?: (tx: Prisma.TransactionClient) => Promise<string | null>): Promise<{ row: SandboxJob } | { have: number; held: number } | { refused: string }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const why = check ? await check(tx) : null;
    if (why) return { refused: why };
    if (cost > 0) {
      const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
      const have = sum._sum.delta ?? 0;
      const held = await heldNow(tx, userId);
      if (have - held < cost) return { have, held };
    }
    return { row: await tx.sandboxJob.create({ data }) };
  });
}

/** Credits the person can still use: the balance minus everything running jobs hold. */
export async function freeCredits(userId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    return (sum._sum.delta ?? 0) - (await heldNow(tx, userId));
  });
}
