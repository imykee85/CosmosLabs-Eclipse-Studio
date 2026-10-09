"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useCredits } from "@/lib/use-credits";

// The credit balance shown in the header of every screen; it opens Billing. Until the balance is known the number is left blank (never 0).
export default function CreditsPill({ className, text = false }: { className: string; text?: boolean }) {
  const { credits } = useCredits();
  const n = credits ? credits.balance.toLocaleString("en-US") : "";
  const title = credits && !credits.charging ? "Credits (not charged yet)" : "Credits";
  return (
    <Link href="/settings" className={className} title={title}>
      <Coins size={text ? 15 : 14} /> {n && (text ? `${n} credits` : n)}
    </Link>
  );
}
