import { db } from "@/lib/db";
import { sandboxProvider } from "./index";
import { activeRun, endRun, enterStep, limits, STEPS, type Step } from "./runs";

// The tools the assistant uses against its sandbox. They find the sandbox through the person's own running build (never an id the
// model supplies), so one person can never reach another's files, and nothing here can read Eclipse's environment.
export type SandboxOutcome = { text: string; isError?: boolean; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } };
export const SANDBOX_TOOL_NAMES = ["sandbox_exec", "sandbox_read_file", "sandbox_write_file", "sandbox_list_files", "view_image", "run_step"] as const;
const MAX_OUT = 20_000, MAX_WRITE = 2_000_000, MAX_READ = 1_000_000, MAX_IMAGE = 3_000_000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const clip = (s: string) => (s.length > MAX_OUT ? `${s.slice(0, MAX_OUT / 2)}\n[... ${s.length - MAX_OUT} characters left out ...]\n${s.slice(-MAX_OUT / 2)}` : s);
const inWork = (p: string) => /^\/work(\/|$)/.test(p) && !p.split("/").includes("..");

function sniffImage(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

async function audit(userId: string, runId: string | null, tool: string, command: string | null, started: number, exitCode: number | null, ok: boolean) {
  await db.sandboxAudit.create({ data: { userId, runId, tool, command: command?.slice(0, 500) ?? null, durationMs: Date.now() - started, exitCode, ok } }).catch((e) => console.error("sandbox audit failed", e));
}

export async function runSandboxTool(name: string, args: Record<string, unknown>, userId: string): Promise<SandboxOutcome> {
  const started = Date.now();
  const provider = sandboxProvider();
  if (!provider) return { text: "The build machine is not available.", isError: true };
  const run = await activeRun(userId);
  if (!run?.sandboxId) return { text: "There is no running build. The person starts one from the Skills panel after confirming the cost.", isError: true };
  const lim = limits();
  if (run.deadlineAt < new Date()) { await endRun(run.id, "stopped", "The time limit was reached."); return { text: "The build reached its time limit and was stopped. Tell the person what was finished.", isError: true }; }
  if (run.turns >= lim.maxToolCalls) { await endRun(run.id, "stopped", "The step limit was reached."); return { text: "The build reached its step limit and was stopped. Tell the person what was finished.", isError: true }; }
  await db.sandboxRun.update({ where: { id: run.id }, data: { turns: { increment: 1 }, lastActiveAt: new Date() } });

  let command: string | null = null, exitCode: number | null = null, ok = true;
  try {
    switch (name) {
      case "sandbox_exec": {
        command = str(args.command, 4000);
        if (!command) return { text: "Give a command.", isError: true };
        const cwd = str(args.cwd, 200) || "/work/project";
        if (!inWork(cwd)) { ok = false; return { text: "The folder must be under /work.", isError: true }; }
        const timeoutMs = Math.min(Math.max(Number(args.timeout_seconds) || 120, 1), 600) * 1000;
        const r = await provider.exec(run.sandboxId, `export CHROME_PATH=/work/bin/chrome; ${command}`, { timeoutMs, cwd });
        exitCode = r.exitCode; ok = !r.timedOut && r.exitCode === 0;
        return { text: JSON.stringify({ exit_code: r.exitCode, timed_out: r.timedOut, seconds: Math.round(r.durationMs / 100) / 10, stdout: clip(r.stdout), stderr: clip(r.stderr) }), isError: r.timedOut };
      }
      case "sandbox_read_file": {
        const p = str(args.path, 300); command = p;
        if (!inWork(p)) { ok = false; return { text: "The path must be under /work.", isError: true }; }
        const b = await provider.readFile(run.sandboxId, p);
        if (b.length > MAX_READ) { ok = false; return { text: "That file is too large to read; use sandbox_exec to look at part of it.", isError: true }; }
        return { text: clip(new TextDecoder().decode(b)) };
      }
      case "sandbox_write_file": {
        const p = str(args.path, 300), content = typeof args.content === "string" ? args.content : ""; command = p;
        if (!inWork(p)) { ok = false; return { text: "The path must be under /work.", isError: true }; }
        if (content.length > MAX_WRITE) { ok = false; return { text: "That file is too large; write it in parts.", isError: true }; }
        await provider.writeFile(run.sandboxId, p, content);
        return { text: `Wrote ${content.length} characters to ${p}.` };
      }
      case "sandbox_list_files": {
        const d = str(args.path, 300) || "/work/project"; command = d;
        if (!inWork(d)) { ok = false; return { text: "The path must be under /work.", isError: true }; }
        const files = (await provider.listFiles(run.sandboxId, d)).filter((f) => !/\/node_modules\//.test(f.path));
        return { text: JSON.stringify({ files: files.slice(0, 300), more: Math.max(files.length - 300, 0) }) };
      }
      case "view_image": {
        const p = str(args.path, 300); command = p;
        if (!inWork(p)) { ok = false; return { text: "The path must be under /work.", isError: true }; }
        const b = await provider.readFile(run.sandboxId, p);
        const type = sniffImage(b);
        if (!type || b.length > MAX_IMAGE) { ok = false; return { text: "That is not a PNG, JPEG or WebP picture under 3 MB.", isError: true }; }
        return { text: `Picture ${p}`, image: { mediaType: type, data: Buffer.from(b).toString("base64") } };
      }
      case "run_step": {
        const step = str(args.step, 20) as Step; command = step;
        if (!STEPS.includes(step) || step === "plan") { ok = false; return { text: `Step must be one of: ${STEPS.slice(1).join(", ")}.`, isError: true }; }
        const r = await enterStep(run.id, userId, step);
        if (!r.ok) { ok = false; return { text: r.message, isError: true }; }
        return { text: r.charged ? `Started ${step}. ${r.charged} credits charged.` : `Started ${step}.` };
      }
      default:
        return { text: `Unknown tool ${name}.`, isError: true };
    }
  } catch (err) {
    ok = false;
    console.error("sandbox tool failed", name, err);
    return { text: "That step failed on the build machine. Tell the person and carry on without it.", isError: true };
  } finally {
    await audit(userId, run.id, name, command, started, exitCode, ok);
  }
}
