"use client";

import { FormEvent, useState } from "react";
import "./settings.css";

// Owner tool: add credits to an account. Reached from Billing when you are an admin.
export default function AdminCredits({ email: me }: { email: string }) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, amount: Number(amount), note }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMsg({ ok: true, text: `Added ${data.added.toLocaleString("en-US")} credits to ${data.email}. Their balance is now ${data.balance.toLocaleString("en-US")}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="st-section ad-form">
      <h2>Add credits</h2>
      <p className="st-sub">Owner tool. Signed in as {me}. Leave the e-mail empty to add credits to your own account.</p>
      <form onSubmit={submit}>
        <label htmlFor="ad-email">E-MAIL OF THE ACCOUNT</label>
        <input id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={me} autoComplete="off" />
        <label htmlFor="ad-amount">CREDITS TO ADD</label>
        <input id="ad-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        <label htmlFor="ad-note">NOTE (OPTIONAL)</label>
        <input id="ad-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. Beta tester" />
        <button type="submit" className="ad-go" disabled={!amount || busy}>{busy ? "Adding…" : "Add credits"}</button>
      </form>
      {msg && <p className={msg.ok ? "ad-ok" : "ad-err"} role="status">{msg.text}</p>}
    </section>
  );
}
