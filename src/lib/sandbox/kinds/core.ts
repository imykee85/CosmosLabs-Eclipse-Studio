import { z } from "zod";
import type { SandboxJob } from "@prisma/client";
import { getObjectBytes, headObjectInfo, signedGetUrl, signedMediaUrl, signedPutUrl, storageHost } from "@/lib/storage";
import type { KindDef } from "./types";

// Core mini tools. core.tool.run runs one saved sandbox tool on the person's files: it fetches the tool's source and the input files while the
// sandbox may reach only storage, then switches the network OFF (or to the internet, only for a tool version the owner approved) before the
// tool starts, then lists what the tool wrote to out/, stops anything still running, and uploads the results through signed links.
// core.exec is a Core build session: one sandbox the Core agent uses while it builds or fixes a tool (no network unless it asks for the
// npm and PyPI registries), open for at most 30 minutes and charged per started 5 minutes.

const LINK_S = 30 * 60;
export const TOOL_LIMITS = { runSeconds: 240, outFiles: 20, outBytes: 500 * 1024 * 1024, inFiles: 20, inBytes: 200 * 1024 * 1024, sourceBytes: 512 * 1024, sourceFiles: 20, paramsBytes: 64 * 1024 };
export const REGISTRIES = ["registry.npmjs.org", "pypi.org", "files.pythonhosted.org"];
const num = (name: string, fallback: number) => (process.env[name] && Number(process.env[name]) >= 0 ? Math.floor(Number(process.env[name])) : fallback);
export const toolRunCredits = () => num("SANDBOX_CREDITS_TOOL_RUN", 5);
export const buildCreditsPer5 = () => num("SANDBOX_CREDITS_BUILD_5MIN", 10);

const SafePath = z.string().min(1).max(200).regex(/^[A-Za-z0-9._\-/]+$/).refine((p) => !p.startsWith("/") && !p.split("/").some((s) => s === ".." || s === ""), "bad path");
const StoredFile = z.object({ path: SafePath, key: z.string().min(1).max(300), bytes: z.number().int().min(0) }).strict();

export const ToolRunInput = z.object({
  toolId: z.string().max(60),
  version: z.number().int().min(1),
  runtime: z.enum(["node", "python"]),
  entry: SafePath,
  files: z.array(StoredFile).max(TOOL_LIMITS.sourceFiles),
  params: z.record(z.string(), z.unknown()),
  inputFiles: z.array(z.object({ name: z.string().min(1).max(100).regex(/^[A-Za-z0-9._ -]+$/), key: z.string().min(1).max(300), bytes: z.number().int().min(0) }).strict()).max(TOOL_LIMITS.inFiles),
  network: z.enum(["none", "internet"]),
  outPrefix: z.string().min(1).max(300),
}).strict();
export type ToolRunInput = z.infer<typeof ToolRunInput>;

const FETCH_SH = String.raw`#!/bin/bash
set -euo pipefail
mkdir -p in out
while [ "$#" -ge 2 ]; do curl -fsSL --max-time 300 "$2" -o "in/$1"; shift 2; done
`;
const UPLOAD_SH = String.raw`#!/bin/bash
set -euo pipefail
while [ "$#" -ge 2 ]; do curl -fsS --max-time 300 -X PUT -H "Content-Type: application/octet-stream" --upload-file "out/$1" "$2" -o /dev/null; shift 2; done
`;
// Lists out/ (files only, no links followed) and refuses more than the limits allow.
const LIST_MJS = String.raw`import { readdirSync, lstatSync, writeFileSync } from "node:fs";
const files = []; let total = 0;
const walk = (d, rel) => { for (const n of readdirSync(d)) { const p = d + "/" + n, r = rel ? rel + "/" + n : n, s = lstatSync(p); if (s.isDirectory()) walk(p, r); else if (s.isFile()) { files.push({ name: r, bytes: s.size }); total += s.size; } } };
try { walk("out", ""); } catch {}
const ok = files.length <= ${TOOL_LIMITS.outFiles} && total <= ${TOOL_LIMITS.outBytes} && files.every((f) => /^[A-Za-z0-9._\-/ ]{1,200}$/.test(f.name));
writeFileSync("out-manifest.json", JSON.stringify({ ok, files: ok ? files : [], total, count: files.length }));
if (!ok) { console.error("The tool wrote " + files.length + " files (" + total + " bytes); the limit is ${TOOL_LIMITS.outFiles} files and ${TOOL_LIMITS.outBytes} bytes, with plain file names."); process.exit(3); }
`;

