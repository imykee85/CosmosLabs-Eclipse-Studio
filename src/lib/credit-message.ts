import { fmtCredits } from "./credit-units";
// What a person sees when a job cannot start for lack of credits. Plain words, no provider or owner talk: they upgrade or top up themselves.
// Every number here is in ledger units (tenths of a credit) and shown as credits.
export function outOfCredits(what: string, cost: number, have: number, held = 0, usedFree = false, locked = 0): string {
  if (locked > 0 && have < cost) return `${what} needs ${fmtCredits(cost)} credits. Your ${fmtCredits(locked)} top-up credits are saved but locked until you subscribe to a plan.`;
  if (usedFree && have <= 0) return "You've used your free images. Upgrade your plan to keep creating.";
  return `${what} needs ${fmtCredits(cost)} credits. You have ${fmtCredits(Math.max(0, have))}${held ? `, and ${fmtCredits(held)} are held by work still running` : ""}. Upgrade your plan or top up in Settings, Billing.`;
}
