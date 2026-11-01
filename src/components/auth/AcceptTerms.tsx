"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { TERMS_FLAG, TERMS_VERSION } from "@/lib/terms";

async function send(source: "sign-up" | "gate") {
  const res = await fetch("/api/terms/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true, version: TERMS_VERSION, source }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save your acceptance. Please try again.");
}

// Shown once to anyone who has not accepted the current terms (also the step that records the sign-up page's checkbox).
export default function AcceptTerms({ next }: { next: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The person already ticked the box on the sign-up page: record it and move on without asking again.
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    let flagged = false;
    try { flagged = sessionStorage.getItem(TERMS_FLAG) === TERMS_VERSION; } catch { /* private mode */ }
    if (!flagged) return;
    setAuto(true);
    send("sign-up")
      .then(() => { try { sessionStorage.removeItem(TERMS_FLAG); } catch { /* ignore */ } router.replace(next); })
      .catch(() => setAuto(false));
  }, [next, router]);

  async function accept() {
    setBusy(true); setError("");
    try { await send("gate"); router.replace(next); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  if (auto) return <section className="login-card auth-card"><p className="login-intro">One moment…</p></section>;
  return (
      <section className="login-card auth-card" aria-labelledby="terms-title">
        <span className="auth-logo"><LogoMark size={56} /></span>
        <h1 id="terms-title">before you continue</h1>
        <p className="login-intro">Please accept our Terms of Use and Privacy Policy to use Eclipse.</p>
        <label className="auth-accept">
          <input type="checkbox" checked={checked} onChange={(e) => { setChecked(e.target.checked); setError(""); }} />
          <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="button" disabled={!checked || busy} onClick={accept}>Continue</button>
      </section>
  );
}