const outKey = (input: ToolRunInput, name: string) => `${input.outPrefix}${name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
type Manifest = { ok: boolean; files: { name: string; bytes: number }[] };
const readManifest = async (ctx: Parameters<NonNullable<KindDef["stage"]>>[0]): Promise<Manifest> => {
  const b = await ctx.provider.readFile(ctx.name, "out-manifest.json", 256_000);
  try { return b ? (JSON.parse(b.toString("utf8")) as Manifest) : { ok: false, files: [] }; } catch { return { ok: false, files: [] }; }
};

export const toolRun: KindDef<ToolRunInput> = {
  kind: "core.tool.run",
  schema: ToolRunInput,
  vcpus: 2,
  deadlineMs: 4 * 60_000 + 60_000, // the tool itself gets 4 minutes; the extra minute covers fetching and uploading
  network: () => { const h = storageHost(); return h ? { kind: "allowlist", domains: [h] } : { kind: "none" }; },
  base: "snapshot",
  price: () => toolRunCredits(),
  stageCount: () => 4,
  stage: async (ctx, i, input) => {
    const host = storageHost();
    const storage = host ? { kind: "allowlist" as const, domains: [host] } : { kind: "none" as const };
    if (i === 0) {
      const files = await Promise.all(input.files.map(async (f) => ({ path: `tool/${f.path}`, content: Buffer.from(await getObjectBytes(f.key, TOOL_LIMITS.sourceBytes)) })));
      const params = Buffer.from(JSON.stringify({ ...input.params, inputFiles: input.inputFiles.map((f) => `in/${f.name}`) }));
      const args = ["fetch.sh"];
      for (const f of input.inputFiles) args.push(f.name, await signedGetUrl(f.key, LINK_S));
      return { name: "fetch", network: storage, files: [...files, { path: "params.json", content: params }, { path: "fetch.sh", content: Buffer.from(FETCH_SH), mode: 0o755 }], cmd: "bash", args, secretArgs: true };
    }
    if (i === 1) {
      // The network closes BEFORE the person's code starts; it opens to the internet only for a version the owner approved.
      const program = input.runtime === "python" ? "python3" : "node";
      return { name: "tool", network: input.network === "internet" ? { kind: "internet" } : { kind: "none" }, cmd: "timeout", args: ["-k", "5", String(TOOL_LIMITS.runSeconds), program, `tool/${input.entry}`, "params.json", "out/"] };
    }
    if (i === 2) return { name: "list", network: { kind: "none" }, files: [{ path: "list.mjs", content: Buffer.from(LIST_MJS) }], cmd: "node", args: ["list.mjs"] };
    const m = await readManifest(ctx);
    const args = ["upload.sh"];
    for (const f of m.files) args.push(f.name, await signedPutUrl(outKey(input, f.name), "application/octet-stream", LINK_S));
    // Anything the tool left running is stopped before storage becomes reachable again.
    return { name: "upload", before: { cmd: "sh", args: ["-c", "pkill -KILL -f 'tool/' || true"] }, network: storage, files: [{ path: "upload.sh", content: Buffer.from(UPLOAD_SH), mode: 0o755 }], cmd: "bash", args, secretArgs: true };
  },
  collect: async (ctx, input) => {
    const m = await readManifest(ctx);
    const files: { name: string; key: string; bytes: number }[] = [];
    for (const f of m.files) {
      const key = outKey(input, f.name), head = await headObjectInfo(key);
      if (head) files.push({ name: f.name, key, bytes: head.size });
    }
    const log = ctx.results[1]?.stdout ?? "";
    return { output: { files, log: log.slice(-4096) } };
  },
  failMessage: "The tool stopped with an error. Nothing was charged.",
  present: async (output) => {
    const files = Array.isArray(output.files) ? (output.files as { name: string; key: string; bytes: number }[]) : [];
    return { log: output.log ?? "", files: await Promise.all(files.map(async (f) => ({ name: f.name, bytes: f.bytes, url: await signedMediaUrl(f.key, { ttlSeconds: 3600, download: f.name.split("/").pop() ?? "file" }).catch(() => null) }))) };
  },
};

export const ExecInput = z.object({ chatId: z.string().max(60).nullable() }).strict();
export type ExecInput = z.infer<typeof ExecInput>;
export const SESSION_MINUTES = 30;

const minutesOf = (job: SandboxJob) => Math.max(1, Math.ceil(((job.finishedAt ?? new Date()).getTime() - (job.startedAt ?? job.createdAt).getTime()) / 60_000));

export const coreExec: KindDef<ExecInput> = {
  kind: "core.exec",
  schema: ExecInput,
  vcpus: 2,
  deadlineMs: SESSION_MINUTES * 60_000,
  network: () => ({ kind: "none" }),
  base: "snapshot",
  price: () => buildCreditsPer5() * Math.ceil(SESSION_MINUTES / 5), // the most a session can cost is held; it is charged for what it used
  session: true,
  sessionCharge: (job) => buildCreditsPer5() * Math.ceil(minutesOf(job) / 5),
  failMessage: "The build session ended with an error. Nothing was charged.",
};
