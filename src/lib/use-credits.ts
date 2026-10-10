"use client";

import { useCallback, useEffect, useState } from "react";

export type CreditEntry = { id: string; delta: number; reason: string; note: string | null; createdAt: string };
export type Credits = { balance: number; charging: boolean; isAdmin: boolean; history: CreditEntry[] };

// The last balance seen is kept for the whole visit (and across page loads), so a header that mounts on a new screen
// shows the real amount at once instead of waiting for the network, and the number never flashes 0.
const STORE_KEY = "eclipse-credits";
let cache: Credits | null = null;
const listeners = new Set<(c: Credits) => void>();

function readStored(): Credits | null {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    return d && typeof d.balance === "number" ? d : null;
  } catch { return null; }
}

function publish(d: Credits) {
  cache = d;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {}
  listeners.forEach((fn) => fn(d));
}

// The signed-in user's credit balance and recent activity (null until the first load, or when signed out / in preview mode).
export function useCredits(): { credits: Credits | null; reload: () => void } {
  const [credits, setCredits] = useState<Credits | null>(cache);
  const reload = useCallback(() => {
    fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d.balance === "number") publish(d); }).catch(() => {});
  }, []);
  useEffect(() => {
    listeners.add(setCredits);
    if (!cache) { const stored = readStored(); if (stored) { cache = stored; setCredits(stored); } }
    else setCredits(cache);
    reload();
    window.addEventListener("focus", reload);
    return () => { listeners.delete(setCredits); window.removeEventListener("focus", reload); };
  }, [reload]);
  return { credits, reload };
}
