"use client";

import { useCallback, useEffect, useState } from "react";

// Owner only: the sandbox platform at a glance. This month's use against the plan's free allowance, how the base is set up, the two set-up jobs
// (build the base, smoke test it) and the latest jobs of every account with a Kill button. The page moves open jobs forward while it is open.
type Usage = { month: string; used: { activeCpuMs: number; gbHours: number; creations: number; networkBytes: number }; allowance: { activeCpuMs: number; gbHours: number; creations: number; networkBytes: number }; share: number; alertAt: number; blockAt: number };
type Setup = { provider: string | null; on: boolean; killSwitch: boolean; mux: boolean; snapshot: string | null; snapshotFromEnv: boolean; previousSnapshot: string | null; smokePassed: string | null; chrome: string | null; baseReport: string | null };
type Job = { id: string; kind: string; status: string; step: string | null; message: string | null; createdAt: string; user: string; sandbox: string | null; activeCpuMs: number | null; creditsCharged: number; output: Record<string, unknown> | null; error: { code: string; message: string; detail?: string } | null };

const cell = { padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--a-border, #3333)", fontSize: 13, verticalAlign: "top" } as const;
const btn = { height: 34, padding: "0 14px", border: "1px solid var(--a-line2, #555)", borderRadius: 10, background: "transparent", color: "inherit", font: "inherit", fontSize: 14, cursor: "pointer" } as const;
const pct = (a: number, b: number) => `${Math.round((a / b) * 1000) / 10}%`;
const OPEN = ["queued", "creating", "running", "collecting"];

export default function AdminSandbox() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    const [u, j] = await Promise.all([fetch("/api/admin/sandbox/usage", { cache: "no-store" }).then((r) => r.json()).catch(() => null), fetch("/api/admin/sandbox/jobs", { cache: "no-store" }).then((r) => r.json()).catch(() => null)]);
    if (u?.usage) { setUsage(u.usage); setSetup(u.setup); }
    if (Array.isArray(j?.jobs)) setJobs(j.jobs);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const anyOpen = jobs.some((j) => OPEN.includes(j.status));
  useEffect(() => { if (!anyOpen) return; const t = setInterval(() => void load(), 3000); return () => clearInterval(t); }, [anyOpen, load]);

  async function act(url: string, body?: unknown) {
    setNote("");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => null);
    if (!r.ok) setNote(d?.error ?? "That did not work.");
    void load();
  }

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sandbox</h1>
      {setup && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Set-up</h2>
          <p className="app-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Provider: {setup.provider ?? "not set (SANDBOX_PROVIDER)"}{setup.killSwitch ? " · KILL SWITCH ON" : ""} · Download video with sound: {setup.mux ? "on" : "off (SANDBOX_MUX)"}<br />
            Base snapshot: {setup.snapshot ?? "none yet: build the base"}{setup.snapshotFromEnv ? " (from SANDBOX_BASE_SNAPSHOT_ID)" : ""} · smoke passed on: {setup.smokePassed ?? "not yet"}{setup.previousSnapshot ? ` · previous kept: ${setup.previousSnapshot}` : ""}<br />
            Browser: {setup.chrome ?? "none"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={() => void act("/api/admin/sandbox/build-base")}>Build the base</button>
            <button type="button" style={btn} onClick={() => void act("/api/admin/sandbox/smoke")}>Run the smoke test</button>
            <button type="button" style={btn} onClick={() => void act("/api/admin/sandbox/jobs", { action: "sweep" })}>Sweep now</button>
          </div>
          {note && <p style={{ color: "#e5484d", fontSize: 14 }}>{note}</p>}
          {setup.baseReport && <details><summary style={{ cursor: "pointer", fontSize: 14 }}>Last base report</summary><pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(JSON.parse(setup.baseReport), null, 2)}</pre></details>}
        </section>
      )}
      {usage && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>This month ({usage.month}): {pct(usage.share, 1)} of the free allowance</h2>
          <p className="app-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Active CPU {(usage.used.activeCpuMs / 3_600_000).toFixed(2)} of {usage.allowance.activeCpuMs / 3_600_000} h ({pct(usage.used.activeCpuMs, usage.allowance.activeCpuMs)}) ·
            memory {usage.used.gbHours.toFixed(1)} of {usage.allowance.gbHours} GB-h ({pct(usage.used.gbHours, usage.allowance.gbHours)}) ·
            sandboxes {usage.used.creations} of {usage.allowance.creations} · transfer {(usage.used.networkBytes / 1e9).toFixed(2)} of {usage.allowance.networkBytes / 1e9} GB.
            Alert at {usage.alertAt * 100}%, new jobs stop at {usage.blockAt * 100}%.
          </p>
        </section>
      )}
      <section style={{ overflowX: "auto" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Latest jobs</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["When", "Kind", "Status", "Step", "CPU ms", "Charged", "Account", "Error or result", ""].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td style={cell}>{j.createdAt.replace("T", " ").slice(0, 16)}</td>
                <td style={cell}>{j.kind}</td>
                <td style={cell}>{j.status}{j.message && OPEN.includes(j.status) ? ` (${j.message})` : ""}</td>
                <td style={cell}>{j.step ?? ""}</td>
                <td style={cell}>{j.activeCpuMs ?? ""}</td>
                <td style={cell}>{j.creditsCharged || ""}</td>
                <td style={cell}>{j.user}</td>
                <td style={{ ...cell, maxWidth: 420, wordBreak: "break-word" }}>
                  {j.error ? <>{j.error.message}{j.error.detail && <pre style={{ margin: "4px 0 0", fontSize: 11, whiteSpace: "pre-wrap" }}>{j.error.detail}</pre>}</> : j.output ? <details><summary style={{ cursor: "pointer" }}>result</summary><pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(j.output, null, 2)}</pre></details> : ""}
                </td>
                <td style={cell}>{OPEN.includes(j.status) && <button type="button" style={btn} onClick={() => void act("/api/admin/sandbox/jobs", { action: "kill", id: j.id })}>Kill</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!jobs.length && <p className="app-muted">No sandbox jobs yet.</p>}
      </section>
    </main>
  );
}
