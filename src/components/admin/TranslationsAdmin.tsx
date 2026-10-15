"use client";

import { useState } from "react";
import { LANGS } from "@/lib/i18n/languages";

// One row per language with how much of the interface is translated and a button that translates the rest in small batches.
const btn = { height: 36, padding: "0 16px", border: 0, borderRadius: 999, background: "#c00707", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer" } as const;

export default function TranslationsAdmin({ total, initial }: { total: number; initial: Record<string, number> }) {
  const [counts, setCounts] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(lang: string): Promise<boolean> {
    setBusy(lang); setMsg(null);
    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch("/api/admin/translations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) });
        const d = (await res.json()) as { added?: number; remaining?: number; error?: string };
        if (!res.ok) { setMsg(d.error ?? "Failed."); return false; }
        setCounts((c) => ({ ...c, [lang]: Math.min(total, (c[lang] ?? 0) + (d.added ?? 0)) }));
        if (!d.remaining) return true;
        if (!d.added) { setMsg("No progress: the translator did not answer. Check ANTHROPIC_API_KEY and its credit, then try again."); return false; }
      }
      return true;
    } catch {
      setMsg("Could not reach the server."); return false;
    } finally {
      setBusy(null);
    }
  }

  async function all() { for (const l of LANGS) if (l.code !== "en" && (counts[l.code] ?? 0) < total) if (!(await run(l.code))) break; }

  return (
    <div>
      <button type="button" disabled={!!busy} onClick={all} style={{ ...btn, marginBottom: 12, opacity: busy ? 0.6 : 1 }}>Translate every language</button>
      {msg && <p role="alert" style={{ color: "var(--a-redtext, #c00707)", margin: "0 0 10px", fontSize: 14 }}>{msg}</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {LANGS.filter((l) => l.code !== "en").map((l) => {
          const n = counts[l.code] ?? 0;
          return (
            <li key={l.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--a-line, #3333)" }}>
              <span style={{ flex: 1 }}>{l.name} <small className="app-muted">({l.native})</small></span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{n.toLocaleString("en-US")} / {total.toLocaleString("en-US")}</span>
              <button type="button" style={{ ...btn, opacity: busy || n >= total ? 0.5 : 1 }} disabled={!!busy || n >= total} onClick={() => run(l.code)}>{busy === l.code ? "Translating…" : n >= total ? "Done" : "Translate"}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
