"use client";

import { useState } from "react";

// The question the person answers when an outside app asks to connect: what it can do, where the answer goes, Allow or Cancel. The answer is sent as a plain request
// (not a form), then the browser is taken to the address the app gave.
export default function Consent({ clientName, returnHost, params }: { clientName: string; returnHost: string; params: Record<string, string> }) {
  const [busy, setBusy] = useState<"" | "allow" | "deny">("");
  const [error, setError] = useState("");

  async function answer(decision: "allow" | "deny") {
    setBusy(decision); setError("");
    try {
      const res = await fetch("/api/oauth/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...params, decision }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d.redirect === "string") { window.location.href = d.redirect; return; }
      setError(typeof d.error === "string" ? d.error : "Something went wrong. Please try again.");
    } catch { setError("Could not reach Eclipse. Check your connection and try again."); }
    setBusy("");
  }

  return (
    <main className="oa-page">
      <div className="oa-card">
        <h1>Connect {clientName} to Eclipse?</h1>
        <p>{clientName} is asking to use your Eclipse account. It will return to <b>{returnHost}</b> after you choose.</p>
        <ul>
          <li>Make images and videos, which use your credits</li>
          <li>Talk to Atlas and Core, including Core&apos;s memory and connected apps</li>
          <li>See your renders and your credit balance</li>
        </ul>
        <p className="oa-sub">It cannot change your plan, billing, team or password. You can disconnect it any time in Settings, API/MCP.</p>
        {error && <p className="oa-err" role="alert">{error}</p>}
        <button type="button" className="oa-go" disabled={!!busy} onClick={() => answer("allow")}>Allow</button>
        <button type="button" className="oa-no" disabled={!!busy} onClick={() => answer("deny")}>Cancel</button>
      </div>
    </main>
  );
}
