"use client";

import { useCallback, useEffect, useState } from "react";

export type CreditEntry = { id: string; delta: number; reason: string; note: string | null; createdAt: string };
export type Credits = { balance: number; charging: boolean; isAdmin: boolean; history: CreditEntry[] };

// The signed-in user's credit balance and recent activity (null until loaded or when signed out / in preview mode).
export function useCredits(): { credits: Credits | null; reload: () => void } {
  const [credits, setCredits] = useState<Credits | null>(null);
  const reload = useCallback(() => {
    fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d.balance === "number") setCredits(d); }).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);
  return { credits, reload };
}
