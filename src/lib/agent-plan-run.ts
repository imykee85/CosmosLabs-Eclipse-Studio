"use client";

import { readCurrentProject } from "./projects";
import { refreshCredits } from "./use-credits";
import { newPlan, type PlanSpec, type PlanState } from "./agent-plan";

// The browser's part of an Atlas plan: the price on the card, the Approve press and following progress. The plan itself runs on the SERVER (src/lib/agent-plan-server.ts),
// so it carries on when the app is closed; this file only asks it to start, shows where it is, and asks it to stop.

/** The plan as the card shows it, with its total price worked out from the models' own prices. */
export async function quotePlan(spec: PlanSpec): Promise<PlanState> {
  try {
    const res = await fetch("/api/plans/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) });
    const d = await res.json().catch(() => null);
    if (res.ok && d?.plan) return d.plan;
  } catch {}
  return newPlan(spec, null);
}

/** The person's plans, newest first. */
export async function listPlansFor(): Promise<{ id: string; createdAt: string; plan: PlanState }[]> {
  try {
    const res = await fetch("/api/plans");
    const d = await res.json().catch(() => null);
    return res.ok && Array.isArray(d?.plans) ? d.plans : [];
  } catch { return []; }
}

export type PlanReply = { id: string; plan: PlanState } | { error: string };

/** Approve: the server saves the plan and starts it. */
export async function startPlan(spec: PlanSpec): Promise<PlanReply> {
  const res = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec, projectId: readCurrentProject()?.id }) });
  const d = await res.json().catch(() => ({}));
  refreshCredits();
  return res.ok && typeof d.id === "string" ? d : { error: typeof d.error === "string" ? d.error : "The plan could not be started." };
}

/** Where a plan is now (asking also gives it a push). null when it cannot be read (offline); "gone" when it no longer exists. */
export async function readPlan(id: string): Promise<{ id: string; plan: PlanState } | "gone" | null> {
  try {
    const res = await fetch(`/api/plans/${id}`);
    if (res.status === 404) return "gone";
    const d = await res.json().catch(() => null);
    return res.ok && d?.plan ? d : null;
  } catch { return null; }
}

export async function stopPlan(id: string): Promise<void> {
  await fetch(`/api/plans/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }).catch(() => {});
}
