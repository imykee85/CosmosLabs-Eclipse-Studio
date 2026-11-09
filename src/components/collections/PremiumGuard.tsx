import Link from "next/link";
import { Crown } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { accessFor, gatingOn } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";
import { planAllows, plansFor } from "@/lib/access-table";

// The crowned collections and Motion graphics are for Growth and Scale (owner 2026-11-05, repeated 2026-11-09). The dashboard card click opens an upgrade pop-up, but
// the page itself must refuse too: anyone can type the address. Checked on the server, so nothing from the page is sent to someone on another plan.
export default async function PremiumGuard({ children }: { children: React.ReactNode }) {
  if (clerkEnabled && gatingOn()) {
    const w = await workspaceSession();
    const plan = w.workspaceId ? (await accessFor(w.workspaceId, w.personId)).plan : null;
    if (!plan || !planAllows(plan, "premium")) {
      return (
        <main style={{ maxWidth: 460, margin: "0 auto", padding: "96px 24px", textAlign: "center", color: "var(--a-fg)", display: "grid", gap: 16, justifyItems: "center" }}>
          <Crown size={36} aria-hidden="true" style={{ color: "#c00707" }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Premium collections</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "var(--a-muted, var(--a-fg))" }}>This is included in {plansFor("premium")}. Upgrade to open it.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/settings?tab=billing" style={{ background: "#c00707", color: "#fff", borderRadius: 14, padding: "14px 22px", fontWeight: 600, fontSize: 16, textDecoration: "none" }}>See plans</Link>
            <Link href="/dashboard" style={{ border: "1px solid var(--a-line2)", color: "var(--a-fg)", borderRadius: 14, padding: "14px 22px", fontWeight: 500, fontSize: 16, textDecoration: "none" }}>Back to dashboard</Link>
          </div>
        </main>
      );
    }
  }
  return <>{children}</>;
}
