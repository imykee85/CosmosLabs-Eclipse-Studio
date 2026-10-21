import { plans } from "./plans";

// A team's member limit follows its plan (Starter 1, Growth 3, Scale 10 seats, src/lib/plans.ts): when a plan payment lands on a TEAM workspace (an
// "org_..." id) the Clerk organization's `maxAllowedMemberships` is set to the plan's seats, so Clerk itself refuses invitations beyond it. Never throws:
// a payment must not fail because Clerk could not be reached; the failure is logged and the next plan payment tries again.
export type SeatClient = { setMaxMembers(orgId: string, max: number): Promise<void> };

async function clerkSeatClient(): Promise<SeatClient | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const { clerkClient } = await import("@clerk/nextjs/server");
  const clerk = await clerkClient();
  return { setMaxMembers: async (orgId, max) => { await clerk.organizations.updateOrganization(orgId, { maxAllowedMemberships: max }); } };
}

/** The seats of a plan id, or null for anything that is not a plan. */
export const seatsFor = (planId: string): number | null => plans.find((p) => p.id === planId)?.seats ?? null;

export async function syncTeamSeats(workspaceId: string, planId: string, client?: SeatClient | null): Promise<"set" | "skipped" | "failed"> {
  const seats = seatsFor(planId);
  if (!workspaceId.startsWith("org_") || seats === null) return "skipped";
  try {
    const c = client === undefined ? await clerkSeatClient() : client;
    if (!c) return "skipped";
    await c.setMaxMembers(workspaceId, seats);
    return "set";
  } catch (e) {
    console.error("TEAM SEATS: could not set the member limit", workspaceId, planId, e instanceof Error ? e.message : e);
    return "failed";
  }
}
