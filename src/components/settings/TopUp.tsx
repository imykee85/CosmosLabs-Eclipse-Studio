"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import PriceBadge from "@/components/i18n/PriceBadge";
import { refreshCredits } from "@/lib/use-credits";
import { CUSTOM_PACK_ID, customPrice } from "@/lib/plans";

type Pack = { id: string; name: string; price: number; credits: number };
type Auto = { enabled: boolean; packId: string; credits: number | null; threshold: number; maxPerMonth: number; hasCard: boolean; lastError: string | null; usedThisMonth: number };
type Info = { custom: { min: number; max: number }; team: { isTeam: boolean; isAdmin: boolean }; packs: Pack[]; thresholds: number[]; caps: number[]; paymentsReady: boolean; autoReady: boolean; auto: Auto };

async function startCheckout(packId: string, credits?: number): Promise<string | null> {
  try {
    const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId, ...(credits ? { credits } : {}) }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.url === "string") { window.location.href = data.url; return null; }
    return typeof data.error === "string" ? data.error : "Could not start the checkout.";
  } catch { return "Could not reach the checkout. Try again."; }
}

// Pay as you go: one-time credit packs for when a plan's credits run out before it renews, and a switch on each pack that buys it again by itself.
export default function TopUp() {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [amount, setAmount] = useState("1000");
  const [amountSet, setAmountSet] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (!res.ok) { setFailed(true); return; }
      const data: Info = await res.json();
      setInfo(data);
      // The amount box starts at the person's saved auto amount, once.
      if (data.auto.credits && !amountSet) { setAmount(String(data.auto.credits)); setAmountSet(true); }
    } catch { setFailed(true); }
  }, [amountSet]);
  useEffect(() => { void load(); }, [load]);

  // Coming back from the checkout: the credits arrive a moment later, once the provider confirms the payment.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paid") !== "1") return;
    setNotice("Payment received. Your credits arrive in a few seconds.");
    let n = 0;
    const t = setInterval(() => { refreshCredits(); void load(); if (++n >= 10) clearInterval(t); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function buy(packId: string, credits?: number) {
    setBusy(packId); setError("");
    const err = await startCheckout(packId, credits);
    if (err) { setError(err); setBusy(""); }
  }

  async function save(patch: Partial<Pick<Auto, "enabled" | "packId" | "credits" | "threshold" | "maxPerMonth">>) {
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
        const err = await startCheckout(data.auto.packId, data.auto.credits ?? undefined);
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
  const locked = info.team.isTeam && !info.team.isAdmin; // a team member who is not an admin cannot buy credits for the team
  const pack = a.packId === CUSTOM_PACK_ID && a.credits ? { name: `${a.credits.toLocaleString("en-US")} credits` } : info.packs.find((p) => p.id === a.packId) ?? info.packs[0];
  const credits = /^\d+$/.test(amount.trim()) ? Number(amount) : NaN;
  const price = customPrice(credits);
  const customOn = a.enabled && a.packId === CUSTOM_PACK_ID;

  return (
    <>
      <section className="st-section" aria-labelledby="st-topup">
        <h3 id="st-topup" className="st-h3">Top up credits</h3>
        <p className="st-sub">Run out before your plan renews? Buy a pack and keep going. Switch on Auto top-up under a pack to buy it again by itself when your credits run low.</p>
        <div className="st-plans">
          <article className="st-planCard st-custom">
            <span className="st-pill">Your amount</span>
            <label className="st-amount">
              <input className="st-input" inputMode="numeric" aria-label="Credits to buy" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} />
              <span>credits</span>
            </label>
            <p className="st-price">{price === null ? "—" : `$${price.toFixed(2)}`}</p>
            {price !== null && <PriceBadge usd={price} className="badge-row" />}
            <p className="st-meta" style={price === null && amount ? { color: "#e5484d" } : undefined}>{price === null ? `${info.custom.min.toLocaleString("en-US")} to ${info.custom.max.toLocaleString("en-US")} credits (from $9)` : "One-time purchase"}</p>
            <button type="button" className="st-upgrade" onClick={() => buy(CUSTOM_PACK_ID, credits)} disabled={Boolean(busy) || locked || price === null}>{busy === CUSTOM_PACK_ID ? "Opening..." : "Buy credits"}</button>
            <div className="st-autorow">
              <span>Auto top-up</span>
              <button type="button" role="switch" aria-checked={customOn} aria-label="Auto top-up with your amount" className={`st-switch ${customOn ? "is-on" : ""}`}
                disabled={busy === "auto" || !info.autoReady || locked || (!customOn && price === null)} onClick={() => save(customOn ? { enabled: false } : { enabled: true, packId: CUSTOM_PACK_ID, credits })}><i /></button>
            </div>
            {customOn && price !== null && credits !== a.credits && (
              <button type="button" className="st-linkbtn st-updateauto" disabled={busy === "auto" || locked} onClick={() => save({ packId: CUSTOM_PACK_ID, credits })}>Use {credits.toLocaleString("en-US")} credits for auto top-up</button>
            )}
          </article>
          {info.packs.map((p) => (
            <article key={p.id} className="st-planCard">
              <span className="st-pill">{p.name}</span>
              <p className="st-price">${p.price}</p>
              <PriceBadge usd={p.price} className="badge-row" />
              <p className="st-meta">One-time purchase</p>
              <button type="button" className="st-upgrade" onClick={() => buy(p.id)} disabled={Boolean(busy) || locked}>{busy === p.id ? "Opening..." : "Buy credits"}</button>
              <div className="st-autorow">
                <span>Auto top-up</span>
                <button type="button" role="switch" aria-checked={a.enabled && a.packId === p.id} aria-label={`Auto top-up with ${p.name}`} className={`st-switch ${a.enabled && a.packId === p.id ? "is-on" : ""}`}
                  disabled={busy === "auto" || !info.autoReady || locked} onClick={() => save(a.enabled && a.packId === p.id ? { enabled: false } : { enabled: true, packId: p.id })}><i /></button>
              </div>
            </article>
          ))}
        </div>
        {a.enabled && pack && (
          <p className="st-meta st-autonote">
            <CreditCard size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {`${pack.name} is added by itself when your credits fall below ${a.threshold.toLocaleString("en-US")}, at most ${a.maxPerMonth} a month (used ${a.usedThisMonth}). ${a.hasCard ? "Your saved card is charged." : "Your card is saved the first time you buy credits."}`}
          </p>
        )}
        {a.lastError && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{a.lastError}</p>}
        {notice && <p className="st-meta st-notice" role="status">{notice}</p>}
        {error && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{error}</p>}
        {locked && <p className="st-meta" style={{ marginTop: 8 }}>Only a team admin can buy credits for the team.</p>}
        {!info.paymentsReady && <p className="st-meta" style={{ marginTop: 8 }}>Payments are not set up yet.</p>}
      </section>
    </>
  );
}
