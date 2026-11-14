import { requireAdminPage } from "@/lib/admin-gate";
import { userActivity } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const cell = { padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--a-border, #3333)", fontSize: 13, verticalAlign: "top", whiteSpace: "nowrap" } as const;
const fmt = (d: Date | string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : "-");

// Owner only: new sign-ups and what each account does, as counts only. No prompts, pictures, chats or project names are ever shown here.
export default async function AdminUsersPage() {
  const admin = await requireAdminPage();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  const { rows, accounts, newToday, newWeek } = await userActivity();
  const n = (o: { images: number; videos: number; audio: number; models3d: number; motions: number; chats: number }) => `${o.images} img · ${o.videos} vid · ${o.audio} aud · ${o.models3d} 3D · ${o.motions} mot · ${o.chats} chat`;
  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Users</h1>
      <p className="app-muted" style={{ margin: "6px 0 14px" }}>
        {accounts} accounts · {newToday} new in the last 24 hours · {newWeek} new in the last 7 days. Counts and times only: nothing anyone typed or made is shown here.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["Account", "Joined (UTC)", "Last active (UTC)", "Last 7 days", "Credits spent (7d)", "All time", "Credits spent (all)"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.label}</td>
                <td style={cell}>{fmt(r.joined)}</td>
                <td style={cell}>{fmt(r.lastActive)}</td>
                <td style={cell}>{n(r.week)}</td>
                <td style={cell}>{r.week.creditsSpent}</td>
                <td style={cell}>{n(r.total)}</td>
                <td style={cell}>{r.total.creditsSpent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="app-muted">No activity yet.</p>}
    </main>
  );
}
