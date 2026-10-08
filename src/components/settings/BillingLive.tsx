"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useCredits, type CreditEntry } from "@/lib/use-credits";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function describe(e: CreditEntry): string {
  if (e.note) return e.note;
  return e.reason === "CHARGE" ? "Image" : e.reason === "PURCHASE" ? "Plan purchase" : e.reason === "REFUND" ? "Refund" : "Credits added";
}

export function CreditBalance() {
  const { credits } = useCredits();
  return <p className="st-big">{credits ? credits.balance.toLocaleString("en-US") : "0"}</p>;
}

export function CreditNotes() {
  const { credits } = useCredits();
  if (!credits) return null;
  return (
    <>
      {!credits.charging && <p className="st-meta">Credits are not charged yet, so images are free for now.</p>}
      {credits.isAdmin && <p className="st-meta"><Link href="/admin/credits" className="bl-link">Add credits to an account</Link></p>}
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
            <b className={e.delta > 0 ? "bl-plus" : "bl-minus"}>{e.delta > 0 ? "+" : ""}{e.delta.toLocaleString("en-US")}</b>
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
