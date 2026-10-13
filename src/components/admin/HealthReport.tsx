"use client";
import { useCallback, useEffect, useState } from "react";

// Owner page body: runs the checks when it opens and offers one button to copy the whole report.
export default function HealthReport() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setLines(null);
    setError("");
    try {
      const res = await fetch("/api/admin/health", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "The check failed.");
      setLines(body.lines as string[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check failed.");
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText((lines ?? []).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the report is also on screen to screenshot */ }
  };

  return (
    <main style={{ padding: 16, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Health check</h1>
      <p className="app-muted" style={{ margin: "6px 0 14px" }}>Tap Copy report and paste it to Claude. It holds no keys or secrets.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={copy} disabled={!lines} style={{ padding: "10px 16px", borderRadius: 10, background: "#c00707", color: "#fff", fontWeight: 500 }}>{copied ? "Copied" : "Copy report"}</button>
        <button type="button" onClick={run} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--a-border, #3335)", fontWeight: 500 }}>Run again</button>
      </div>
      {error && <p style={{ color: "#d90b0b" }}>{error}</p>}
      {!lines && !error && <p className="app-muted">Checking...</p>}
      {lines && (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.6 }}>{lines.join("\n")}</pre>
      )}
    </main>
  );
}
