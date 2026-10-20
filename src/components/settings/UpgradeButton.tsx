"use client";

import { useState } from "react";

// Opens the payment provider's checkout for a plan. Until payments are set up the server answers with a plain reason, shown beside the button.
export default function UpgradeButton({ planId }: { planId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") { window.location.href = data.url; return; }
      setError(typeof data.error === "string" ? data.error : "Could not start the checkout.");
    } catch { setError("Could not reach the checkout. Try again."); }
    setBusy(false);
  }
  return (
    <>
      <button type="button" className="st-upgrade" onClick={go} disabled={busy}>Upgrade</button>
      {error && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{error}</p>}
    </>
  );
}
