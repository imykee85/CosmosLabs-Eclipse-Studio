import { toCredits } from "./credit-units";
import { plans, type Plan } from "./plans";

// The wording around a plan's price (pricing psychology, owner decision 2026-10-20): what the credits buy, and how much cheaper a credit is than on Starter.
// A plain image costs 1 credit; the video yardstick is Kling 3.0 Pro, 5 seconds, sound on = 16 credits at the master brief's video price (1.8x, section 5). The video
// prices themselves arrive in batch 3; a unit test then checks this number against the real price table.
export const KLING_YARDSTICK_CREDITS = 16;

const n = (v: number) => v.toLocaleString("en-US");

/** "≈ 200 images or 9 Kling videos". */
export function planValue(plan: Plan): string {
  const credits = toCredits(plan.credits);
  return `≈ ${n(credits)} images or ${n(Math.floor(credits / KLING_YARDSTICK_CREDITS))} Kling videos`;
}

/** Whole percent a credit is cheaper than on the first (smallest) plan; 0 for the first plan itself. */
export function planSaving(plan: Plan): number {
  const base = plans[0];
  return Math.round((1 - plan.price / plan.credits / (base.price / base.credits)) * 100);
}

/** The pack shown with "Best value": the biggest one (the lowest price per credit). */
export const BEST_VALUE_PACK_ID = "topup_6000";

/** The plan highlighted as the middle, larger card. */
export const POPULAR_PLAN_ID = "growth";
