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

// "Your own amount": the person picks how many credits, we work out the price. The price line runs through the three packs (so a custom amount never
// costs less per credit than a bigger pack) and continues below the smallest pack at its own rate. At least $9 of credits, at most the biggest pack.
export const CUSTOM_PACK_ID = "topup_custom";
export const CUSTOM_MIN_USD = 9;
export const CUSTOM_MAX_CREDITS = creditPacks[creditPacks.length - 1].credits;
export const CUSTOM_MIN_CREDITS = Math.ceil(CUSTOM_MIN_USD / (creditPacks[0].price / creditPacks[0].credits));

/** The price in dollars (to the cent) of a custom amount of credits, or null when the amount is not a whole number inside the allowed range. */
export function customPrice(credits: unknown): number | null {
  if (typeof credits !== "number" || !Number.isInteger(credits) || credits < CUSTOM_MIN_CREDITS || credits > CUSTOM_MAX_CREDITS) return null;
  const pts = creditPacks;
  let price: number;
  if (credits <= pts[0].credits) price = (credits * pts[0].price) / pts[0].credits;
  else {
    let i = 1;
    while (i < pts.length - 1 && credits > pts[i].credits) i++;
    const a = pts[i - 1], b = pts[i];
    price = a.price + ((credits - a.credits) * (b.price - a.price)) / (b.credits - a.credits);
  }
  return Math.round(price * 100) / 100;
}

/** What a payment can be for: a plan, a top-up pack or a custom amount of credits (pass `credits` for that). Credits granted come from here, never from the browser. */
export function productById(id: unknown, credits?: unknown): { id: string; credits: number; price: number; name: string; kind: "plan" | "pack" } | null {
  if (id === CUSTOM_PACK_ID) {
    const price = customPrice(credits);
    return price === null ? null : { id: CUSTOM_PACK_ID, credits: credits as number, price, name: `${(credits as number).toLocaleString("en-US")} credits`, kind: "pack" };
  }
  const plan = plans.find((p) => p.id === id);
  if (plan) return { id: plan.id, credits: plan.credits, price: plan.price, name: plan.name, kind: "plan" };
  const pack = creditPacks.find((p) => p.id === id);
  return pack ? { id: pack.id, credits: pack.credits, price: pack.price, name: pack.name, kind: "pack" } : null;
}

export const AUTO_THRESHOLDS = [100, 250, 500, 1000] as const;
export const AUTO_MONTHLY_CAPS = [1, 3, 5, 10] as const;
