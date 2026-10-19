"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";

type Card = { id: string; brand: string; last4: string; expMonth?: number; expYear?: number; isDefault: boolean };

const brandName = (b: string) => (b ? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase() : "Card");

// Saved cards: the card used for the first payment is saved as the default. Add more on the payment provider's page, choose the default,
// and remove one, but never the only card: add another first. Card numbers never reach our servers.
export default function PaymentMethods() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/cards", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCards([]);
        setLoadError(res.status === 401 || res.status === 503 ? "Sign in to a full account to save a payment method." : typeof data.error === "string" ? data.error : "Could not load your cards.");
        return;
      }
      setLoadError("");
      setCards(data.cards);
    } catch { setCards([]); setLoadError("Could not load your cards. Try again in a moment."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Coming back from the provider's card page: the card appears a moment later, once the provider confirms it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("card") !== "1") return;
    let n = 0;
    const t = setInterval(() => { void load(); if (++n >= 8) clearInterval(t); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function add() {
    setBusy("add"); setError("");
    try {
      const res = await fetch("/api/billing/cards", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") { window.location.href = data.url; return; }
      setError(typeof data.error === "string" ? data.error : "Could not open the card page.");
    } catch { setError("Could not reach the server. Try again."); }
    setBusy("");
  }

  async function change(id: string, method: "PUT" | "DELETE") {
    setBusy(id); setError(""); setConfirm("");
    try {
      const res = await fetch(`/api/billing/cards/${encodeURIComponent(id)}`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Could not save."); return; }
      setCards(data.cards);
    } catch { setError("Could not reach the server. Try again."); }
    finally { setBusy(""); }
  }

  const list = cards ?? [];
  const only = list.length === 1;

  return (
    <section className="st-section" aria-labelledby="st-cards">
      <div className="st-cardshead">
        <h3 id="st-cards" className="st-h3">Payment methods</h3>
        <button type="button" className="st-addcard" onClick={add} disabled={busy === "add" || cards === null}><Plus size={15} /> {busy === "add" ? "Opening..." : "Add card"}</button>
      </div>
      {cards === null ? null : list.length === 0 ? (
        <p className="st-meta">{loadError || "No saved cards. The card you pay with first is saved here as your default."}</p>
      ) : (
        <ul className="st-cardlist">
          {list.map((c) => (
            <li key={c.id} className="st-cardrow">
              <CreditCard size={20} aria-hidden="true" />
              <div className="st-cardinfo">
                <b>{brandName(c.brand)} •••• {c.last4}</b>
                {c.expMonth && c.expYear ? <span className="st-meta">Expires {String(c.expMonth).padStart(2, "0")}/{c.expYear}</span> : null}
              </div>
              {c.isDefault
                ? <span className="st-pill">Default</span>
                : <button type="button" className="st-linkbtn" onClick={() => change(c.id, "PUT")} disabled={busy === c.id}>Make default</button>}
              <button type="button" className={`st-removecard ${confirm === c.id ? "is-confirm" : ""}`} aria-label={`Remove ${brandName(c.brand)} ending ${c.last4}`}
                disabled={busy === c.id || only} title={only ? "Add another card before removing this one" : undefined}
                onClick={() => (confirm === c.id ? void change(c.id, "DELETE") : setConfirm(c.id))}>
                <Trash2 size={15} />{confirm === c.id ? " Remove?" : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {only && <p className="st-meta" style={{ marginTop: 10 }}>This is your only card. Add another card to be able to remove it.</p>}
      {error && <p className="st-meta" role="alert" style={{ color: "#e5484d", marginTop: 8 }}>{error}</p>}
    </section>
  );
}
