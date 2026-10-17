"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Globe, Loader2, Play, Trash2, Upload, X } from "lucide-react";
import { cancelSandboxJob, followSandboxJob, startSandboxJob, type SandboxJobView } from "@/lib/sandbox-client";
import "@/components/connect/connect.css";
import "@/components/skills/skills.css";
import "./tools.css";

// One of the person's own mini tools. A browser tool runs right here in a locked-down frame (no access to Eclipse, no network unless approved).
// A sandbox tool shows the form it declared; Run uploads the files straight to storage and runs it on a cloud computer, then lists the results.
type Field =
  | { name: string; label: string; type: "text" | "textarea"; default?: string; required?: boolean }
  | { name: string; label: string; type: "number"; default?: number; min?: number; max?: number; required?: boolean }
  | { name: string; label: string; type: "boolean"; default?: boolean }
  | { name: string; label: string; type: "select"; options: string[]; default?: string; required?: boolean }
  | { name: string; label: string; type: "file"; accept?: string[]; multiple?: boolean; required?: boolean };
type Tool = { id: string; name: string; description: string; kind: string; runtime: string | null; version: number; network: string; approved: boolean; fields: Field[] };
type Picked = { key: string; name: string };
const FRAME_SANDBOX = "allow-scripts allow-downloads allow-forms allow-modals";

async function uploadFile(f: File, onProgress: (p: number) => void): Promise<Picked | string> {
  const r = await fetch("/api/core/tools/input", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, size: f.size }) }).catch(() => null);
  const d = await r?.json().catch(() => null);
  if (!r?.ok || !d?.url) return d?.error ?? "The file could not be uploaded.";
  return new Promise((ok) => {
    const x = new XMLHttpRequest();
    x.open("PUT", d.url);
    x.setRequestHeader("Content-Type", "application/octet-stream");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => ok(x.status >= 200 && x.status < 300 ? { key: d.key, name: f.name } : "The file could not be uploaded.");
    x.onerror = () => ok("The file could not be uploaded. Check your connection.");
    x.send(f);
  });
}

