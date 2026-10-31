import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { currentPlanName } from "@/lib/subscription";
import { workspaceSession } from "@/lib/workspace";
import { ATLAS_DAILY_STARTER_DEFAULT, CORE_DAILY_GROWTH_DEFAULT, FEATURE_MIN, PLAN_NAME, planAllows, upgradeText, type Feature, type PlanId } from "@/lib/access-table";

// The server side of who can use what (table in access-table.ts). A workspace's plan comes from its own ledger (the latest recent plan payment), so a team
// uses the team's plan. The owner (ADMIN_EMAILS) is always treated as Scale, and the owner can give any account a plan by hand (BillingSettings.planOverride,
// set in /admin/credits). PLAN_GATING=off (Config value) switches every plan check off at once: an emergency stop, nothing is locked.
export const gatingOn = () => process.env.PLAN_GATING !== "off";

const PLANS: PlanId[] = ["free", "starter", "growth", "scale"];
export const asPlan = (v: unknown): PlanId | null => (typeof v === "string" && (PLANS as string[]).includes(v) ? (v as PlanId) : null);

/** The plan a workspace is on right now: a hand-given plan first, else the latest recent plan payment, else free. */
export async function planOf(workspaceId: string): Promise<PlanId> {
  const given = asPlan((await db.billingSettings.findUnique({ where: { userId: workspaceId }, select: { planOverride: true } }))?.planOverride);
  if (given) return given;
  const name = (await currentPlanName(workspaceId))?.toLowerCase();
  return asPlan(name) ?? "free";
}

// Is this person one of the owners? Checked through Clerk by id (not the current session), remembered for five minutes so a chat does not call Clerk every time.
const adminCache = new Map<string, { at: number; admin: boolean }>();
export async function isAdminPerson(personId: string): Promise<boolean> {
  if (!clerkEnabled) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return false;
  const hit = adminCache.get(personId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.admin;
  let admin = false;
  try {
    const u = await (await clerkClient()).users.getUser(personId);
    admin = u.emailAddresses.some((e) => e.verification?.status === "verified" && list.includes(e.emailAddress.toLowerCase()));
  } catch { admin = false; }
  adminCache.set(personId, { at: Date.now(), admin });
  return admin;
}

export type Access = { plan: PlanId; admin: boolean };
/** The plan that applies to this person's current workspace (the owner counts as Scale). */
export async function accessFor(workspaceId: string, personId: string | null): Promise<Access> {
  if (!gatingOn()) return { plan: "scale", admin: false };
  const plan = await planOf(workspaceId);
  if (plan === "scale") return { plan, admin: false };
  if (personId && (await isAdminPerson(personId))) return { plan: "scale", admin: true };
  return { plan, admin: false };
}

export const upgradeBody = (feature: Feature, plan: PlanId) => ({ error: `${upgradeText(feature)} Upgrade to use it.`, code: "UPGRADE", feature, need: FEATURE_MIN[feature], plan });

/** For a route that has the person's session: null when the feature is allowed (or nobody is signed in: the route answers 401 itself), else the 402 answer to send. */
export async function gateFeature(feature: Feature): Promise<NextResponse | null> {
  if (!clerkEnabled || !gatingOn()) return null;
  const w = await workspaceSession();
  if (!w.workspaceId) return null;
  const a = await accessFor(w.workspaceId, w.personId);
  return planAllows(a.plan, feature) ? null : NextResponse.json(upgradeBody(feature, a.plan), { status: 402 });
}

/** Same for a person known only by id (an API key). Personal workspace. */
export async function gateFeatureFor(personId: string, feature: Feature): Promise<{ ok: true } | { ok: false; status: number; body: ReturnType<typeof upgradeBody> }> {
  if (!gatingOn()) return { ok: true };
  const a = await accessFor(personId, personId);
  return planAllows(a.plan, feature) ? { ok: true } : { ok: false, status: 402, body: upgradeBody(feature, a.plan) };
}

/** Daily Core messages for a plan: null = no limit (Scale, the owner). Growth gets a large number (Config CORE_DAILY_MESSAGES_GROWTH). */
export function coreDailyLimit(a: Access): number | null {
  if (a.admin || a.plan === "scale") return null;
  const n = Number(process.env.CORE_DAILY_MESSAGES_GROWTH);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : CORE_DAILY_GROWTH_DEFAULT;
}

/** Daily Atlas messages for a plan: only Starter has a limit (Config ATLAS_DAILY_MESSAGES_STARTER, 30 by default); null = no limit. */
export function atlasDailyLimit(a: Access): number | null {
  if (a.admin || a.plan !== "starter") return null;
  const n = Number(process.env.ATLAS_DAILY_MESSAGES_STARTER);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : ATLAS_DAILY_STARTER_DEFAULT;
}

export const planLabel = (p: PlanId) => PLAN_NAME[p];
