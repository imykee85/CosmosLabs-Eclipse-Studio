import { getAdmin } from "@/lib/admin";
import { fmtCredits } from "@/lib/credit-units";
import { plans } from "@/lib/plans";
import { allPriceRows, directRouteList, netPerCredit, YARDSTICK_SECONDS } from "@/lib/price-table";

export const dynamic = "force-dynamic";

const cell = { padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--a-border, #3333)", fontSize: 13, verticalAlign: "top", whiteSpace: "nowrap" } as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Owner only: every priced model and setting with the provider's list cost, the credits charged, and the gross margin if all of a plan's credits were used on that
// setting (after the payment fee). A check only: nothing is ever charged from these numbers beyond the registry's own prices. Rows marked "estimate" are not confirmed list prices.
export default async function AdminPricingPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  const rows = allPriceRows();
  const worst = Math.min(...rows.map((r) => Math.min(...Object.values(r.margin))));
  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Price check</h1>
      <p className="app-muted" style={{ margin: "6px 0 10px" }}>
        One credit is worth $0.10 and pays for $0.04 of provider cost. Images are priced per image, video for a {YARDSTICK_SECONDS} second clip (the price of any other length is rounded once, for the whole clip).
        The margins assume the plan&apos;s credits are all used on that one setting, after the payment fee (6.2% + $0.30):{" "}
        {plans.map((p) => `${p.name} earns $${netPerCredit(p).toFixed(4)} a credit`).join(", ")}. Lowest margin in the table: {pct(worst)}.
      </p>
      <p className="app-muted" style={{ margin: "0 0 14px" }}>
        Live prices from the provider are NOT shown: no price-estimate request is saved in docs/, so none is called. Rows marked &quot;estimate&quot; come from the owner&apos;s workbook as estimates. To check one, run a single render and compare the provider bill with the cost here.
      </p>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "10px 0" }}>Direct routes</h2>
      <table style={{ borderCollapse: "collapse", marginBottom: 18 }}>
        <thead><tr>{["Model", "Key", "Key set", "Setting", "In use"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{directRouteList().map((d) => <tr key={d.model}><td style={cell}>{d.model}</td><td style={cell}>{d.key}</td><td style={cell}>{d.set ? "yes" : "no"}</td><td style={cell}>{d.setting}</td><td style={cell}>{d.using}</td></tr>)}</tbody>
      </table>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["Kind", "Model", "Setting", "Provider cost", "Credits", ...plans.map((p) => `${p.name} margin`), "Notes"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const low = Math.min(...Object.values(r.margin));
              return (
                <tr key={`${r.model}-${r.setting}-${i}`} style={low < 0.4 ? { background: "rgba(229,72,77,.12)" } : undefined}>
                  <td style={cell}>{r.kind}</td>
                  <td style={cell}>{r.label}</td>
                  <td style={cell}>{r.setting}</td>
                  <td style={cell}>${r.usd.toFixed(4)}{r.estimate ? " (estimate)" : ""}</td>
                  <td style={cell}>{fmtCredits(r.credits * 10)}</td>
                  {plans.map((p) => <td key={p.id} style={cell}>{pct(r.margin[p.id])}</td>)}
                  <td style={cell}>{r.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
