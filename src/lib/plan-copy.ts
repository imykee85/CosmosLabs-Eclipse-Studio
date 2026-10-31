import { toCredits } from "./credit-units";
import { plans, type Plan } from "./plans";

// The wording around a plan's price (owner 2026-10-31): what the credits buy at the model makers' own prices. Yardsticks: a 5-second Seedance 2.5 clip at 480p
// (direct route, no sound) and a Nano Banana 2.1 image at 1K. A unit test checks both numbers against the real price tables, so a price change fails it
// until these are updated.
export const SEEDANCE_CLIP_CREDITS = 5.4;
export const IMAGE_YARDSTICK_CREDITS = 0.4;

const n = (v: number) => v.toLocaleString("en-US");

/** "about 27 Seedance 2.5 clips or 375 images". */
export function planValue(plan: Plan): string {
  const credits = toCredits(plan.credits);
  return `about ${n(Math.floor(credits / SEEDANCE_CLIP_CREDITS))} Seedance 2.5 clips or ${n(Math.floor(credits / IMAGE_YARDSTICK_CREDITS))} images`;
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
