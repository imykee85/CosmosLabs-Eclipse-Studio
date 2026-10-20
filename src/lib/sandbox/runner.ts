import { randomUUID } from "node:crypto";
import type { Prisma, SandboxJob } from "@prisma/client";
import { db } from "@/lib/db";
import { spendCredits } from "@/lib/credits";
import { claimUsage } from "@/lib/usage";
import { createSandboxJobHeld, SANDBOX_OPEN } from "@/lib/reservations";
import { baseSnapshotId, sandboxProvider } from "./index";
import { SandboxError, tail, type SandboxProvider } from "./provider";
import { kindDef } from "./kinds";
import { JobInputError, type KindDef, type StageCtx, type StageResult } from "./kinds/types";
import { BLOCK_AT, gbHoursFor, recordUsage, usageNow } from "./usage";

import { fmtCredits } from "@/lib/credit-units";
// The job runner. A job never waits inside one long request: each call to `advance` does ONE short step (create the sandbox, start a stage, look
// at a running stage, collect, stop, settle) and saves where it got to. What calls it: the person's own polling (GET /api/sandbox/jobs/<id>), a
// short background drive right after the job is queued, and the daily sweeper. A lock on the row (lockedAt) means two callers never run the same
// step; every step is safe to repeat. Whatever happens after the sandbox exists, the job always passes through "stop", so no sandbox is left behind.

const num = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback; };
export const limits = () => ({
  maxConcurrent: num("SANDBOX_MAX_CONCURRENT", 8), // Hobby allows 10 at once: 2 stay free for the owner's smoke and build jobs
  perUserRunning: 1,
  perUserDay: num("SANDBOX_JOBS_PER_DAY", 30),
});
export const creditsOn = () => process.env.CREDITS_ENABLED === "1";
const FINAL = ["succeeded", "failed", "canceled", "expired"];
const ACTIVE = ["creating", "running", "collecting"];
const LOCK_MS = 90_000;
const RETRY_MS = 60_000;
const ADMIN_KINDS = new Set(["smoke", "build.base"]);

type Final = { status: "succeeded" | "failed" | "canceled" | "expired"; output?: Record<string, unknown>; charge?: number; error?: JobError };
export type JobError = { code: string; message: string; retryable: boolean; detail?: string };
type State = { results?: StageResult[]; allowFail?: number[]; final?: Final; retryAt?: number; fellBack?: boolean; snapshotUsed?: string | null };

const stateOf = (j: SandboxJob): State => (j.state && typeof j.state === "object" && !Array.isArray(j.state) ? (j.state as State) : {});
const asJson = (v: unknown) => v as Prisma.InputJsonValue;

export type EnqueueResult = { ok: true; job: SandboxJob } | { ok: false; status: number; error: string };

/** A person counts as paid after any purchase. Config `SANDBOX_REQUIRE_PAID=off` lifts the check (for the owner's own tests). */
export async function isPaid(userId: string) {
  if (process.env.SANDBOX_REQUIRE_PAID === "off") return true;
  return (await db.creditLedger.count({ where: { userId, reason: "PURCHASE" } })) > 0;
}

export const BUSY_TEXT = "Building and editing tools are busy right now, try again later.";