const sizeText = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export default function MiniToolView({ id }: { id: string }) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, Picked[]>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const [job, setJob] = useState<SandboxJobView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const follow = useRef<AbortController | null>(null);
  useEffect(() => () => follow.current?.abort(), []);

  useEffect(() => {
    let live = true;
    fetch(`/api/core/tools/${id}`).then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!live) return;
      if (!r.ok || !d?.tool) return setTool(null);
      setTool(d.tool);
      const v: Record<string, unknown> = {};
      for (const f of d.tool.fields as Field[]) if (f.type !== "file" && f.default !== undefined) v[f.name] = f.default;
      setValues(v);
    }).catch(() => live && setTool(null));
    return () => { live = false; };
  }, [id]);

  async function approve(on: boolean) {
    const r = await fetch(`/api/core/tools/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: on ? "approve-internet" : "revoke-internet" }) });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.tool) setTool(d.tool);
  }
  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    const r = await fetch(`/api/core/tools/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/tools");
  }
  async function pick(f: Field, list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const out: Picked[] = f.type === "file" && f.multiple ? [...(files[f.name] ?? [])] : [];
    for (const file of Array.from(list)) {
      setUploading(0);
      const r = await uploadFile(file, (p) => setUploading(p));
      if (typeof r === "string") { setError(r); break; }
      out.push(r);
    }
    setUploading(null);
    setFiles((m) => ({ ...m, [f.name]: out }));
  }
  async function run() {
    if (!tool) return;
    setError(""); setBusy(true); setJob(null);
    const r = await startSandboxJob("core.tool.run", { toolId: tool.id, values, files });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    setJob(r.job);
    follow.current?.abort();
    const ctl = (follow.current = new AbortController());
    const end = await followSandboxJob(r.job.id, (j) => setJob(j), ctl.signal);
    if (ctl.signal.aborted) return;
    setBusy(false);
    if (end && end.status !== "succeeded") setError(end.error?.message ?? "The tool did not finish.");
  }
  async function stop() {
    follow.current?.abort();
    if (job) { const j = await cancelSandboxJob(job.id); if (j) setJob(j); }
    setBusy(false);
  }

  if (tool === undefined) return <div className="cn-wrap tl-wrap"><p className="cn-none"><Loader2 size={18} className="mt-spin" /> Loading</p></div>;
  if (tool === null) return <div className="cn-wrap tl-wrap"><p className="cn-none">That tool was not found.</p><Link href="/tools" className="tl-open mt-link">Back to Tools</Link></div>;
  const needsApproval = tool.network === "internet" && !tool.approved;
  const result = job?.status === "succeeded" ? (job.output as { files?: { name: string; bytes: number; url: string | null }[]; log?: string } | null) : null;

  return (
    <div className="cn-wrap tl-wrap mt-wrap">
      <header className="cn-head">
        <Link href="/tools" className="cn-back" aria-label="Back to Tools"><ChevronLeft size={22} /></Link>
        <div>
          <h1 className="pg-title mt-title">{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
        <button type="button" className={`mt-del ${confirmDelete ? "is-armed" : ""}`} onClick={() => void remove()} onBlur={() => setConfirmDelete(false)} aria-label={confirmDelete ? "Tap again to delete" : "Delete tool"}>
          <Trash2 size={16} /> {confirmDelete ? "Delete?" : null}
        </button>
      </header>

      {needsApproval ? (
        <section className="mt-card">
          <h2><Globe size={18} /> This tool asks to use the internet</h2>
          <p>It runs with no network unless you allow it. Allowing it covers this version only.</p>
          <div className="mt-row">
            <button type="button" className="tl-open" onClick={() => void approve(true)}>Allow</button>
            <Link className="mt-ghost" href="/tools">Not now</Link>
          </div>
        </section>
      ) : tool.kind === "browser" ? (
        <iframe className="mt-frame" title={tool.name} src={`/api/core/tools/${tool.id}/frame`} sandbox={FRAME_SANDBOX} referrerPolicy="no-referrer" />
      ) : (
        <form className="mt-card mt-form" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          {tool.fields.map((f) => (
            <label key={f.name} className="mt-field">
              <span>{f.label}{"required" in f && f.required ? " *" : ""}</span>
              {f.type === "textarea" ? <textarea rows={4} value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                : f.type === "text" ? <input value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                : f.type === "number" ? <input type="number" min={f.min} max={f.max} value={values[f.name] === undefined ? "" : String(values[f.name])} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                : f.type === "boolean" ? <input type="checkbox" checked={values[f.name] === true} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} />
                : f.type === "select" ? <select value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}><option value="">Choose</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : f.type === "file" ? (
                  <span className="mt-files">
                    <span className="mt-pick"><Upload size={15} /> {files[f.name]?.length ? `${files[f.name].length} file${files[f.name].length > 1 ? "s" : ""}` : "Choose files"}
                      <input type="file" multiple={f.multiple} accept={f.accept?.join(",")} onChange={(e) => void pick(f, e.target.files)} />
                    </span>
                    {files[f.name]?.map((p) => <small key={p.key}>{p.name}</small>)}
                  </span>
                ) : null}
            </label>
          ))}
          <div className="mt-row">
            <button type="submit" className="tl-open mt-run" disabled={busy || uploading !== null}>
              {busy ? <Loader2 size={16} className="mt-spin" /> : <Play size={16} />} {busy ? job?.message ?? "Working" : uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : "Run"}
            </button>
            {busy && job && <button type="button" className="mt-ghost" onClick={() => void stop()}><X size={15} /> Cancel</button>}
            {tool.network === "internet" && <button type="button" className="mt-ghost" onClick={() => void approve(false)}><Globe size={15} /> Internet allowed</button>}
          </div>
          {error && <p className="mt-err" role="alert">{error}</p>}
          {result && (
            <div className="mt-out">
              {result.files?.length ? (
                <ul>{result.files.map((f) => <li key={f.name}><span>{f.name} <small>{sizeText(f.bytes)}</small></span>{f.url && <a className="mt-ghost" href={f.url} download={f.name}><Download size={15} /> Download</a>}</li>)}</ul>
              ) : <p className="cn-none">The tool finished without writing any files.</p>}
              {result.log && <pre className="mt-log">{result.log}</pre>}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
