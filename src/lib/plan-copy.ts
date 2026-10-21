import { toCredits } from "./credit-units";
import { plans, type Plan } from "./plans";

// The wording around a plan's price (owner 2026-10-21): what the credits buy if every credit goes on the CHEAPEST model. Cheapest image = 1 credit (Soul 2),
// cheapest video = 4 credits (5 s, no sound, default quality: Kling 2.5 Turbo Standard, PixVerse V6, Seedance 2.0 Mini). A unit test checks both numbers
// against the real price tables, so a price change fails it until these are updated.
export const CHEAPEST_IMAGE_CREDITS = 1;
export const CHEAPEST_VIDEO_CREDITS = 4;

const n = (v: number) => v.toLocaleString("en-US");

/** "200 images or 50 videos". */
export function planValue(plan: Plan): string {
  const credits = toCredits(plan.credits);
  return `${n(Math.floor(credits / CHEAPEST_IMAGE_CREDITS))} images or ${n(Math.floor(credits / CHEAPEST_VIDEO_CREDITS))} videos`;
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
