import { requireAdminPage, adminPasswordSet } from "@/lib/admin-gate";
import { hubStats, setupChecklist } from "@/lib/admin-hub";

export const dynamic = "force-dynamic";

const TOOLS = [
  { href: "/admin/users", name: "Users", line: "New sign-ups and what each account does. Counts only." },
  { href: "/admin/credits", name: "Credits and plans", line: "Add credits to an account and give an account a plan." },
  { href: "/admin/health", name: "Health check", line: "Database, settings, payment events, failures, security policy." },
  { href: "/admin/jobs", name: "Jobs", line: "Recent renders and videos with status and errors." },
  { href: "/admin/pricing", name: "Price check", line: "What every image, video and audio model earns after fees." },
  { href: "/admin/expiry", name: "Credit expiry", line: "Dry run of which credits would expire and when." },
  { href: "/admin/translations", name: "Translations", line: "Translate the interface for each language." },
  { href: "/admin/sandbox", name: "Sandbox", line: "Build the base, run the smoke test, see usage and kill jobs." },
];

// Owner only (signed in with an ADMIN_EMAILS account AND the admin password): the front door to every owner tool.
export default async function AdminHome() {
  const admin = await requireAdminPage();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  const [s, setup] = [await hubStats(), setupChecklist()];
  const n = (v: number | null) => (v === null ? "-" : String(v));
  return (
    <main className="ad-hub">
      <h1>Admin</h1>
      {!adminPasswordSet() && <p className="ad-banner">No admin password is set yet, so this area is open to your owner account without one. Save <b>ADMIN_PASSWORD</b> in Vercel as a Secret (8 characters or more) and redeploy to lock it.</p>}
      <section aria-label="Right now">
        <h2>Last 24 hours</h2>
        <div className="ad-stats">
          <div className="ad-stat"><b>{n(s.accounts)}</b><span>accounts in total</span></div>
          <div className="ad-stat"><b>{n(s.newToday)}</b><span>new sign-ups today</span></div>
          <div className="ad-stat"><b>{n(s.newWeek)}</b><span>new sign-ups this week</span></div>
          <div className="ad-stat"><b>{s.images}</b><span>images made</span></div>
          <div className="ad-stat"><b>{s.videos}</b><span>videos made</span></div>
          <div className="ad-stat"><b>{s.audio}</b><span>audio takes</span></div>
          <div className="ad-stat"><b>{s.models3d}</b><span>3D models</span></div>
          <div className={`ad-stat${s.failed > 0 ? " is-warn" : ""}`}><b>{s.failed}</b><span>failed renders</span></div>
          <div className="ad-stat"><b>{s.running}</b><span>running now</span></div>
        </div>
      </section>
      <section aria-label="Tools">
        <h2>Tools</h2>
        <div className="ad-tools">{TOOLS.map((t) => <a key={t.href} className="ad-tool" href={t.href}><b>{t.name}</b><span>{t.line}</span></a>)}</div>
      </section>
      <section aria-label="Setup">
        <h2>Your setup</h2>
        <div className="ad-setup">{setup.map((c) => <div key={c.name} title={c.note}><span>{c.name}</span><span className={c.ok ? "ok" : "no"}>{c.ok ? "Set" : "Not set"}</span></div>)}</div>
      </section>
    </main>
  );
}
