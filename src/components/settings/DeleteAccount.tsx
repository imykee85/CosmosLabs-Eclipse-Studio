"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

type Outcome = { ok: boolean; error?: string; notes?: string[] };

// Delete account: a warning, a list of what goes, and the person has to type DELETE. `run` does the deleting; `finish` leaves the app afterwards.
export default function DeleteAccount({ run, finish }: { run: () => Promise<Outcome>; finish: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[] | null>(null);

  async function go() {
    setBusy(true); setError("");
    const r = await run().catch(() => ({ ok: false, error: "Could not reach the server. Try again." }) as Outcome);
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "Could not delete the account."); return; }
    if (r.notes?.length) setNotes(r.notes); else finish();
  }

  if (notes) return (
    <section className="st-section st-delete" aria-labelledby="st-delete">
      <h2 id="st-delete">Your account is deleted</h2>
      <ul className="st-sub">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <div className="st-actions"><button type="button" className="st-save" onClick={finish}>Continue</button></div>
    </section>
  );

  return (
    <section className="st-section st-delete" aria-labelledby="st-delete">
      <h2 id="st-delete">Delete account</h2>
      <p className="st-sub">Permanently remove your account and everything in it.</p>

      <div className="st-warning" role="note">
        <TriangleAlert size={20} aria-hidden />
        <div>
          <b>WARNING: THIS CANNOT BE UNDONE</b>
          Deleting your account removes, for good:
          <ul>
            <li>all your projects, images, videos, voice takes, canvases, uploads and memory</li>
            <li>your credits, balance and history. Any credits you have left are lost</li>
            <li>your portfolio and certificates. Their public links stop working</li>
            <li>your connected apps, API keys and saved agents, skills and tools</li>
          </ul>
          If you have a subscription we try to end it for you; check your payment account afterwards. Download anything you want to keep first.
        </div>
      </div>

      <label htmlFor="st-del-confirm" className="st-label" style={{ marginTop: 18 }}>TYPE DELETE TO CONFIRM</label>
      <input id="st-del-confirm" className="st-input" value={typed} onChange={(e) => { setTyped(e.target.value); setError(""); }} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="DELETE" />
      <div className="st-actions">
        <button type="button" className="st-destroy" disabled={busy || typed !== "DELETE"} onClick={go}>{busy ? "Deleting…" : "Delete my account permanently"}</button>
        {error && <span className="st-note is-err" role="alert">{error}</span>}
      </div>
    </section>
  );
}
