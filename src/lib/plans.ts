// PLACEHOLDER plans: names, prices and credit amounts are not final. Edit them here once pricing is decided.
export type Plan = { id: string; name: string; price: number; credits: number; seats: number };

export const plans: Plan[] = [
  { id: "starter", name: "Starter", price: 19, credits: 1000, seats: 1 },
  { id: "growth", name: "Growth", price: 49, credits: 5000, seats: 3 },
  { id: "scale", name: "Scale", price: 199, credits: 25000, seats: 10 },
];

// Pay-as-you-go top-ups: one-time packs anyone can buy when their credits run out before the plan renews. PLACEHOLDER prices, a little dearer per
// credit than any plan on purpose. The ids map to the payment provider's own one-time plans (Whop: WHOP_PLAN_TOPUP_500 and so on).
export type CreditPack = { id: string; name: string; price: number; credits: number };

export const creditPacks: CreditPack[] = [
  { id: "topup_500", name: "500 credits", price: 12, credits: 500 },
  { id: "topup_2000", name: "2,000 credits", price: 42, credits: 2000 },
  { id: "topup_6000", name: "6,000 credits", price: 120, credits: 6000 },
];

/** What a payment can be for: a plan or a top-up pack. Credits granted come from here, never from the browser. */
export function productById(id: unknown): { id: string; credits: number; price: number; name: string; kind: "plan" | "pack" } | null {
  const plan = plans.find((p) => p.id === id);
  if (plan) return { id: plan.id, credits: plan.credits, price: plan.price, name: plan.name, kind: "plan" };
  const pack = creditPacks.find((p) => p.id === id);
  return pack ? { id: pack.id, credits: pack.credits, price: pack.price, name: pack.name, kind: "pack" } : null;
}

export const AUTO_THRESHOLDS = [100, 250, 500, 1000] as const;
export const AUTO_MONTHLY_CAPS = [1, 3, 5, 10] as const;
