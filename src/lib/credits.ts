import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Credits live in our own database, as an append-only ledger. A payment provider only tells us a payment happened; it never holds a balance.
// Balance = sum of delta. Spending takes a per-user lock so two requests at once cannot both spend the same credits.

export type CreditReason = "GRANT" | "PURCHASE" | "CHARGE" | "REFUND" | "ADJUST";

export class InsufficientCreditsError extends Error {
  constructor(readonly balance: number, readonly needed: number) {
    super(`Not enough credits: ${balance} available, ${needed} needed`);
  }
}

export async function getBalance(userId: string): Promise<number> {
  const sum = await db.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return sum._sum.delta ?? 0;
}

/**
 * Adds credits. With a provider and externalId (a purchase) it is idempotent: the same payment delivered twice adds credits once.
 * Returns false when that payment had already been recorded.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  entry: { reason: Extract<CreditReason, "GRANT" | "PURCHASE" | "REFUND" | "ADJUST">; provider?: string; externalId?: string },
): Promise<boolean> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("A grant must be a positive whole number of credits");
  try {
    await db.creditLedger.create({ data: { userId, delta: amount, reason: entry.reason, provider: entry.provider ?? null, externalId: entry.externalId ?? null } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

/** Takes credits for a render. Throws InsufficientCreditsError, and writes nothing, when the balance is too low. */
export async function spendCredits(userId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("A charge must be a positive whole number of credits");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const sum = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const balance = sum._sum.delta ?? 0;
    if (balance < amount) throw new InsufficientCreditsError(balance, amount);
    await tx.creditLedger.create({ data: { userId, delta: -amount, reason: "CHARGE" } });
    return balance - amount;
  });
}
