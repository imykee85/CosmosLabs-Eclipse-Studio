import { fmtCredits } from "./credit-units";
// Plans, packs and the welcome grant. `credits` everywhere in this file is in LEDGER units (tenths of a credit, see credit-units.ts): Starter's 2,000 is
// shown to people as 200 credits. One credit is worth $0.10 to the customer and pays for $0.04 of provider cost (a 2.5x markup, owner decision 2026-10-20).
// The free trial is 2 free image renders (src/lib/free-renders.ts), not credits.
export const freePlan = { id: "free", name: "Free", price: 0 } as const;

export type Plan = { id: string; name: string; price: number; credits: number; seats: number };

export const plans: Plan[] = [
  { id: "starter", name: "Starter", price: 19, credits: 2000, seats: 1 },
  { id: "growth", name: "Growth", price: 49, credits: 6000, seats: 3 },
  { id: "scale", name: "Scale", price: 199, credits: 25000, seats: 10 },
];

// Pay-as-you-go top-ups: one-time packs for subscribers whose credits run out before the plan renews, priced above any plan per credit (emergency use).
// The ids map to the payment provider's own one-time plans (Whop: WHOP_PLAN_TOPUP_500 and so on), whose price there must match this file.
export type CreditPack = { id: string; name: string; price: number; credits: number };

export const creditPacks: CreditPack[] = [
  { id: "topup_500", name: "50 credits", price: 6, credits: 500 },
  { id: "topup_2000", name: "200 credits", price: 22, credits: 2000 },
  { id: "topup_6000", name: "600 credits", price: 60, credits: 6000 },
];

// "Your own amount": the person picks how many credits, we work out the price. The price line runs through the three packs (so a custom amount never
// costs less per credit than a bigger pack) and continues below the smallest pack at its own rate. At least $9 of credits (the smallest whole-credit amount that
// reaches $9), at most the biggest pack. Whole credits only: the amount is a multiple of 10 ledger units.
export const CUSTOM_PACK_ID = "topup_custom";
export const CUSTOM_MIN_USD = 9;
export const CUSTOM_MAX_CREDITS = creditPacks[creditPacks.length - 1].credits;

export function linePrice(credits: number): number {
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

export const CUSTOM_MIN_CREDITS = (() => { let c = 10; while (c < CUSTOM_MAX_CREDITS && linePrice(c) < CUSTOM_MIN_USD) c += 10; return c; })();

/** The price in dollars (to the cent) of a custom amount of credits, or null when the amount is not a whole number of credits inside the allowed range. */
export function customPrice(credits: unknown): number | null {
  if (typeof credits !== "number" || !Number.isInteger(credits) || credits % 10 !== 0 || credits < CUSTOM_MIN_CREDITS || credits > CUSTOM_MAX_CREDITS) return null;
  return linePrice(credits);
}

/** What a payment can be for: a plan, a top-up pack or a custom amount of credits (pass `credits` for that). Credits granted come from here, never from the browser. */
export function productById(id: unknown, credits?: unknown): { id: string; credits: number; price: number; name: string; kind: "plan" | "pack" } | null {
  if (id === CUSTOM_PACK_ID) {
    const price = customPrice(credits);
    return price === null ? null : { id: CUSTOM_PACK_ID, credits: credits as number, price, name: `${fmtCredits(credits as number)} credits`, kind: "pack" };
  }
  const plan = plans.find((p) => p.id === id);
  if (plan) return { id: plan.id, credits: plan.credits, price: plan.price, name: plan.name, kind: "plan" };
  const pack = creditPacks.find((p) => p.id === id);
  return pack ? { id: pack.id, credits: pack.credits, price: pack.price, name: pack.name, kind: "pack" } : null;
}

export const AUTO_THRESHOLDS = [100, 250, 500, 1000] as const;
export const AUTO_MONTHLY_CAPS = [1, 3, 5, 10] as const;
