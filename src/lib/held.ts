import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { chargeFor, getModelById } from "@/lib/models";

// What running jobs hold: a render, a voice take or a sandbox job holds its price while it runs (see reservations.ts).
export const SANDBOX_OPEN = ["queued", "creating", "running", "collecting"];

export async function heldNow(tx: Prisma.TransactionClient | typeof db, userId: string): Promise<number> {
  const running = await tx.generation.findMany({ where: { userId, status: { in: ["pending", "saving"] } }, select: { model: true, resolution: true, creditsHeld: true } });
  // A video row carries its own price (it depends on length, quality and sound); an image row uses its model's.
  const renders = running.reduce((n, r) => n + (r.creditsHeld ?? chargeFor(getModelById(r.model), r.resolution ?? undefined) ?? 0), 0);
  const audio = await tx.audioJob.aggregate({ where: { userId, status: "pending" }, _sum: { creditsHeld: true } });
  // Sandbox jobs (merging sound into a video, running a mini tool, a Core build session) hold their price until they settle.
  const sandbox = await tx.sandboxJob.aggregate({ where: { userId, status: { in: SANDBOX_OPEN }, creditsCharged: 0 }, _sum: { creditsReserved: true } });
  return renders + (audio._sum.creditsHeld ?? 0) + (sandbox._sum.creditsReserved ?? 0);
}

