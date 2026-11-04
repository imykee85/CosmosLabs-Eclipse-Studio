import { db } from "@/lib/db";
import { deleteAccount } from "@/lib/account-delete";

// A team is a Clerk organization (workspace id "org_..."). When the team is deleted in Clerk, nothing told us, so its projects, files and credits stayed forever.
// This sweep (daily cron) finds team workspaces that Clerk no longer knows (answer 404, never any other error) and have been quiet for 30 days, and removes their
// data the same way a deleted account is removed (files first, then rows, subscription ended). At most 5 per run; a Clerk outage deletes nothing.
export type OrgLookup = (orgId: string) => Promise<"exists" | "gone" | "unknown">;

const QUIET_DAYS = 30;
const PER_RUN = 5;

async function clerkLookup(orgId: string): Promise<"exists" | "gone" | "unknown"> {
  if (!process.env.CLERK_SECRET_KEY) return "unknown";
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    await (await clerkClient()).organizations.getOrganization({ organizationId: orgId });
    return "exists";
  } catch (e) {
    return (e as { status?: number }).status === 404 ? "gone" : "unknown";
  }
}

export async function teamWorkspaces(): Promise<string[]> {
  const rows = await db.project.findMany({ where: { userId: { startsWith: "org_" } }, distinct: ["userId"], select: { userId: true } });
  const more = await db.creditLedger.findMany({ where: { userId: { startsWith: "org_" } }, distinct: ["userId"], select: { userId: true } });
  return [...new Set([...rows, ...more].map((r) => r.userId))];
}

async function quietSince(orgId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - QUIET_DAYS * 86_400_000);
  const [gen, ledger, project] = await Promise.all([
    db.generation.count({ where: { userId: orgId, updatedAt: { gte: cutoff } } }),
    db.creditLedger.count({ where: { userId: orgId, createdAt: { gte: cutoff } } }),
    db.project.count({ where: { userId: orgId, updatedAt: { gte: cutoff } } }),
  ]);
  return gen + ledger + project === 0;
}

export async function sweepDeletedTeams(lookup: OrgLookup = clerkLookup): Promise<{ checked: number; removed: string[] }> {
  const removed: string[] = [];
  const all = await teamWorkspaces();
  for (const orgId of all) {
    if (removed.length >= PER_RUN) break;
    if ((await lookup(orgId)) !== "gone") continue;
    if (!(await quietSince(orgId))) continue;
    const r = await deleteAccount(orgId, { closeSignIn: false });
    if (r.ok) removed.push(orgId); else console.error("team sweep: could not remove", orgId, r.error);
  }
  return { checked: all.length, removed };
}
