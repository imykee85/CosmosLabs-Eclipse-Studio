import { auth } from "@clerk/nextjs/server";

// A person works either in their PERSONAL workspace or, when a team (a Clerk organization) is active, in the TEAM workspace. Everything made
// in a workspace (projects, renders, uploads, canvases, voice takes, credits) is stored under the workspace id: the person's own user id for
// the personal one, the organization id for a team. Every member of the team therefore sees, uses and pays from the same things.
// Personal-only data (Core chats, memory, connected apps, API keys, portfolio, certificates, the account itself) stays under the person's id.
// The organization id comes from the signed session, so a person can only ever act in a team they really belong to.

export type WorkspaceSession = {
  /** The signed-in person (null when signed out). */
  personId: string | null;
  /** Where their work lives: the active team's id, else their own id (null when signed out). */
  workspaceId: string | null;
  isTeam: boolean;
  /** Personal workspace: always true. Team: only team admins (they manage billing and members). */
  isAdmin: boolean;
};

export function resolveWorkspace(a: { userId?: string | null; orgId?: string | null; orgRole?: string | null }): WorkspaceSession {
  const personId = a.userId ?? null;
  if (!personId) return { personId: null, workspaceId: null, isTeam: false, isAdmin: false };
  if (a.orgId) return { personId, workspaceId: a.orgId, isTeam: true, isAdmin: a.orgRole === "org:admin" };
  return { personId, workspaceId: personId, isTeam: false, isAdmin: true };
}

export async function workspaceSession(): Promise<WorkspaceSession> {
  return resolveWorkspace(await auth());
}

export const NOT_TEAM_ADMIN = "Only a team admin can do this. Ask one of your team's admins.";
