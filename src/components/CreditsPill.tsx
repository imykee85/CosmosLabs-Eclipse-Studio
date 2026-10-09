"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useCredits } from "@/lib/use-credits";

// 999 stays 999, 1000 becomes 1k, 1250 becomes 1.2k (rounded down so the pill never overstates), 1,000,000 becomes 1M.
function short(n: number): string {
  const fmt = (v: number, unit: string) => `${(Math.floor(v * 10) / 10).toString()}${unit}`;
  if (n >= 1_000_000) return fmt(n / 1_000_000, "M");
  if (n >= 1000) return n >= 999_950 ? "999.9k" : fmt(n / 1000, "k");
  return String(n);
}

// The credit balance shown in the header of every screen; it opens Billing. Until the balance is known the number is left blank (never 0).
export default function CreditsPill({ className, text = false }: { className: string; text?: boolean }) {
  const { credits } = useCredits();
  const n = credits ? short(credits.balance) : "";
  const full = credits ? `${credits.balance.toLocaleString("en-US")} credits` : "Credits";
  const title = credits && !credits.charging ? `${full} (not charged yet)` : full;
  return (
    <Link href="/settings?tab=billing" className={className} title={title}>
      <Coins size={text ? 15 : 14} /> {n && (text ? `${n} credits` : n)}
    </Link>
  );
}
