"use client";

import { fmtCredits } from "@/lib/credit-units";
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
      setMsg({ ok: true, text: `Added ${fmtCredits(data.added)} credits to ${data.email}. Their balance is now ${fmtCredits(data.balance)}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
    <GivePlan me={me} />
    </>
  );
}

// Owner tool: let an account use a plan's features without paying (testers, comped accounts). "Their real plan" removes the hand-given plan.
function GivePlan({ me }: { me: string }) {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("growth");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, plan }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMsg({ ok: true, text: `${data.email} now uses the ${data.plan} plan${data.given ? " (given by you)" : " (their real plan)"}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="st-section ad-form">
      <h2>Give a plan</h2>
      <p className="st-sub">Owner tool. Lets an account use a plan&apos;s features without paying. You ({me}) always have everything.</p>
      <form onSubmit={submit}>
        <label htmlFor="ap-email">E-MAIL OF THE ACCOUNT</label>
        <input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        <label htmlFor="ap-plan">PLAN</label>
        <select id="ap-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
          <option value="free">Free (lock everything)</option>
          <option value="none">Their real plan (remove the one I gave)</option>
        </select>
        <button type="submit" className="ad-go" disabled={!email.trim() || busy}>{busy ? "Saving…" : "Save plan"}</button>
      </form>
      {msg && <p className={msg.ok ? "ad-ok" : "ad-err"} role="status">{msg.text}</p>}
    </section>
  );
}
