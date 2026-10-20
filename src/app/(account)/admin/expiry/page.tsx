import { getAdmin } from "@/lib/admin";
import { fmtCredits } from "@/lib/credit-units";
import { expiryDryRun, expiryRules } from "@/lib/expiry";

export const dynamic = "force-dynamic";

const cell = { padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--a-border, #3333)", fontSize: 13 } as const;

// Owner only: what the credit-expiry rule would do if it started on a date. Reads the ledger, writes nothing. Open it with ?start=2026-11-20.
export default async function AdminExpiryPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  const q = await searchParams;
  const live = expiryRules().start;
  const asked = q.start ? Date.parse(q.start) : NaN;
  const start = Number.isFinite(asked) ? asked : live ?? Date.now() + 30 * 86400000;
  const run = await expiryDryRun(start);
  const date = (t: number) => new Date(t).toISOString().slice(0, 10);
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Credit expiry: dry run</h1>
      <p className="app-muted" style={{ margin: "6px 0 10px" }}>
        {live == null ? "The rule is OFF: CREDIT_EXPIRY_START is not set, so nothing expires." : `The rule is ON from ${date(live)}.`} This page only reads: it shows what would expire if the rule started on {date(run.start)} (change it with ?start=YYYY-MM-DD).
        Plan credits that existed before the start date get {expiryRules().graceDays} days of grace; top-ups bought before it last {expiryRules().topupDays} days from the start date; owner grants and refunds never expire.
      </p>
      <p className="app-muted" style={{ margin: "0 0 12px" }}>{run.accountsChecked} accounts with a purchase checked, {run.accountsWithCredits} hold credits.</p>
      <table style={{ borderCollapse: "collapse" }}>
        <thead><tr>{["By", "Accounts losing credits", "Credits removed (cumulative)"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{run.checkpoints.map((c) => <tr key={c.days}><td style={cell}>{date(run.start + c.days * 86400000)} (start + {c.days} days)</td><td style={cell}>{c.accounts}</td><td style={cell}>{fmtCredits(c.credits)}</td></tr>)}</tbody>
      </table>
    </main>
  );
}
