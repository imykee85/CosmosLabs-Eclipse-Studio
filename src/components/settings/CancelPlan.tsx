"use client";

import { useEffect, useState } from "react";

// "Cancel plan" under the credit history: two taps, and the plan ends at the end of the period already paid for. Shown only while there is a plan to cancel.
export default function CancelPlan() {
  const [state, setState] = useState<{ cancellable: boolean; cancelling: boolean } | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/billing", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d?.plan) setState(d.plan); }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!state || (!state.cancellable && !state.cancelling)) return null;
  if (state.cancelling) return <p className="st-meta">Your plan is set to end at the end of the period you have already paid for. You keep it until then.</p>;

  const cancel = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Could not cancel your plan."); return; }
      setState({ cancellable: false, cancelling: true });
    } catch { setError("Could not cancel your plan. Try again in a moment."); } finally { setBusy(false); setAsk(false); }
  };

  return (
    <div className="st-cancel">
      {!ask ? (
        <button type="button" className="st-ghost" onClick={() => setAsk(true)}>Cancel plan</button>
      ) : (
        <>
          <p className="st-meta">Cancel your plan? You keep it until the end of the period you have already paid for, and no further payment is taken.</p>
          <div className="st-cancel-row">
            <button type="button" className="st-ghost st-danger" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Yes, cancel my plan"}</button>
            <button type="button" className="st-ghost" disabled={busy} onClick={() => setAsk(false)}>Keep my plan</button>
          </div>
        </>
      )}
      {error && <p className="st-meta" role="alert" style={{ color: "#e5484d" }}>{error}</p>}
    </div>
  );
}
