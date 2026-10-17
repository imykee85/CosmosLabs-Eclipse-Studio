import type { CoreTool } from "@prisma/client";
import { db } from "@/lib/db";
import { headObjectInfo } from "@/lib/storage";
import { TOOL_LIMITS, type ToolRunInput } from "@/lib/sandbox/kinds/core";

// Mini tools a person builds with Core. A tool declares the inputs it asks for in a small form description (input_schema): text, long text,
// numbers, a yes/no switch, a choice, or files. The run page draws that form; the server checks every value against it before a run.

export type ToolField =
  | { name: string; label: string; type: "text" | "textarea"; default?: string; required?: boolean; maxLength?: number }
  | { name: string; label: string; type: "number"; default?: number; min?: number; max?: number; required?: boolean }
  | { name: string; label: string; type: "boolean"; default?: boolean }
  | { name: string; label: string; type: "select"; options: string[]; default?: string; required?: boolean }
  | { name: string; label: string; type: "file"; accept?: string[]; multiple?: boolean; required?: boolean };
export type ToolSchema = { fields: ToolField[] };

const NAME = /^[a-z][a-z0-9_]{0,39}$/;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Checks the form description the agent wrote. Returns the cleaned form or the reason it was refused. */
export function cleanSchema(raw: unknown): ToolSchema | string {
  const fields = raw && typeof raw === "object" && Array.isArray((raw as { fields?: unknown }).fields) ? ((raw as { fields: unknown[] }).fields) : raw === undefined || raw === null ? [] : null;
  if (!fields) return 'input_schema must be { "fields": [...] }.';
  if (fields.length > 20) return "A tool can ask for at most 20 inputs.";
  const out: ToolField[] = [], seen = new Set<string>();
  for (const f of fields) {
    const o = (f ?? {}) as Record<string, unknown>;
    const name = s(o.name, 40), label = s(o.label, 80) || name, type = s(o.type, 10);
    if (!NAME.test(name) || seen.has(name)) return `Each input needs a unique name in lower case letters, digits and _ ("${name}").`;
    seen.add(name);
    const required = o.required === true;
    if (type === "text" || type === "textarea") out.push({ name, label, type, required, default: s(o.default, 2000) || undefined, maxLength: Math.min(Number(o.maxLength) || 2000, 20_000) });
    else if (type === "number") out.push({ name, label, type, required, default: Number.isFinite(Number(o.default)) ? Number(o.default) : undefined, min: Number.isFinite(Number(o.min)) ? Number(o.min) : undefined, max: Number.isFinite(Number(o.max)) ? Number(o.max) : undefined });
    else if (type === "boolean") out.push({ name, label, type, default: o.default === true });
    else if (type === "select") {
      const options = Array.isArray(o.options) ? o.options.map((x) => s(x, 80)).filter(Boolean).slice(0, 30) : [];
      if (!options.length) return `The choice "${name}" needs options.`;
      out.push({ name, label, type, options, required, default: options.includes(s(o.default, 80)) ? s(o.default, 80) : undefined });
    } else if (type === "file") {
      const accept = Array.isArray(o.accept) ? o.accept.map((x) => s(x, 12).toLowerCase()).filter((x) => /^\.[a-z0-9]{1,10}$/.test(x)).slice(0, 20) : undefined;
      out.push({ name, label, type, accept: accept?.length ? accept : undefined, multiple: o.multiple === true, required });
    } else return `Unknown input type "${type}" (text, textarea, number, boolean, select or file).`;
  }
  return { fields: out };
}

export const schemaOf = (t: Pick<CoreTool, "inputSchema">): ToolSchema => {
  const c = cleanSchema(t.inputSchema);
  return typeof c === "string" ? { fields: [] } : c;
};

export const toolKey = (userId: string, toolId: string, version: number, path: string) => `u/${userId}/tools/${toolId}/v${version}/${path}`;
/** Where the browser puts a run's input files (one-time signed upload, see /api/core/tools/input). */
export const toolInputPattern = (userId: string) => new RegExp(`^u/${userId.replace(/[^A-Za-z0-9_-]/g, "")}/tools/in/[A-Za-z0-9._-]{1,140}$`);

export type PublicTool = { id: string; name: string; description: string; kind: string; runtime: string | null; version: number; network: string; approved: boolean; fields: ToolField[]; updatedAt: string };
export const publicTool = (t: CoreTool): PublicTool => ({ id: t.id, name: t.name, description: t.description, kind: t.kind, runtime: t.runtime, version: t.version, network: t.network, approved: t.network !== "internet" || t.approvedNet === t.version, fields: schemaOf(t).fields, updatedAt: t.updatedAt.toISOString() });