/** Queues a job: checks the switch, the plan, the limits and the price, then creates the row holding its price. `input` is built by the server. */
export async function enqueue(kind: string, userId: string, input: unknown, opts: { admin?: boolean; id?: string } = {}): Promise<EnqueueResult> {
  const def = kindDef(kind);
  if (!def) return { ok: false, status: 400, error: "Unknown job kind." };
  if (ADMIN_KINDS.has(kind) && !opts.admin) return { ok: false, status: 403, error: "Only the owner can run that." };
  if (process.env.SANDBOX_KILL_SWITCH === "1" && !opts.admin) return { ok: false, status: 503, error: BUSY_TEXT };
  const provider = sandboxProvider();
  if (!provider) return { ok: false, status: 503, error: "This needs the sandbox service, which is not switched on yet." };
  const parsed = def.schema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "That request is not valid." };
  if (!opts.admin) {
    if (!(await isPaid(userId))) return { ok: false, status: 402, error: "This runs on a cloud computer, so it is part of the paid plans. Upgrade to use it." };
    if ((await usageNow()).share >= BLOCK_AT) return { ok: false, status: 503, error: BUSY_TEXT };
    if (!(await claimUsage(userId, "sandbox", limits().perUserDay, 24 * 3600_000))) return { ok: false, status: 429, error: "You have reached today's limit for these jobs. Try again tomorrow." };
  }
  const price = creditsOn() ? def.price(parsed.data as never) : 0;
  const id = opts.id ?? `sbx${randomUUID().replace(/-/g, "").slice(0, 21)}`;
  const r = await createSandboxJobHeld(userId, price, {
    id, userId, kind, status: "queued", step: "create", provider: provider.id, vcpus: def.vcpus, input: asJson(parsed.data), creditsReserved: price,
    deadlineAt: new Date(Date.now() + def.deadlineMs), message: "Waiting for a cloud computer",
  }, opts.admin ? undefined : async (tx) => {
    const open = await tx.sandboxJob.count({ where: { userId, status: { in: SANDBOX_OPEN } } });
    return open >= limits().perUserRunning ? "You already have one of these running. Wait for it to finish or cancel it." : null;
  });
  if ("refused" in r) return { ok: false, status: 409, error: r.refused };
  if ("have" in r) return { ok: false, status: 402, error: `This needs ${fmtCredits(price)} credits and you have ${fmtCredits(Math.max(0, r.have - r.held))} free.` };
  return { ok: true, job: r.row };
}

async function audit(job: SandboxJob, action: string, command: string | null, extra: { exitCode?: number | null; durationMs?: number; ok?: boolean; note?: string } = {}) {
  await db.sandboxAudit.create({ data: { userId: job.userId, jobId: job.id, tool: action, command: command?.slice(0, 500) ?? null, durationMs: extra.durationMs ?? 0, exitCode: extra.exitCode ?? null, ok: extra.ok ?? true, note: extra.note?.slice(0, 500) ?? null } }).catch((e) => console.error("sandbox audit failed", e));
}

/** The shown form of a command: the program and its arguments, or just the program when the arguments carry signed links. */
const shown = (cmd: string, args: string[], secret?: boolean) => (secret ? `${cmd} [${args.length} arguments hidden]` : [cmd, ...args].join(" "));

async function claim(id: string): Promise<SandboxJob | null> {
  const got = await db.sandboxJob.updateMany({ where: { id, status: { notIn: FINAL }, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] }, data: { lockedAt: new Date() } });
  return got.count ? db.sandboxJob.findUnique({ where: { id } }) : null;
}

async function save(job: SandboxJob, data: Prisma.SandboxJobUncheckedUpdateInput): Promise<SandboxJob> {
  return db.sandboxJob.update({ where: { id: job.id }, data: { ...data, lockedAt: null } });
}

/** Ends a job that never got a sandbox. */
const endWithout = (job: SandboxJob, final: Final) => save(job, { status: final.status, step: "settle", state: asJson({ ...stateOf(job), final }), error: final.error ? asJson(final.error) : undefined, message: final.error?.message ?? null });
/** Ends a job that has a sandbox: it goes through stop first. */
const endWith = (job: SandboxJob, final: Final) => save(job, { status: "collecting", step: "stop", state: asJson({ ...stateOf(job), final }), message: final.status === "succeeded" ? "Finishing" : final.error?.message ?? null });

function failure(code: string, message: string, detail?: string, retryable = false): JobError {
  return { code, message, retryable, ...(detail ? { detail: tail(detail, 2048) } : {}) };
}

/** Does one step of a job and returns it as saved. Safe to call from anywhere at any time. */
export async function advance(id: string): Promise<SandboxJob | null> {
  const job = await claim(id);
  if (!job) return db.sandboxJob.findUnique({ where: { id } });
  const provider = sandboxProvider();
  const def = kindDef(job.kind);
  try {
    if (!provider || !def) return await endOrSettle(job, provider, { status: "failed", error: failure("unavailable", "The sandbox service is switched off.") });
    return await step(job, provider, def);
  } catch (err) {
    console.error("sandbox step failed", job.id, job.step, err);
    const e = err instanceof SandboxError ? err : null;
    const attempts = job.attempts + 1;
    if (e?.code === "not_found" && job.sandboxName) return await endWith({ ...job, attempts }, { status: "failed", error: failure("vanished", "The cloud computer stopped before the job finished. Nothing was charged.", e.raw) });
    if (attempts >= 4) return await endOrSettle({ ...job, attempts }, provider, { status: "failed", error: failure(e?.code ?? "sandbox_error", def?.failMessage ?? "The job could not finish. Nothing was charged.", e?.raw ?? String(err)) });
    return await save(job, { attempts });
  }
}

