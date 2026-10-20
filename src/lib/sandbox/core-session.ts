import type { SandboxJob } from "@prisma/client";
import { db } from "@/lib/db";
import { putObject, storageEnabled } from "@/lib/storage";
import { sandboxProvider } from "./index";
import { REGISTRIES, SESSION_MINUTES, TOOL_LIMITS, buildCreditsPer5 } from "./kinds/core";
import { WORK } from "./kinds/types";
import { advance, drive, endSession, enqueue } from "./runner";
import { tail } from "./provider";
import { cleanSchema, toolKey } from "@/lib/core-tools";

import { fmtCredits } from "@/lib/credit-units";
// Core's build machine, as the assistant's tools. A session is a core.exec sandbox job: the first tool that needs it starts one (after the
// person's plan and price checks), and every tool finds it through the person's own open session, never through an id the model gives.
// The session is the person's own isolated computer, so a shell command line is allowed here (and only here). What comes back from it is
// labelled as data for the model: it can never change Core's rules.

export type SessionOutcome = { text: string; isError?: boolean; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } };
export const SESSION_TOOL_NAMES = ["sandbox_exec", "sandbox_command_status", "sandbox_write_file", "sandbox_read_file", "sandbox_list_files", "view_image", "sandbox_packages", "sandbox_stop", "save_tool"] as const;

// Core's chat turn has a time budget (it stops starting new steps after 48 s), so a command is waited on for at most 20 s here; a longer one
// keeps running and is checked again with sandbox_command_status.
const MAX_WRITE = 2_000_000, MAX_READ = 256 * 1024, MAX_IMAGE = 2 * 1024 * 1024, MAX_WAIT_S = 20;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const asData = (s: string) => `<sandbox_output>\n${s}\n</sandbox_output>`;

