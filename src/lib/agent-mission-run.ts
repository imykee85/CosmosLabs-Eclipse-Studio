"use client";

import { readCurrentProject } from "./projects";
import { refreshCredits } from "./use-credits";
import type { MissionSpec, MissionView } from "./agent-mission-spec";

// The browser's part of an Atlas mission: start it, look at it, answer it, stop it. The mission itself runs on the SERVER (src/lib/agent-mission.ts) and carries on when the app is closed.
export type MissionReply = MissionView | { error: string };
const json = (b: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

export async function startMissionRun(spec: MissionSpec): Promise<MissionReply> {
  const res = await fetch("/api/agent/missions", json({ goal: spec.goal, budget: spec.budget, autopilot: spec.autopilot, projectId: readCurrentProject()?.id }));
  const d = await res.json().catch(() => ({}));
  refreshCredits();
  return res.ok && typeof d.id === "string" ? d : { error: typeof d.error === "string" ? d.error : "The mission could not be started." };
}
/** Where a mission is now (asking also gives it a push). null when it cannot be read (offline); "gone" when it no longer exists. */
export async function readMission(id: string): Promise<MissionView | "gone" | null> {
  try {
    const res = await fetch(`/api/agent/missions/${id}`);
    if (res.status === 404) return "gone";
    const d = await res.json().catch(() => null);
    return res.ok && d?.id ? d : null;
  } catch { return null; }
}
export async function actOnMission(id: string, body: { action: "approve" | "decline" | "cancel" } | { action: "reply"; text: string }): Promise<MissionReply> {
  const res = await fetch(`/api/agent/missions/${id}`, json(body));
  const d = await res.json().catch(() => ({}));
  refreshCredits();
  return res.ok && typeof d.id === "string" ? d : { error: typeof d.error === "string" ? d.error : "That did not work. Try again." };
}
export async function listMissionsFor(): Promise<MissionView[]> {
  try {
    const res = await fetch("/api/agent/missions");
    const d = await res.json().catch(() => null);
    return res.ok && Array.isArray(d?.missions) ? d.missions : [];
  } catch { return []; }
}
