import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const cell = { padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--a-border, #3333)", fontSize: 13, verticalAlign: "top" } as const;

// Owner only: the 100 most recent renders and videos across all accounts, with status, error and held credits.
export default async function AdminJobsPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  const rows = await db.generation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, kind: true, model: true, provider: true, status: true, error: true, creditsHeld: true, durationSec: true, createdAt: true, finishedAt: true, userId: true },
  });
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Jobs</h1>
      <p className="app-muted" style={{ margin: "6px 0 14px" }}>
        Last {rows.length} renders: {Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(", ") || "none yet"}.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>{["When", "Kind", "Model", "Status", "Held", "Seconds", "Error", "Account"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td style={cell}>{r.kind}</td>
                <td style={cell}>{r.model ?? "-"}{r.provider ? ` (${r.provider})` : ""}</td>
                <td style={cell}>{r.status}</td>
                <td style={cell}>{r.creditsHeld ?? "-"}</td>
                <td style={cell}>{r.durationSec ?? "-"}</td>
                <td style={{ ...cell, maxWidth: 380, wordBreak: "break-word" }}>{r.error ?? ""}</td>
                <td style={cell}>{r.userId.slice(-8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