/** A path inside the sandbox's working folder, given relative or absolute. Null for anything that leaves it. */
export function sessionPath(p: string): string | null {
  const rel = p.trim().replace(/^\/vercel\/sandbox\/?/, "").replace(/^\.\//, "");
  if (!rel || rel.startsWith("/") || rel.includes("\\") || rel.includes("\0") || rel.split("/").some((s) => s === "..")) return null;
  return rel;
}

function sniffImage(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

const openSession = (userId: string) => db.sandboxJob.findFirst({ where: { userId, kind: "core.exec", status: "running", step: "session" }, orderBy: { createdAt: "desc" } });

async function audit(job: SandboxJob, tool: string, command: string | null, ok: boolean, exitCode: number | null, started: number) {
  await db.sandboxAudit.create({ data: { userId: job.userId, jobId: job.id, tool, command: command?.slice(0, 500) ?? null, durationMs: Date.now() - started, exitCode, ok } }).catch((e) => console.error("sandbox audit failed", e));
}

/** The person's open build session, starting one when there is none. */
async function sessionFor(userId: string, chatId: string | null): Promise<{ job: SandboxJob } | { error: string }> {
  const open = await openSession(userId);
  if (open) {
    if (Date.now() > open.deadlineAt.getTime()) { await advance(open.id); return { error: `The build session reached its ${SESSION_MINUTES}-minute limit and was closed. Start again if more work is needed.` }; }
    return { job: open };
  }
  const q = await enqueue("core.exec", userId, { chatId });
  if (!q.ok) return { error: q.error };
  const job = await drive(q.job.id, 25_000, 800);
  if (job?.step === "session") return { job };
  const err = (job?.error as { message?: string } | null)?.message;
  return { error: err ?? "The build machine is still starting. Try the step again in a moment." };
}

export async function runSessionTool(name: string, args: Record<string, unknown>, userId: string, chatId: string | null): Promise<SessionOutcome> {
  const provider = sandboxProvider();
  if (!provider) return { text: "The build machine is not switched on yet. Tell the person it is coming and help another way.", isError: true };
  if (name === "save_tool" && args.kind === "browser") return saveBrowserTool(args, userId);
  if (name === "sandbox_stop") {
    const open = await openSession(userId);
    if (!open) return { text: "There is no build session open." };
    const ended = await endSession(open.id);
    return { text: `The build session was closed after ${(ended?.output as { minutes?: number } | null)?.minutes ?? "?"} minutes.${ended?.creditsCharged ? ` ${fmtCredits(ended.creditsCharged)} credits were charged.` : ""}` };
  }
  const s = await sessionFor(userId, chatId);
  if ("error" in s) return { text: s.error, isError: true };
  const job = s.job, box = job.sandboxName!;
  const started = Date.now();
  let command: string | null = null, ok = true, exitCode: number | null = null;
  try {
    switch (name) {
      case "sandbox_exec": {
        command = str(args.command, 4000);
        if (!command) { ok = false; return { text: "Give a command.", isError: true }; }
        const asked = str(args.cwd, 200);
        const cwd = asked && /^[A-Za-z0-9._\-/]+$/.test(asked) ? sessionPath(asked) ?? "." : ".";
        const { cmdId } = await provider.start(box, "bash", ["-lc", cwd === "." ? command : `cd ${JSON.stringify(cwd)} && ${command}`]);
        const until = Date.now() + Math.min(Math.max(Number(args.wait_seconds) || MAX_WAIT_S, 1), MAX_WAIT_S) * 1000;
        while (Date.now() < until) {
          const st = await provider.status(box, cmdId);
          if (st.done) { exitCode = st.exitCode; ok = st.exitCode === 0; return { text: asData(JSON.stringify({ exit_code: st.exitCode, stdout: tail(st.stdoutTail, 20_000), stderr: tail(st.stderrTail, 10_000) })) }; }
          await new Promise((r) => setTimeout(r, 1000));
        }
        return { text: JSON.stringify({ still_running: true, command_id: cmdId, note: "Check it with sandbox_command_status." }) };
      }
      case "sandbox_command_status": {
        const id = str(args.command_id, 80); command = id;
        const until = Date.now() + Math.min(Math.max(Number(args.wait_seconds) || 15, 0), MAX_WAIT_S) * 1000;
        for (;;) {
          const st = await provider.status(box, id);
          if (st.done) { exitCode = st.exitCode; ok = st.exitCode === 0; return { text: asData(JSON.stringify({ exit_code: st.exitCode, stdout: tail(st.stdoutTail, 20_000), stderr: tail(st.stderrTail, 10_000) })) }; }
          if (Date.now() >= until) return { text: JSON.stringify({ still_running: true, command_id: id }) };
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      case "sandbox_write_file": {
        const p = sessionPath(str(args.path, 300)), content = typeof args.content === "string" ? args.content : ""; command = p;
        if (!p) { ok = false; return { text: `The path must be inside ${WORK}.`, isError: true }; }
        if (content.length > MAX_WRITE) { ok = false; return { text: "That file is too large; write it in parts.", isError: true }; }
        await provider.writeFiles(box, [{ path: p, content: Buffer.from(content) }]);
        return { text: `Wrote ${content.length} characters to ${p}.` };
      }
      case "sandbox_read_file": {
        const p = sessionPath(str(args.path, 300)); command = p;
        if (!p) { ok = false; return { text: `The path must be inside ${WORK}.`, isError: true }; }
        const b = await provider.readFile(box, p, MAX_READ).catch(() => undefined);
        if (b === undefined) { ok = false; return { text: "That file is larger than 256 KB; look at part of it with sandbox_exec.", isError: true }; }
        if (b === null) { ok = false; return { text: "There is no such file.", isError: true }; }
        return { text: asData(b.toString("utf8")) };
      }
      case "sandbox_list_files": {
        const p = sessionPath(str(args.path, 300) || ".") ?? "."; command = p;
        const r = await provider.run(box, "find", [p, "-maxdepth", "4", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*", "-type", "f", "-printf", "%P\t%s\n"], { timeoutMs: 20_000 });
        const files = r.stdout.split("\n").filter(Boolean).slice(0, 300).map((l) => { const [path, size] = l.split("\t"); return { path, size: Number(size) }; });
        return { text: asData(JSON.stringify({ files })) };
      }
      case "view_image": {
        const p = sessionPath(str(args.path, 300)); command = p;
        if (!p) { ok = false; return { text: `The path must be inside ${WORK}.`, isError: true }; }
        const b = await provider.readFile(box, p, MAX_IMAGE).catch(() => null);
        const type = b ? sniffImage(b) : null;
        if (!b || !type) { ok = false; return { text: "That is not a PNG, JPEG or WebP picture under 2 MB.", isError: true }; }
        return { text: `Picture ${p}`, image: { mediaType: type, data: b.toString("base64") } };
      }
      case "sandbox_packages": {
        const on = args.on === true; command = on ? "packages on" : "packages off";
        await provider.setNetwork(box, on ? { kind: "allowlist", domains: REGISTRIES } : { kind: "none" });
        return { text: on ? `The build machine can now reach ${REGISTRIES.join(", ")} only. Switch it off again when the installs are done.` : "The build machine has no network again." };
      }
      case "save_tool": {
        command = str(args.name, 80);
        return await saveSandboxTool(args, userId, job);
      }
      default:
        return { text: `Unknown tool ${name}.`, isError: true };
    }
  } catch (err) {
    ok = false;
    console.error("core session tool failed", name, err);
    return { text: "That step failed on the build machine. Tell the person and carry on without it.", isError: true };
  } finally {
    await audit(job, name, command, ok, exitCode, started);
  }
}

type ToolArgs = { name: string; description: string; runtime?: string; entry: string; network: "none" | "internet"; inputSchema: unknown; toolId: string | null };
function toolArgs(args: Record<string, unknown>): ToolArgs | string {
  const name = str(args.name, 80).trim(), description = str(args.description, 400).trim(), entry = str(args.entry, 200).trim();
  if (!name || !description || !entry) return "A tool needs a name, a description and an entry file.";
  const schema = cleanSchema(args.input_schema);
  if (typeof schema === "string") return schema;
  return { name, description, entry, runtime: str(args.runtime, 10), network: args.network === "internet" ? "internet" : "none", inputSchema: schema, toolId: str(args.tool_id, 60) || null };
}

/** Saves a new tool, or a new version of the person's own tool when tool_id is given. The internet approval never carries over to a new version. */
async function upsertTool(userId: string, a: ToolArgs, kind: "browser" | "sandbox", files: { path: string; content: Buffer }[]) {
  const existing = a.toolId ? await db.coreTool.findFirst({ where: { id: a.toolId, userId, deletedAt: null } }) : null;
  if (a.toolId && !existing) return { error: "That tool was not found." };
  const count = existing ? 0 : await db.coreTool.count({ where: { userId, deletedAt: null } });
  if (count >= 50) return { error: "A person can keep 50 tools. Delete one first." };
  const row = existing ?? await db.coreTool.create({ data: { userId, name: a.name, description: a.description, kind, runtime: kind === "sandbox" ? a.runtime : null, entry: a.entry, files: [], inputSchema: a.inputSchema as object, network: a.network } });
  const version = existing ? existing.version + 1 : 1;
  const stored = [];
  for (const f of files) {
    const key = toolKey(userId, row.id, version, f.path);
    await putObject(key, f.content, f.path.endsWith(".html") ? "text/html" : "text/plain");
    stored.push({ path: f.path, key, bytes: f.content.length });
  }
  const tool = await db.coreTool.update({ where: { id: row.id }, data: { name: a.name, description: a.description, kind, runtime: kind === "sandbox" ? a.runtime : null, entry: a.entry, files: stored, inputSchema: a.inputSchema as object, network: a.network, version, approvedNet: null } });
  return { tool };
}

async function saveBrowserTool(args: Record<string, unknown>, userId: string): Promise<SessionOutcome> {
  if (!storageEnabled) return { text: "Saving tools needs storage, which is not set up.", isError: true };
  const a = toolArgs({ ...args, entry: "index.html" });
  if (typeof a === "string") return { text: a, isError: true };
  const html = typeof args.html === "string" ? args.html : "";
  if (!html.trim()) return { text: "A browser tool needs its whole page in html (one self-contained file).", isError: true };
  if (Buffer.byteLength(html) > TOOL_LIMITS.sourceBytes) return { text: "That page is larger than 512 KB.", isError: true };
  const r = await upsertTool(userId, a, "browser", [{ path: "index.html", content: Buffer.from(html) }]);
  if ("error" in r) return { text: r.error!, isError: true };
  return { text: `Saved the browser tool "${r.tool!.name}" (version ${r.tool!.version}). The person opens it from Core > Tools > My tools.` };
}

async function saveSandboxTool(args: Record<string, unknown>, userId: string, job: SandboxJob): Promise<SessionOutcome> {
  if (!storageEnabled) return { text: "Saving tools needs storage, which is not set up.", isError: true };
  const a = toolArgs(args);
  if (typeof a === "string") return { text: a, isError: true };
  if (a.runtime !== "node" && a.runtime !== "python") return { text: "A sandbox tool's runtime is node or python.", isError: true };
  const paths = Array.isArray(args.files) ? (args.files as unknown[]).map((p) => sessionPath(String(p))).filter((p): p is string => Boolean(p)) : [];
  if (!paths.length || paths.length > TOOL_LIMITS.sourceFiles) return { text: `List the tool's source files (1 to ${TOOL_LIMITS.sourceFiles}) in files.`, isError: true };
  if (!paths.includes(a.entry)) return { text: "The entry file must be one of the files.", isError: true };
  const provider = sandboxProvider()!;
  const files: { path: string; content: Buffer }[] = [];
  let total = 0;
  for (const p of paths) {
    const b = await provider.readFile(job.sandboxName!, p, TOOL_LIMITS.sourceBytes).catch(() => null);
    if (!b) return { text: `Could not read ${p} (missing, or larger than 512 KB).`, isError: true };
    total += b.length;
    if (total > TOOL_LIMITS.sourceBytes) return { text: "The tool's source files are larger than 512 KB together.", isError: true };
    files.push({ path: p, content: b });
  }
  const r = await upsertTool(userId, a, "sandbox", files);
  if ("error" in r) return { text: r.error!, isError: true };
  const t = r.tool!;
  return { text: `Saved the tool "${t.name}" (version ${t.version}, ${t.runtime}). The person runs it from Core > Tools > My tools.${t.network === "internet" ? " It asks for the internet, so the person approves that on its first run." : ""}` };
}

export const sessionCost = () => ({ per5: buildCreditsPer5(), minutes: SESSION_MINUTES });
