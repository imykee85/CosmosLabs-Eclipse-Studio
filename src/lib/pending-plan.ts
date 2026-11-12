// A plan picked on the homepage before the person has an account: remembered in this browser through sign-up and onboarding, then used to open its
// checkout straight away (/start-plan). Only the three plan ids are ever stored.
const KEY = "eclipse-pending-plan";
export const PLAN_IDS = ["starter", "growth", "scale"] as const;
export const asPlanId = (v: unknown): (typeof PLAN_IDS)[number] | null => (typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v) ? (v as (typeof PLAN_IDS)[number]) : null);
export function rememberPlan(id: string) { const p = asPlanId(id); if (!p) return; try { localStorage.setItem(KEY, p); } catch {} }
export function pendingPlan(): (typeof PLAN_IDS)[number] | null { try { return asPlanId(localStorage.getItem(KEY)); } catch { return null; } }
export function clearPendingPlan() { try { localStorage.removeItem(KEY); } catch {} }
/** Where to go after sign-up or sign-in: the plan's checkout when one is waiting, else `fallback`. */
export const afterAuthPath = (fallback: string) => (pendingPlan() ? "/start-plan" : fallback);
