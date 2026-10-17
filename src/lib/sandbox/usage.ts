import { db } from "@/lib/db";

// What the sandboxes have used this month against the plan's free allowance (Vercel Hobby, read 2026-10-17: 5 active CPU hours, 420 GB-hours of
// memory, 5,000 sandbox creations, 20 GB of data transfer). On Hobby, going over pauses sandbox creation until the cycle resets; it never charges,
// so the risk is features stopping, not a bill. Each allowance can be changed with a Config value when the plan changes.
const num = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : fallback; };
export const allowance = () => ({
  activeCpuMs: num("SANDBOX_ALLOW_CPU_HOURS", 5) * 3_600_000,
  gbHours: num("SANDBOX_ALLOW_GB_HOURS", 420),
  creations: num("SANDBOX_ALLOW_CREATIONS", 5000),
  networkBytes: num("SANDBOX_ALLOW_TRANSFER_GB", 20) * 1e9,
});
export const ALERT_AT = 0.8;
export const BLOCK_AT = 0.95;

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export type UsageReport = { month: string; used: { activeCpuMs: number; gbHours: number; creations: number; networkBytes: number }; allowance: ReturnType<typeof allowance>; share: number; alerted: boolean };

export async function usageNow(): Promise<UsageReport> {
  const month = monthKey();
  const row = await db.sandboxUsageMonth.findUnique({ where: { month } });
  const used = { activeCpuMs: Number(row?.activeCpuMs ?? 0), gbHours: row?.gbHours ?? 0, creations: row?.creations ?? 0, networkBytes: Number(row?.networkBytes ?? 0) };
  const a = allowance();
  const share = Math.max(used.activeCpuMs / a.activeCpuMs, used.gbHours / a.gbHours, used.creations / a.creations, used.networkBytes / a.networkBytes);
  return { month, used, allowance: a, share, alerted: Boolean(row?.alertedAt) };
}

/** Adds to this month's totals and raises the 80 percent alert once a month (a loud log line the owner's health page also shows). */
export async function recordUsage(add: { activeCpuMs?: number; gbHours?: number; creations?: number; networkBytes?: number }) {
  const month = monthKey();
  await db.sandboxUsageMonth.upsert({
    where: { month },
    create: { month, activeCpuMs: BigInt(Math.round(add.activeCpuMs ?? 0)), gbHours: add.gbHours ?? 0, creations: add.creations ?? 0, networkBytes: BigInt(Math.round(add.networkBytes ?? 0)) },
    update: { activeCpuMs: { increment: BigInt(Math.round(add.activeCpuMs ?? 0)) }, gbHours: { increment: add.gbHours ?? 0 }, creations: { increment: add.creations ?? 0 }, networkBytes: { increment: BigInt(Math.round(add.networkBytes ?? 0)) } },
  });
  const u = await usageNow();
  if (u.share >= ALERT_AT && !u.alerted) {
    const claimed = await db.sandboxUsageMonth.updateMany({ where: { month, alertedAt: null }, data: { alertedAt: new Date() } });
    if (claimed.count) console.error(`SANDBOX USAGE ALERT: ${Math.round(u.share * 100)}% of this month's sandbox allowance is used (${month}). New jobs stop at ${BLOCK_AT * 100}%.`);
  }
}

/** Memory time as the plan bills it: 2 GB per vCPU, at least one minute per sandbox. */
export const gbHoursFor = (vcpus: number, wallMs: number) => (vcpus * 2 * Math.max(wallMs, 60_000)) / 3_600_000;
