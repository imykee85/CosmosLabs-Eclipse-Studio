"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, CreditCard } from "lucide-react";
import PriceBadge from "@/components/i18n/PriceBadge";
import { refreshCredits } from "@/lib/use-credits";
import { CUSTOM_PACK_ID, customPrice } from "@/lib/plans";

type Pack = { id: string; name: string; price: number; credits: number };
type Auto = { enabled: boolean; packId: string; credits: number | null; threshold: number; maxPerMonth: number; hasCard: boolean; lastError: string | null; usedThisMonth: number; actionUrl?: string | null };
type Info = { subscribed?: boolean; lockedTopup?: number; topupCredits?: number; custom: { min: number; max: number }; team: { isTeam: boolean; isAdmin: boolean }; packs: Pack[]; thresholds: number[]; caps: number[]; paymentsReady: boolean; autoReady: boolean; auto: Auto };

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
  const [sel, setSel] = useState(CUSTOM_PACK_ID);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (!res.ok) { setFailed(true); return; }
      const data: Info = await res.json();
      setInfo(data);
      // The amount box starts at the person's saved auto amount, once.
      if (!amountSet) {
        if (data.auto.credits) setAmount(String(data.auto.credits));
        if (data.auto.enabled) setSel(data.auto.packId);
        setAmountSet(true);
      }
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

  const a = info?.auto;
  const gated = info?.subscribed === false; // top-ups need a subscription: free accounts cannot buy them, and a lapsed plan locks the ones already bought
  const locked = Boolean(info?.team.isTeam && !info.team.isAdmin); // a team member who is not an admin cannot buy credits for the team
  const credits = /^\d+$/.test(amount.trim()) ? Number(amount) : NaN;
  const customCost = customPrice(credits);
  const chosenPack = info?.packs.find((p) => p.id === sel);
  const selCredits = sel === CUSTOM_PACK_ID ? credits : chosenPack?.credits ?? NaN;
  const selPrice = sel === CUSTOM_PACK_ID ? customCost : chosenPack?.price ?? null;
  const autoOn = Boolean(a?.enabled && a.packId === sel && (sel !== CUSTOM_PACK_ID || a.credits === credits));

  // While auto top-up is on, it follows whatever the chip is set to (a typed amount waits a moment so each digit is not saved).
  useEffect(() => {
    if (!info || !a?.enabled || locked || selPrice === null) return;
    if (a.packId === sel && (sel !== CUSTOM_PACK_ID || a.credits === credits)) return;
    const t = setTimeout(() => void save(sel === CUSTOM_PACK_ID ? { packId: CUSTOM_PACK_ID, credits } : { packId: sel }), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, credits, a?.enabled, a?.packId, a?.credits]);

  if (failed) return (
    <section className="st-section" aria-labelledby="st-topup">
      <h3 id="st-topup" className="st-h3">Top up credits</h3>
      <p className="st-meta">Sign in to a full account to buy credits.</p>
    </section>
  );
  if (!info) return null;
  if (!a) return null;
  const pack = a.packId === CUSTOM_PACK_ID && a.credits ? { name: `${a.credits.toLocaleString("en-US")} credits` } : info.packs.find((p) => p.id === a.packId) ?? info.packs[0];

  const chipLabel = selPrice === null ? "Choose an amount" : `${selCredits.toLocaleString("en-US")} credits`;

  return (
    <>
      <section className="st-section" aria-labelledby="st-topup">
        <h3 id="st-topup" className="st-h3">Top up credits</h3>
        <p className="st-sub">Run out before your plan renews? Choose an amount and keep going. Auto top-up buys the same amount again by itself when your credits run low.</p>
        <div className="st-topbar">
          <button type="button" className="st-chip" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}>
            <span className="st-chiptext"><b>{chipLabel}</b>{selPrice !== null && <em>${selPrice.toFixed(2)}</em>}</span>
            <ChevronDown size={18} aria-hidden="true" className={open ? "is-open" : ""} />
          </button>
          <div className="st-autoside">
            <span>Auto top-up</span>
            <button type="button" role="switch" aria-checked={autoOn} aria-label="Auto top-up with the chosen amount" className={`st-switch ${autoOn ? "is-on" : ""}`}
              disabled={busy === "auto" || !info.autoReady || locked || gated || (!autoOn && selPrice === null)}
              onClick={() => save(autoOn ? { enabled: false } : sel === CUSTOM_PACK_ID ? { enabled: true, packId: CUSTOM_PACK_ID, credits } : { enabled: true, packId: sel })}><i /></button>
          </div>
        </div>
        {open && (
          <div className="st-options" role="listbox" aria-label="Credit amounts">
            <div className={`st-option ${sel === CUSTOM_PACK_ID ? "is-on" : ""}`} role="option" aria-selected={sel === CUSTOM_PACK_ID} onClick={() => setSel(CUSTOM_PACK_ID)}>
              <span className="st-optname">Your amount</span>
              <label className="st-amount">
                <input className="st-input" inputMode="numeric" aria-label="Credits to buy" value={amount}
                  onFocus={() => setSel(CUSTOM_PACK_ID)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(false); }}
                  onChange={(e) => { setSel(CUSTOM_PACK_ID); setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 6)); }} />
                <span>credits</span>
              </label>
              <span className="st-optprice" style={customCost === null ? { color: "#e5484d" } : undefined}>{customCost === null ? `${info.custom.min.toLocaleString("en-US")} to ${info.custom.max.toLocaleString("en-US")}` : `$${customCost.toFixed(2)}`}</span>
            </div>
            {info.packs.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={sel === p.id} className={`st-option ${sel === p.id ? "is-on" : ""}`} onClick={() => { setSel(p.id); setOpen(false); }}>
                <span className="st-optname">{p.name}</span>
                <span className="st-optprice">${p.price}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="st-upgrade st-buy" onClick={() => buy(sel, sel === CUSTOM_PACK_ID ? credits : undefined)} disabled={Boolean(busy) || locked || gated || selPrice === null}>
          {gated ? "Subscribe to top up" : selPrice === null ? "Buy credits" : `Buy credits · $${selPrice.toFixed(2)}`}
        </button>
        {selPrice !== null && <PriceBadge usd={selPrice} className="badge-row" />}
        {a.enabled && pack && (
          <p className="st-meta st-autonote">
            <CreditCard size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {`${pack.name} is added by itself when your credits fall below ${a.threshold.toLocaleString("en-US")}, at most ${a.maxPerMonth} a month (used ${a.usedThisMonth}). ${a.hasCard ? "Your saved card is charged." : "Your card is saved the first time you buy credits."}`}
          </p>
        )}
        {a.lastError && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{a.lastError}</p>}
        {a.actionUrl && <a className="st-upgrade st-buy" href={a.actionUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8, textAlign: "center" }}>Confirm the payment</a>}
        {notice && <p className="st-meta st-notice" role="status">{notice}</p>}
        {error && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{error}</p>}
        {gated && <p className="st-meta" role="status" style={{ marginTop: 8 }}>{info.lockedTopup ? `Your ${info.lockedTopup.toLocaleString("en-US")} top-up credits are saved. They unlock as soon as you subscribe to a plan.` : "Top-ups are for subscribers. Choose a plan below to unlock them."}</p>}
        {locked && <p className="st-meta" style={{ marginTop: 8 }}>Only a team admin can buy credits for the team.</p>}
        {!info.paymentsReady && <p className="st-meta" style={{ marginTop: 8 }}>Payments are not set up yet.</p>}
      </section>
    </>
  );
}