export const ownTool = (userId: string, id: string) => db.coreTool.findFirst({ where: { id, userId, deletedAt: null } });

export class ToolRunError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

/** Checks a run request against the tool's own form and builds the job input. Files must be the person's own uploads for runs. */
export async function toolRunInput(userId: string, tool: CoreTool, jobId: string, body: { values?: unknown; files?: unknown }): Promise<ToolRunInput> {
  if (tool.kind !== "sandbox") throw new ToolRunError("This tool runs in your browser.");
  if (tool.network === "internet" && tool.approvedNet !== tool.version) throw new ToolRunError("Approve this tool's internet use first.", 409);
  const fields = schemaOf(tool).fields;
  const values = body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : {};
  const fileMap = body.files && typeof body.files === "object" ? (body.files as Record<string, unknown>) : {};
  const params: Record<string, unknown> = {};
  const inputFiles: ToolRunInput["inputFiles"] = [];
  const pattern = toolInputPattern(userId);
  let total = 0;
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "file") {
      const list = Array.isArray(fileMap[f.name]) ? (fileMap[f.name] as unknown[]) : [];
      if (f.required && !list.length) throw new ToolRunError(`${f.label} is needed.`);
      if (!f.multiple && list.length > 1) throw new ToolRunError(`${f.label} takes one file.`);
      const names: string[] = [];
      for (const item of list) {
        const o = (item ?? {}) as { key?: unknown; name?: unknown };
        const key = typeof o.key === "string" ? o.key : "";
        if (!pattern.test(key)) throw new ToolRunError("One of the files is not yours.", 403);
        const name = `${inputFiles.length + 1}-${(typeof o.name === "string" ? o.name : "file").replace(/[^A-Za-z0-9._ -]+/g, "_").slice(0, 90) || "file"}`;
        if (f.accept && !f.accept.some((ext) => name.toLowerCase().endsWith(ext))) throw new ToolRunError(`${f.label} accepts ${f.accept.join(", ")}.`);
        const head = await headObjectInfo(key);
        if (!head) throw new ToolRunError("One of the files did not finish uploading.");
        total += head.size;
        inputFiles.push({ name, key, bytes: head.size });
        names.push(`in/${name}`);
      }
      params[f.name] = f.multiple ? names : names[0] ?? null;
    } else if (f.type === "number") {
      const n = v === undefined || v === "" ? f.default : Number(v);
      if (n === undefined) { if (f.required) throw new ToolRunError(`${f.label} is needed.`); params[f.name] = null; continue; }
      if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) throw new ToolRunError(`${f.label} must be a number${f.min !== undefined ? ` from ${f.min}` : ""}${f.max !== undefined ? ` to ${f.max}` : ""}.`);
      params[f.name] = n;
    } else if (f.type === "boolean") params[f.name] = v === undefined ? f.default ?? false : v === true;
    else if (f.type === "select") {
      const c = typeof v === "string" && v ? v : f.default;
      if (!c) { if (f.required) throw new ToolRunError(`${f.label} is needed.`); params[f.name] = null; continue; }
      if (!f.options.includes(c)) throw new ToolRunError(`${f.label} must be one of the choices.`);
      params[f.name] = c;
    } else {
      const t = typeof v === "string" ? v : f.default ?? "";
      if (f.required && !t.trim()) throw new ToolRunError(`${f.label} is needed.`);
      if (t.length > (f.maxLength ?? 2000)) throw new ToolRunError(`${f.label} is too long.`);
      params[f.name] = t;
    }
  }
  if (inputFiles.length > TOOL_LIMITS.inFiles) throw new ToolRunError(`A run takes at most ${TOOL_LIMITS.inFiles} files.`);
  if (total > TOOL_LIMITS.inBytes) throw new ToolRunError("The files are larger than 200 MB together.");
  if (Buffer.byteLength(JSON.stringify(params)) > TOOL_LIMITS.paramsBytes) throw new ToolRunError("The inputs are too long.");
  const files = (Array.isArray(tool.files) ? tool.files : []) as { path: string; key: string; bytes: number }[];
  return { toolId: tool.id, version: tool.version, runtime: tool.runtime === "python" ? "python" : "node", entry: tool.entry, files, params, inputFiles, network: tool.network === "internet" ? "internet" : "none", outPrefix: `u/${userId}/tools/runs/${jobId}/` };
}

/** The rules a browser tool page runs under (served by /api/core/tools/<id>/frame). */
export function frameCsp(internet: boolean) {
  return [
    "sandbox allow-scripts allow-downloads allow-forms allow-modals",
    "default-src 'none'",
    "script-src 'unsafe-inline' blob:",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "media-src data: blob:",
    "font-src data:",
    "worker-src blob:",
    internet ? "connect-src https:" : "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}