const endOrSettle = (job: SandboxJob, provider: SandboxProvider | null, final: Final) => (job.sandboxName && provider ? endWith(job, final) : endWithout(job, final));

async function step(job: SandboxJob, provider: SandboxProvider, def: KindDef): Promise<SandboxJob> {
  const st = stateOf(job);
  const input = job.input as never;
  const at = job.step ?? "settle";

  // The person pressed Cancel while a step was running: wind down now.
  if (job.cancelRequested && !["stop", "snapshot", "settle"].includes(at)) {
    if (job.sandboxName && job.cmdId) await provider.kill(job.sandboxName, job.cmdId).catch(() => {});
    return endOrSettle(job, provider, { status: "canceled", error: failure("canceled", "Canceled. Nothing was charged.") });
  }
  // A build session simply ends at its deadline (it was used, so it is charged for the time it ran).
  if (at === "session" && Date.now() > job.deadlineAt.getTime()) return endWith(job, { status: "succeeded", output: { minutes: Math.ceil((Date.now() - (job.startedAt?.getTime() ?? Date.now())) / 60_000), endedBy: "time limit" } });
  // The hard stop: past the deadline, kill what runs and wind the job down (expired), unless it is already winding down.
  if (Date.now() > job.deadlineAt.getTime() && !["stop", "snapshot", "settle"].includes(at)) {
    if (job.sandboxName && job.cmdId) await provider.kill(job.sandboxName, job.cmdId).catch(() => {});
    const final: Final = { status: "expired", error: failure("timeout", job.status === "queued" ? "No cloud computer was free in time. Nothing was charged." : "The job ran out of time and was stopped. Nothing was charged.") };
    return endOrSettle(job, provider, final);
  }

  if (at === "create") {
    if (st.retryAt && Date.now() < st.retryAt) return save(job, {});
    const running = await db.sandboxJob.count({ where: { status: { in: ACTIVE }, sandboxName: { not: null }, id: { not: job.id } } });
    if (running >= limits().maxConcurrent && !ADMIN_KINDS.has(job.kind)) return save(job, { message: "Waiting for a free cloud computer", state: asJson({ ...st, retryAt: Date.now() + 5000 }) });
    const snapshotId = def.base === "snapshot" && !st.fellBack ? await baseSnapshotId() : null;
    if (def.base === "snapshot" && !snapshotId && !def.imageFallback) return endWithout(job, { status: "failed", error: failure("not_ready", "The cloud computer is not set up yet. Nothing was charged.", "No base snapshot: run build-base from /admin/sandbox.") });
    const name = job.kind === "core.exec" ? `core_${job.id}` : `job_${job.id}`;
    await save(job, { status: "creating", message: "Starting a cloud computer" });
    try {
      await provider.create({ name, vcpus: def.vcpus, timeoutMs: def.deadlineMs + 60_000, network: def.network(input), base: snapshotId ? { snapshotId } : {}, tags: { kind: job.kind } });
    } catch (err) {
      const e = err instanceof SandboxError ? err : new SandboxError("unknown", false, String(err));
      await audit(job, "create", null, { ok: false, note: `${e.code}: ${e.raw}` });
      if ((e.code === "not_found" || e.code === "image_not_ready") && snapshotId) {
        console.error("SANDBOX BASE MISSING: the base snapshot could not be used", snapshotId, e.raw);
        if (def.imageFallback) return save(job, { status: "queued", state: asJson({ ...st, fellBack: true }) });
      }
      if (e.code === "quota") return save(job, { status: "queued", message: BUSY_TEXT, attempts: job.attempts + 1, error: asJson(failure("quota", BUSY_TEXT, e.raw, true)), state: asJson({ ...st, retryAt: Date.now() + RETRY_MS }) });
      if (e.retryable && job.attempts < 3) return save(job, { status: "queued", attempts: job.attempts + 1, state: asJson({ ...st, retryAt: Date.now() + 10_000 }) });
      return endWithout(job, { status: "failed", error: failure(e.code, "A cloud computer could not be started. Nothing was charged.", e.raw) });
    }
    await recordUsage({ creations: 1 });
    await audit(job, "create", null, { note: snapshotId ? `snapshot ${snapshotId}` : "managed image" });
    const next = def.session ? "session" : "stage:0:start";
    return save(job, { status: "running", sandboxName: name, startedAt: new Date(), step: next, attempts: 0, error: undefined, message: def.session ? null : "Working", state: asJson({ ...st, retryAt: undefined, results: [], snapshotUsed: snapshotId }) });
  }

  const name = job.sandboxName!;
  const ctx: StageCtx = { job, provider, name, results: st.results ?? [] };

  const m = /^stage:(\d+):(start|poll)$/.exec(at);
  if (m) {
    const i = Number(m[1]);
    if (m[2] === "start") {
      const s = await def.stage!(ctx, i, input);
      if (s.network) await provider.setNetwork(name, s.network);
      if (s.before) await provider.run(name, s.before.cmd, s.before.args, { timeoutMs: 15_000 });
      if (s.files?.length) await provider.writeFiles(name, s.files);
      const { cmdId } = await provider.start(name, s.cmd, s.args, { cwd: undefined, env: s.env, sudo: s.sudo });
      await audit(job, `stage ${s.name}`, shown(s.cmd, s.args, s.secretArgs), { note: s.network ? `network ${s.network.kind}` : undefined });
      return save(job, { cmdId, step: `stage:${i}:poll`, state: asJson({ ...st, allowFail: s.allowFail ? [...(st.allowFail ?? []), i] : st.allowFail }) });
    }
    const s = await provider.status(name, job.cmdId!);
    if (!s.done) return save(job, s.info ? { message: `Working: ${s.info}` } : {});
    const result: StageResult = { exitCode: s.exitCode ?? -1, stdout: tail(s.stdoutTail, 16_384), stderr: tail(s.stderrTail, 8192) };
    const results = [...ctx.results.slice(0, i), result];
    await audit(job, `stage ${i} ended`, null, { exitCode: result.exitCode, ok: result.exitCode === 0 });
    if (result.exitCode !== 0 && !st.allowFail?.includes(i)) {
      return endWith({ ...job, state: { ...st, results } as unknown as SandboxJob["state"] }, { status: "failed", error: failure("exit", def.failMessage, result.stderr || result.stdout) });
    }
    const last = i + 1 >= def.stageCount!(input);
    return save(job, { cmdId: null, step: last ? "collect" : `stage:${i + 1}:start`, state: asJson({ ...st, results }) });
  }

  if (at === "collect") {
    const f = await def.collect!(ctx, input);
    const final: Final = f.failed ? { status: "failed", output: f.output, error: failure("check", f.failed) } : { status: "succeeded", output: f.output, charge: f.charge };
    if (def.snapshotAtEnd && final.status === "succeeded") return save(job, { status: "collecting", step: "snapshot", state: asJson({ ...st, final }), message: "Saving the base" });
    return endWith(job, final);
  }

  if (at === "session") return save(job, {}); // a build session stays open until it is ended (endSession) or its deadline passes

  if (at === "snapshot") {
    const final = st.final!;
    if (final.status === "succeeded" && provider.snapshot) {
      const { snapshotId } = await provider.snapshot(name);
      await audit(job, "snapshot", null, { note: snapshotId });
      const wall = Date.now() - (job.startedAt?.getTime() ?? Date.now());
      await recordUsage({ gbHours: gbHoursFor(job.vcpus, wall) });
      return save(job, { step: "settle", state: asJson({ ...st, final: { ...final, output: { ...final.output, snapshotId } } }) });
    }
    return save(job, { step: "stop" });
  }

  if (at === "stop") {
    const usage = await provider.stop(name);
    const wall = Date.now() - (job.startedAt?.getTime() ?? Date.now());
    await recordUsage({ activeCpuMs: usage.activeCpuMs ?? 0, networkBytes: usage.networkBytes ?? 0, gbHours: gbHoursFor(job.vcpus, wall) });
    await audit(job, "stop", null, { note: `cpu ${usage.activeCpuMs ?? "?"} ms` });
    return save(job, { step: "settle", activeCpuMs: usage.activeCpuMs ?? null, networkBytes: usage.networkBytes != null ? BigInt(usage.networkBytes) : null });
  }

  if (at === "settle") return settle(job, def);
  return save(job, {});
}

