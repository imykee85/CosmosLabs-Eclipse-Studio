"use client";

import { useEffect, useState } from "react";
import { FEATURE_MIN, PLAN_RANK, planAllows, upgradeText, type Feature, type PlanId } from "@/lib/access-table";
import { UPGRADE_EVENT } from "@/components/SubscribeAlert";

// The plan of the current workspace, fetched once and shared by everything that shows a lock (Atlas's switch, the Team tab, the billing card). The server
// checks every use itself; this only lets the app react at once, before any request. While the plan is not known yet nothing is blocked here.
type Info = { plan: PlanId; features: Feature[]; admin: boolean } | null;
let cache: Info = null;
let inflight: Promise<void> | null = null;
const EVENT = "eclipse-access-change";

function load(): Promise<void> {
  if (!inflight) {
    inflight = fetch("/api/access", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.plan === "string") { cache = { plan: d.plan, features: d.features ?? [], admin: !!d.admin }; window.dispatchEvent(new Event(EVENT)); } })
      .catch(() => {})
      .finally(() => { setTimeout(() => { inflight = null; }, 30_000); });
  }
  return inflight;
}

/** Asks for a fresh answer (after a purchase, a team switch, sign-out). */
export function refreshAccess() { cache = null; inflight = null; if (typeof window !== "undefined") void load(); }

/** True unless the plan is known and lacks the feature. */
export function allowedNow(feature: Feature): boolean {
  if (!cache) return true;
  return cache.features.includes(feature) || planAllows(cache.plan, feature);
}

/** Opens the upgrade pop-up for a feature the plan does not include. */
export function askUpgrade(feature: Feature) {
  window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: { message: `${upgradeText(feature)} Upgrade to use it.`, need: FEATURE_MIN[feature] } }));
}

export function useAccess() {
  const [info, setInfo] = useState<Info>(cache);
  useEffect(() => {
    const read = () => setInfo(cache);
    window.addEventListener(EVENT, read);
    void load();
    read();
    return () => window.removeEventListener(EVENT, read);
  }, []);
  return {
    plan: info?.plan ?? null,
    known: !!info,
    /** True when the plan is known and is below `need` (a video model or quality the plan does not include). */
    below: (need: PlanId) => !!info && !info.admin && PLAN_RANK[info.plan] < PLAN_RANK[need],
    can: (feature: Feature) => !info || info.features.includes(feature) || planAllows(info.plan, feature),
  };
}
