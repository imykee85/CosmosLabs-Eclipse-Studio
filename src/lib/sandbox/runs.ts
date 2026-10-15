import { db } from "@/lib/db";
import { getBalance, spendCredits, InsufficientCreditsError } from "@/lib/credits";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { BUILTIN_ROOT, builtinDef, skillFiles } from "@/lib/core-skills/builtin";
import { putObject, storageEnabled } from "@/lib/storage";
import { skillEnabled } from "@/lib/core-skills/settings";
import { sandboxProvider } from "./index";
import { makeZip } from "./zip";

// A sandbox-backed skill run: the person confirms an estimate, credits are charged step by step (plan, build, each review round),
// and every cap below stops the run cleanly. All numbers are Config values and PROVISIONAL until a real run has been measured.
const num = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback; };
export const limits = () => ({
  maxMinutes: num("SANDBOX_MAX_RUN_MINUTES", 60),
  maxToolCalls: num("SANDBOX_MAX_TURNS", 400),
  creditCap: num("SANDBOX_RUN_CREDIT_CAP", 1200),
  perUser: num("SANDBOX_MAX_PER_USER", 1),
  global: num("SANDBOX_MAX_GLOBAL", 5),
  idleMinutes: num("SANDBOX_IDLE_MINUTES", 20),
});
export const STEPS = ["plan", "build", "review1", "review2", "review3"] as const;
export type Step = (typeof STEPS)[number];
export const stepCredits = (s: Step) => (s === "plan" ? num("TASTE_CREDITS_PLAN", 100) : s === "build" ? num("TASTE_CREDITS_BUILD", 600) : num("TASTE_CREDITS_REVIEW", 150));
export const creditsOn = () => process.env.CREDITS_ENABLED === "1";
export const ACTIVE = ["starting", "running", "finishing"];

export function estimate() {
  const all = STEPS.reduce((n, s) => n + stepCredits(s), 0);
  return { plan: stepCredits("plan"), build: stepCredits("build"), reviewEach: stepCredits("review1"), max: Math.min(all, limits().creditCap), creditsOn: creditsOn(), minutes: "30 to 45" };
}

export type StartResult = { ok: true; runId: string } | { ok: false; code: "unavailable" | "not_paid" | "busy" | "credits" | "failed"; message: string };

/** A person counts as paid after any purchase. Config `SANDBOX_REQUIRE_PAID=off` lifts the check (for the owner's own tests). */
async function isPaid(userId: string) {
  if (process.env.SANDBOX_REQUIRE_PAID === "off") return true;
  return (await db.creditLedger.count({ where: { userId, reason: "PURCHASE" } })) > 0;
}

export async function startRun(userId: string, skillId: string): Promise<StartResult> {
  const def = builtinDef(skillId);
  const provider = sandboxProvider();
  if (!def?.requiresSandbox) return { ok: false, code: "failed", message: "That skill does not use a sandbox." };
  if (!(await skillEnabled(userId, skillId))) return { ok: false, code: "failed", message: "You switched this skill off in the Skills panel." };
  if (!provider) return { ok: false, code: "unavailable", message: "Website building is not switched on yet. It needs a sandbox service that has not been connected." };
  if (!(await isPaid(userId))) return { ok: false, code: "not_paid", message: "Website building runs code for you, so it is for paid plans. Upgrade to use it." };
  const lim = limits();
  if ((await db.sandboxRun.count({ where: { userId, status: { in: ACTIVE } } })) >= lim.perUser) return { ok: false, code: "busy", message: "You already have a build running. Stop it or wait for it to finish." };
  if ((await db.sandboxRun.count({ where: { status: { in: ACTIVE } } })) >= lim.global) return { ok: false, code: "busy", message: "All build machines are busy right now. Try again in a few minutes." };
  if (creditsOn()) {
    const need = stepCredits("plan") + stepCredits("build"), have = await getBalance(userId);
    if (have < need) return { ok: false, code: "credits", message: `A build needs at least ${need} credits to start and you have ${have}.` };
  }
  const run = await db.sandboxRun.create({ data: { userId, skillId, creditCap: lim.creditCap, deadlineAt: new Date(Date.now() + lim.maxMinutes * 60_000) } });
  let sandboxId: string | null = null;
  try {
    sandboxId = await provider.start(userId);
    for (const f of await skillFiles(skillId)) await provider.writeFile(sandboxId, `/work/skills/${skillId}/${f.rel}`, f.data);
    // The browser wrapper (see core/skills/wrappers/chrome): inspect.mjs reads CHROME_PATH and cannot add --no-sandbox itself.
    await provider.writeFile(sandboxId, "/work/bin/chrome", await fsp.readFile(path.join(BUILTIN_ROOT, "..", "wrappers", "chrome")));
    await provider.exec(sandboxId, "mkdir -p /work/project && chmod +x /work/bin/chrome", { timeoutMs: 10_000 });
    if (creditsOn()) await spendCredits(userId, stepCredits("plan"), `Website build: plan (${def.title})`);
    await db.sandboxRun.update({ where: { id: run.id }, data: { sandboxId, status: "running", creditsCharged: creditsOn() ? stepCredits("plan") : 0, lastActiveAt: new Date() } });
    return { ok: true, runId: run.id };
  } catch (err) {
    if (sandboxId) await provider.destroy(sandboxId).catch(() => {});
    await db.sandboxRun.update({ where: { id: run.id }, data: { status: "failed", endedAt: new Date(), note: "Could not start." } });
    if (err instanceof InsufficientCreditsError) return { ok: false, code: "credits", message: `Not enough credits to start (${err.balance} available, ${err.needed} needed).` };
    console.error("sandbox run start failed", err);
    return { ok: false, code: "failed", message: "The build machine could not be started. Nothing was charged." };
  }
}

