import { CreditCard, Inbox, Zap } from "lucide-react";
import UpgradeButton from "./UpgradeButton";
import TopUp from "./TopUp";
import PaymentMethods from "./PaymentMethods";
import { plans } from "@/lib/plans";
import PriceBadge from "@/components/i18n/PriceBadge";
import { CreditBalance, CreditHistory, CreditNotes } from "./BillingLive";

// The Upgrade buttons open the payment provider's checkout (needs the Whop keys); the credit balance and history are real.
export default function BillingPanel() {
  return (
    <>
      <section className="st-section" aria-labelledby="st-billing">
        <h2 id="st-billing">Billing &amp; credits</h2>
        <p className="st-sub">Manage your subscription and view credit history.</p>

        <div className="st-plan">
          <div>
            <p className="st-eyebrow"><CreditCard size={15} /> CURRENT PLAN</p>
            <p className="st-big">Trial</p>
          </div>
          <div>
            <p className="st-eyebrow"><Zap size={15} /> CREDITS</p>
            <CreditBalance />
          </div>
        </div>
        <CreditNotes />
      </section>

      <TopUp />

      <PaymentMethods />

      <section className="st-section" aria-labelledby="st-upgrade">
        <h3 id="st-upgrade" className="st-h3">Upgrade your plan</h3>
        <div className="st-plans">
          {plans.map((p) => (
            <article key={p.name} className="st-planCard">
              <span className="st-pill">{p.name}</span>
              <p className="st-price">${p.price}<small>/mo</small></p>
              <PriceBadge usd={p.price} className="badge-row" />
              <p className="st-meta">{p.credits.toLocaleString("en-US")} credits/mo · {p.seats} seat{p.seats === 1 ? "" : "s"}</p>
              <UpgradeButton planId={p.id} />
            </article>
          ))}
        </div>
        
      </section>

      <section className="st-section" aria-labelledby="st-history">
        <h3 id="st-history" className="st-h3">Credit history</h3>
        <CreditHistory />
      </section>
    </>
  );
}