/** The last step: the job gets its final status and, only when it succeeded, its price is charged (once: creditsCharged is set in the same go). */
async function settle(job: SandboxJob, def: KindDef): Promise<SandboxJob> {
  const st = stateOf(job);
  const final = st.final ?? { status: "failed" as const, error: failure("unknown", def.failMessage) };
  let charge = 0;
  if (final.status === "succeeded" && creditsOn()) {
    charge = def.session && def.sessionCharge ? def.sessionCharge(job) : final.charge ?? job.creditsReserved;
    charge = Math.max(0, Math.min(charge, job.creditsReserved || charge));
  }
  if (charge > 0) {
    try { await spendCredits(job.userId, charge, `Cloud computer: ${job.kind}`); } catch (err) { console.error("sandbox settle charge failed", job.id, err); charge = 0; }
  }
  const finished = await save(job, {
    status: final.status, step: null, cmdId: null, finishedAt: new Date(), creditsCharged: charge, output: final.output ? asJson(final.output) : undefined,
    error: final.error ? asJson(final.error) : undefined, message: final.status === "succeeded" ? null : final.error?.message ?? null,
  });
  if (def.onFinished) await def.onFinished(finished).catch((e) => console.error("sandbox onFinished failed", job.id, e));
  return finished;
}

/** Steps a job forward for up to `budgetMs` (used right after queuing, inside waitUntil): short jobs finish even if the person closes the page. */
export async function drive(id: string, budgetMs = 45_000, pollMs = 1500): Promise<SandboxJob | null> {
  const until = Date.now() + budgetMs;
  let job: SandboxJob | null = null;
  while (Date.now() < until) {
    const before = await db.sandboxJob.findUnique({ where: { id }, select: { step: true, updatedAt: true } });
    job = await advance(id);
    if (!job || FINAL.includes(job.status) || job.step === "session") return job;
    if (job.step === before?.step) await new Promise((r) => setTimeout(r, pollMs));
  }
  return job;
}

