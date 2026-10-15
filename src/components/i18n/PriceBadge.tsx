"use client";

import { approxPrice } from "@/lib/i18n/format";
import { useLocale } from "./LocaleProvider";

// The small "about this much in your money" tag next to a dollar price. Nothing shows for people paying in dollars or while the rate is unknown.
export default function PriceBadge({ usd, className = "" }: { usd: number; className?: string }) {
  const { currency, rate, lang } = useLocale();
  const text = approxPrice(usd, currency, rate, lang);
  if (!text) return null;
  return <span className={`price-badge ${className}`} translate="no">{text}</span>;
}
