"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useCredits, type CreditEntry } from "@/lib/use-credits";
import { fmtCredits } from "@/lib/credit-units";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function describe(e: CreditEntry): string {
  if (e.note) return e.note;
  return e.reason === "EXPIRE" ? "Credits expired" : e.reason === "CHARGE" ? "Image" : e.reason === "PURCHASE" ? "Plan purchase" : e.reason === "REFUND" ? "Refund" : "Credits added";
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** What is left of each plan and top-up grant, with its expiry date. Nothing shows while nothing can expire. */
export function CreditGrants() {
  const { credits } = useCredits();
  const rows = (credits?.grants ?? []).filter((g) => g.expiresAt);
  if (!rows.length) return null;
  return (
    <ul className="bl-list">
      {rows.map((g, i) => (
        <li key={`${g.grantedAt}-${i}`}>
          <span className="bl-what">{g.source === "plan" ? "Plan credits" : "Top-up credits"}<small>{`Added ${day(g.grantedAt)} · expire ${day(g.expiresAt!)}`}</small></span>
          <b className="bl-plus">{fmtCredits(g.remaining)}</b>
        </li>
      ))}
    </ul>
  );
}

export function CreditBalance() {
  const { credits } = useCredits();
  return <p className="st-big">{credits ? fmtCredits(credits.balance) : "0"}</p>;
}

export function CreditNotes() {
  const { credits } = useCredits();
  if (!credits) return null;
  return (
    <>
      {credits.expiring && <p className="st-meta">{`${fmtCredits(credits.expiring.amount)} credits expire on ${day(credits.expiring.at)}.`}</p>}
      {(credits.lockedTopup ?? 0) > 0 && <p className="st-meta">{`${fmtCredits(credits.lockedTopup ?? 0)} more top-up credits are saved. They unlock when you subscribe to a plan.`}</p>}
      {!credits.charging && <p className="st-meta">Credits are not charged yet, so images are free for now.</p>}
      {credits.isAdmin && <p className="st-meta"><Link href="/admin/credits" className="bl-link">Add credits to an account</Link> · <Link href="/admin/health" className="bl-link">Health check</Link> · <Link href="/admin/pricing" className="bl-link">Price check</Link> · <Link href="/admin/jobs" className="bl-link">Recent renders</Link></p>}
    </>
  );
}

export function CreditHistory() {
  const { credits } = useCredits();
  if (credits && credits.history.length > 0) {
    return (
      <ul className="bl-list">
        {credits.history.map((e) => (
          <li key={e.id}>
            <span className="bl-what">{describe(e)}<small>{when(e.createdAt)}</small></span>
            <b className={e.delta > 0 ? "bl-plus" : "bl-minus"}>{e.delta > 0 ? "+" : "-"}{fmtCredits(Math.abs(e.delta))}</b>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="st-empty">
      <Inbox size={44} strokeWidth={1.4} />
      <p className="st-empty-title">No transactions yet</p>
      <p className="st-meta">Credit activity will appear here.</p>
    </div>
  );
}
