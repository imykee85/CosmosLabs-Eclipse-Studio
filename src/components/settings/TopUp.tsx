"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import PriceBadge from "@/components/i18n/PriceBadge";
import { refreshCredits } from "@/lib/use-credits";

type Pack = { id: string; name: string; price: number; credits: number };
type Auto = { enabled: boolean; packId: string; threshold: number; maxPerMonth: number; hasCard: boolean; lastError: string | null; usedThisMonth: number };
type Info = { packs: Pack[]; thresholds: number[]; caps: number[]; paymentsReady: boolean; autoReady: boolean; auto: Auto };

async function startCheckout(packId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.url === "string") { window.location.href = data.url; return null; }
    return typeof data.error === "string" ? data.error : "Could not start the checkout.";
  } catch { return "Could not reach the checkout. Try again."; }
}

// Pay as you go: one-time credit packs for when a plan's credits run out before it renews, and an auto top-up switch that buys a pack by itself.
export default function TopUp() {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (!res.ok) { setFailed(true); return; }
      setInfo(await res.json());
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Coming back from the checkout: the credits arrive a moment later, once the provider confirms the payment.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paid") !== "1") return;
    setNotice("Payment received. Your credits arrive in a few seconds.");
    let n = 0;
    const t = setInterval(() => { refreshCredits(); void load(); if (++n >= 10) clearInterval(t); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function buy(packId: string) {
    setBusy(packId); setError("");
    const err = await startCheckout(packId);
    if (err) { setError(err); setBusy(""); }
  }

  async function save(patch: Partial<Pick<Auto, "enabled" | "packId" | "threshold" | "maxPerMonth">>) {
    if (!info) return;
    setBusy("auto"); setError("");
    try {
      const res = await fetch("/api/billing/auto-topup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Could not save."); return; }
      setInfo({ ...info, auto: data.auto });
      // No card is saved until the person has paid once: switching on takes them to that first purchase, which also saves the card.
      if (patch.enabled && !data.auto.hasCard) {
        setNotice("Complete this purchase to save your card. Auto top-up starts right after it.");
        const err = await startCheckout(data.auto.packId);
        if (err) setError(err);
      }
    } catch { setError("Could not reach the server. Try again."); }
    finally { setBusy(""); }
  }

  if (failed) return (
    <section className="st-section" aria-labelledby="st-topup">
      <h3 id="st-topup" className="st-h3">Top up credits</h3>
      <p className="st-meta">Sign in to a full account to buy credits.</p>
    </section>
  );
  if (!info) return null;
  const a = info.auto;
  const pack = info.packs.find((p) => p.id === a.packId) ?? info.packs[0];

  return (
    <>
      <section className="st-section" aria-labelledby="st-topup">
        <h3 id="st-topup" className="st-h3">Top up credits</h3>
        <p className="st-sub">Run out before your plan renews? Buy a pack and keep going. Pay as you go, no plan change needed.</p>
        <div className="st-plans">
          {info.packs.map((p) => (
            <article key={p.id} className="st-planCard">
              <span className="st-pill">{p.name}</span>
              <p className="st-price">${p.price}</p>
              <PriceBadge usd={p.price} className="badge-row" />
              <p className="st-meta">One-time purchase</p>
              <button type="button" className="st-upgrade" onClick={() => buy(p.id)} disabled={Boolean(busy)}>{busy === p.id ? "Opening..." : "Buy credits"}</button>
            </article>
          ))}
        </div>
        {notice && <p className="st-meta st-notice" role="status">{notice}</p>}
        {error && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{error}</p>}
        {!info.paymentsReady && <p className="st-meta" style={{ marginTop: 8 }}>Payments are not set up yet.</p>}
      </section>

      <section className="st-section" aria-labelledby="st-auto">
        <div className="st-autohead">
          <div>
            <h3 id="st-auto" className="st-h3"><RefreshCw size={16} style={{ verticalAlign: "-2px", marginRight: 8 }} />Auto top-up</h3>
            <p className="st-sub">When your credits run low, we add a pack for you so your work never stops.</p>
          </div>
          <button type="button" role="switch" aria-checked={a.enabled} aria-label="Auto top-up" className={`st-switch ${a.enabled ? "is-on" : ""}`} disabled={busy === "auto" || !info.autoReady} onClick={() => save({ enabled: !a.enabled })}><i /></button>
        </div>

        <div className="st-autogrid">
          <label>
            <span className="st-label">WHEN CREDITS FALL BELOW</span>
            <select className="st-input st-select" value={a.threshold} disabled={busy === "auto"} onChange={(e) => save({ threshold: Number(e.target.value) })}>
              {info.thresholds.map((t) => <option key={t} value={t}>{t.toLocaleString("en-US")} credits</option>)}
            </select>
          </label>
          <label>
            <span className="st-label">ADD</span>
            <select className="st-input st-select" value={a.packId} disabled={busy === "auto"} onChange={(e) => save({ packId: e.target.value })}>
              {info.packs.map((p) => <option key={p.id} value={p.id}>{p.name} · ${p.price}</option>)}
            </select>
          </label>
          <label>
            <span className="st-label">MOST PER MONTH</span>
            <select className="st-input st-select" value={a.maxPerMonth} disabled={busy === "auto"} onChange={(e) => save({ maxPerMonth: Number(e.target.value) })}>
              {info.caps.map((c) => <option key={c} value={c}>{c} top-up{c === 1 ? "" : "s"}</option>)}
            </select>
          </label>
        </div>

        <p className="st-meta st-autonote">
          <CreditCard size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {a.hasCard ? "Your saved card is charged." : "Your card is saved the first time you buy credits."}
          {a.enabled && ` At most $${pack ? pack.price * a.maxPerMonth : 0} a month. Used ${a.usedThisMonth} of ${a.maxPerMonth} this month.`}
        </p>
        {a.lastError && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{a.lastError}</p>}
        {!info.autoReady && <p className="st-meta" style={{ marginTop: 8 }}>Automatic top-ups need payments to be set up first.</p>}
      </section>
    </>
  );
}
