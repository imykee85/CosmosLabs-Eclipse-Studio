import { toCredits } from "./credit-units";
import { plans, type Plan } from "./plans";

// The wording around a plan's price (pricing psychology, owner decision 2026-10-20): what the credits buy, and how much cheaper a credit is than on Starter.
// A plain image costs 1 credit; the video yardstick is Seedance 2.5 on the DIRECT route, 5 seconds, 720p, sound on = 21 credits at the master brief's video price
// (1.8x, section 5; owner 2026-10-21 replaced the Kling yardstick). A unit test checks this number against the real price table.
export const SEEDANCE_YARDSTICK_CREDITS = 21;

const n = (v: number) => v.toLocaleString("en-US");

/** "≈ 200 images or 9 Seedance videos". */
export function planValue(plan: Plan): string {
  const credits = toCredits(plan.credits);
  return `≈ ${n(credits)} images or ${n(Math.floor(credits / SEEDANCE_YARDSTICK_CREDITS))} Seedance videos`;
}

/** Whole percent a credit is cheaper than on the first (smallest) plan; 0 for the first plan itself. */
export function planSaving(plan: Plan): number {
  const base = plans[0];
  return Math.round((1 - plan.price / plan.credits / (base.price / base.credits)) * 100);
}

/** The pack shown with "Best value": the biggest one (the lowest price per credit). */
export const BEST_VALUE_PACK_ID = "topup_10000";

/** The plan highlighted as the middle, larger card. */
export const POPULAR_PLAN_ID = "growth";
