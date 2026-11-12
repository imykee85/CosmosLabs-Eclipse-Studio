"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { asPlanId, clearPendingPlan, pendingPlan } from "@/lib/pending-plan";

// Opens the checkout of the plan picked on the homepage (?plan=, or the one kept through sign-up) with no extra click.
export default function StartPlan() {
  const [error, setError] = useState("");
  useEffect(() => {
    const id = asPlanId(new URLSearchParams(window.location.search).get("plan")) ?? pendingPlan();
    clearPendingPlan();
    if (!id) { window.location.replace("/settings?tab=billing"); return; }
    (async () => {
      try {
        const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: id }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data.url === "string") { window.location.replace(data.url); return; }
        setError(typeof data.error === "string" ? data.error : "Could not start the checkout.");
      } catch { setError("Could not reach the checkout. Try again."); }
    })();
  }, []);
  return (
    <div className="st-card" style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
      {error ? (<><p role="alert" style={{ color: "#e5484d" }}>{error}</p><p><Link href="/settings?tab=billing">Go to Billing</Link></p></>) : <p>Opening your checkout…</p>}
    </div>
  );
}