/** Advances a job only when nobody touched it in the last couple of seconds (so a page polling every 2 seconds costs one step at most). */
export async function advanceIfStale(job: SandboxJob, staleMs = 1500): Promise<SandboxJob> {
  if (FINAL.includes(job.status) || job.step === "session") return job;
  if (Date.now() - job.updatedAt.getTime() < staleMs) return job;
  return (await advance(job.id)) ?? job;
}

/** The person's own Cancel: stops the command and the sandbox, and nothing is charged. */
export async function cancel(id: string, userId: string | null): Promise<SandboxJob | null> {
  const job = await db.sandboxJob.findFirst({ where: { id, ...(userId ? { userId } : {}) } });
  if (!job) return null;
  if (FINAL.includes(job.status)) return job;
  // The flag is read at the start of the next step (a step in flight cannot overwrite it); then the job is driven to its end right away.
  await db.sandboxJob.update({ where: { id }, data: { cancelRequested: true } });
  return (await drive(id, 20_000, 400)) ?? job;
}

/** Ends a Core build session (the agent's sandbox_stop, the person's Stop, or the deadline). */
export async function endSession(id: string): Promise<SandboxJob | null> {
  const job = await claim(id);
  if (!job) return db.sandboxJob.findUnique({ where: { id } });
  if (job.step !== "session") { await save(job, {}); return job; }
  const saved = await endWith(job, { status: "succeeded", output: { minutes: Math.ceil((Date.now() - (job.startedAt?.getTime() ?? Date.now())) / 60_000) } });
  return (await drive(saved.id, 20_000, 500)) ?? saved;
}

/** The sweeper: advances jobs nobody is polling and winds down anything past its deadline. Run by the cron and by the admin page. */
export async function sweep(limit = 30): Promise<{ advanced: number; expired: number }> {
  const stale = await db.sandboxJob.findMany({ where: { status: { notIn: FINAL }, updatedAt: { lt: new Date(Date.now() - 20_000) } }, orderBy: { updatedAt: "asc" }, take: limit });
  let advanced = 0, expired = 0;
  for (const j of stale) {
    if (j.deadlineAt.getTime() < Date.now()) expired++;
    const after = await drive(j.id, 15_000, 500).catch(() => null);
    if (after) advanced++;
  }
  return { advanced, expired };
}

export function inputError(message: string): never { throw new JobInputError(message); }
export { FINAL as FINAL_STATUSES };
