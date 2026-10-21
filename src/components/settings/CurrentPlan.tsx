"use client";

import { PLAN_NAME } from "@/lib/access-table";
import { useAccess } from "@/lib/use-access";

// The plan name in Settings > Billing: Free, Starter, Growth or Scale (the owner sees Scale), from the same lookup the server uses.
export default function CurrentPlan() {
  const { plan, known } = useAccess();
  return <p className="st-big">{known && plan ? PLAN_NAME[plan] : "Free"}</p>;
}
