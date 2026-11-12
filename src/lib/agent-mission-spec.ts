// Atlas missions (Scale): browser-safe types and cleaning. The engine is src/lib/agent-mission.ts.
export type MissionSpec = { goal: string; budget: number; autopilot: boolean }; // budget in CREDITS (what Atlas may commit without asking again when autopilot is on)
export type MissionStatus = "running" | "waiting_approval" | "waiting_user" | "done" | "failed" | "canceled";
export type TraceKind = "note" | "say" | "tool" | "result" | "approval" | "error";
export type TraceItem = { at: string; kind: TraceKind; text: string; ids?: string[] };
export type MissionCall = { id: string; tool: string; summary: string; price: number | null };
export type MissionView = {
  id: string; goal: string; status: MissionStatus; createdAt: string; trace: TraceItem[]; summary?: string;
  committed: number; budget: number; autopilot: boolean; // ledger units
  waiting?: { kind: "approval" | "question" | "chat"; question?: string; calls?: MissionCall[]; total?: number | null };
};

export const MAX_GOAL = 2000;
export const MAX_BUDGET_CREDITS = 5000;
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** What Atlas proposed (propose_mission), cleaned: a goal and how much it may commit on its own. */
export function cleanMission(i: unknown): MissionSpec | null {
  const o = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
  const goal = clip(o.goal, MAX_GOAL);
  if (goal.length < 8) return null;
  const b = Number(o.budget_credits);
  const budget = Number.isFinite(b) && b > 0 ? Math.min(Math.floor(b), MAX_BUDGET_CREDITS) : 0;
  return { goal, budget, autopilot: o.autopilot === true && budget > 0 };
}
