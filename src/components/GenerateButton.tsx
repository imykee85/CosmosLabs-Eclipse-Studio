"use client";

import type { ReactNode } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import { creditsText, fmtCredits } from "@/lib/credit-units";
import "./generate-button.css";

/** The one Generate button used by every studio and panel: a red pill that says Generate and always shows what it will cost
 * (a number of credits, "Free" when the welcome offer covers it, or "from N" when the model is chosen automatically). */
export default function GenerateButton({ price, free = false, from = false, busy = false, label = "Generate", busyLabel = "Generating", disabled = false, wide = false, type = "button", className = "", onClick, children }: {
  label?: string; price?: number | null; free?: boolean; from?: boolean; busy?: boolean; busyLabel?: string; disabled?: boolean; wide?: boolean; type?: "button" | "submit"; className?: string; onClick?: () => void; children?: ReactNode;
}) {
  return (
    <button type={type} className={`gen-btn${wide ? " is-wide" : ""} ${className}`.trim()} disabled={disabled || busy} onClick={onClick} aria-label={busy ? busyLabel : label}>
      {busy ? <><Loader2 size={16} className="gen-spin" /> {busyLabel}</> : (
        <>
          {label}
          {free ? <span className="gen-cost" title="Free with your welcome offer">Free</span>
            : price != null ? <span className="gen-cost" title={`${from ? "From " : ""}${creditsText(price)}`}><CoinIcon size={14} />{from ? "from " : ""}{fmtCredits(price)}</span>
            : <ArrowUp size={16} />}
          {children}
        </>
      )}
    </button>
  );
}
