// What a person sees when a job cannot start for lack of credits. Plain words, no provider or owner talk: they upgrade or top up themselves.
export function outOfCredits(what: string, cost: number, have: number, held = 0, usedFree = false, locked = 0): string {
  if (locked > 0 && have < cost) return `${what} needs ${cost} credits. Your ${locked.toLocaleString("en-US")} top-up credits are saved but locked until you subscribe to a plan.`;
  if (usedFree && have <= 0) return "You've used your free images. Upgrade your plan to keep creating.";
  return `${what} needs ${cost} credits. You have ${have}${held ? `, and ${held} are held by work still running` : ""}. Upgrade your plan or top up in Settings, Billing.`;
}
