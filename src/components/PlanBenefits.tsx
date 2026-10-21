"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Clock, Lock } from "lucide-react";
import { BENEFITS, PLAN_RANK, type PlanId } from "@/lib/access-table";
import "./plan-benefits.css";

// The benefits on a paid plan card (owner 2026-10-21): EVERY benefit is listed on every paid card, the ones this plan does not include are greyed with a
// lock, and a "See more" button opens the long list (the short view shows what Starter has, so it is the same on every card). The table is src/lib/access-table.ts.
const SHORT = 7;

export default function PlanBenefits({ planId }: { planId: PlanId }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  // Automated workflows (not built yet) are listed on the Scale card only (owner 2026-10-21).
  const list = BENEFITS.filter((b) => !b.soon || planId === "scale");
  const shown = open ? list : list.slice(0, SHORT);
  return (
    <div className="pb">
      <ul className="pb-list" id={id}>
        {shown.map((b) => {
          const has = PLAN_RANK[planId] >= PLAN_RANK[b.min];
          return (
            <li key={b.label} className={b.soon ? "is-soon" : has ? "" : "is-locked"}>
              {b.soon ? <Clock size={14} aria-hidden="true" /> : has ? <Check size={15} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
              <span>{b.label}</span>
              {b.soon && <span className="pb-soon">Soon</span>}
              {!has && !b.soon && <span className="pb-sr"> (not included)</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="pb-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? "See less" : "See more"} <ChevronDown size={15} aria-hidden="true" className={open ? "is-up" : ""} />
      </button>
    </div>
  );
}