export const activeRun = (userId: string) => db.sandboxRun.findFirst({ where: { userId, status: "running" }, orderBy: { createdAt: "desc" } });

/** Moves a run to its next step and charges for it. Refuses (and charges nothing) past the cap or without enough credits. */
export async function enterStep(runId: string, userId: string, step: Step): Promise<{ ok: true; charged: number } | { ok: false; message: string }> {
  const run = await db.sandboxRun.findFirst({ where: { id: runId, userId, status: "running" } });
  if (!run) return { ok: false, message: "There is no running build." };
  const from = STEPS.indexOf(run.step as Step), to = STEPS.indexOf(step);
  if (to !== from + 1) return { ok: false, message: `The next step is ${STEPS[from + 1] ?? "none (the build is complete)"}.` };
  const cost = creditsOn() ? stepCredits(step) : 0;
  if (run.creditsCharged + cost > run.creditCap) return { ok: false, message: "This build has reached its credit limit. Finish with what you have." };
  try {
    if (cost) await spendCredits(userId, cost, `Website build: ${step}`);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { ok: false, message: `Not enough credits for the ${step} step (${err.balance} available, ${err.needed} needed). Finish with what you have.` };
    throw err;
  }
  await db.sandboxRun.update({ where: { id: runId }, data: { step, creditsCharged: { increment: cost }, lastActiveAt: new Date() } });
  return { ok: true, charged: cost };
}

/** Ends a run: saves the site (a zip) and the picture credits to storage first, then destroys the sandbox. */
export async function endRun(runId: string, status: "done" | "stopped" | "failed", note?: string): Promise<void> {
  const claimed = await db.sandboxRun.updateMany({ where: { id: runId, status: { in: ["starting", "running"] } }, data: { status: "finishing" } });
  if (!claimed.count) return;
  const run = await db.sandboxRun.findUniqueOrThrow({ where: { id: runId } });
  const provider = sandboxProvider();
  let resultKey: string | null = null, credits: string | null = null, saveNote = note ?? null;
  if (provider && run.sandboxId) {
    try {
      const files = (await provider.listFiles(run.sandboxId, "/work/project")).filter((f) => !/\/(node_modules|\.git)\//.test(f.path) && f.size < 25_000_000);
      if (files.length && storageEnabled) {
        const entries: { name: string; data: Uint8Array }[] = [];
        let total = 0;
        for (const f of files.slice(0, 500)) {
          total += f.size;
          if (total > 100_000_000) break;
          entries.push({ name: f.path.replace(/^\/work\/project\//, ""), data: await provider.readFile(run.sandboxId, f.path) });
        }
        resultKey = `u/${run.userId}/core/${run.id}/site.zip`;
        await putObject(resultKey, makeZip(entries), "application/zip");
      } else if (files.length) saveNote = [saveNote, "Storage is not set up, so the files were not saved."].filter(Boolean).join(" ");
      // The skill keeps picture credits in assets/credits.json; `assets.mjs --credits` prints them (and a "none yet" line when empty).
      const has = (await provider.listFiles(run.sandboxId, "/work/project/assets")).some((f) => f.path.endsWith("/assets/credits.json"));
      if (has) {
        const c = await provider.exec(run.sandboxId, `node /work/skills/${run.skillId}/scripts/assets.mjs --credits`, { timeoutMs: 30_000, cwd: "/work/project" }).catch(() => null);
        if (c && c.exitCode === 0 && c.stdout.trim()) credits = c.stdout.trim().slice(0, 20_000);
      }
    } catch (err) {
      console.error("saving a sandbox run failed", runId, err);
      saveNote = [saveNote, "Saving the files failed."].filter(Boolean).join(" ");
    }
    await provider.destroy(run.sandboxId).catch((e) => console.error("sandbox destroy failed", runId, e));
  }
  await db.sandboxRun.update({ where: { id: runId }, data: { status, endedAt: new Date(), resultKey, credits, note: saveNote } });
}

/** Ends runs past their deadline or idle too long. Run from the daily cron and when someone asks for their run. */
export async function sweepRuns(): Promise<number> {
  const lim = limits();
  const stale = await db.sandboxRun.findMany({
    where: { status: { in: ["starting", "running"] }, OR: [{ deadlineAt: { lt: new Date() } }, { lastActiveAt: { lt: new Date(Date.now() - lim.idleMinutes * 60_000) } }] },
    take: 20,
  });
  for (const r of stale) await endRun(r.id, "stopped", r.deadlineAt < new Date() ? "The time limit was reached." : "Stopped after being idle.");
  return stale.length;
}
