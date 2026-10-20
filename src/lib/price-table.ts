import { creditsForUsd, CREDIT_PROVIDER_USD } from "./price-constants";
import { imageCredits, allImageModels } from "./models";
import { plans } from "./plans";
import { toCredits } from "./credit-units";
import { VIDEO_MODELS, videoCredits, type VideoModel } from "./video-models";
import { DIRECT_KEY, routeSetting, routeFor } from "./routes";

// The owner's price check (/admin/pricing): every priced model and setting with the provider's list cost, the credits charged, and the margin at what a credit
// really earns on each plan (plan price less the payment fee, 6.2% + $0.30, divided by the plan's credits). Pure data; the page only draws it.
export const FEE_PERCENT = 0.062;
export const FEE_FIXED_USD = 0.3;

/** What one credit earns on a plan after the payment fee, in dollars. */
export const netPerCredit = (plan: { price: number; credits: number }): number => (plan.price * (1 - FEE_PERCENT) - FEE_FIXED_USD) / toCredits(plan.credits);

export type PriceRow = {
  kind: "image" | "video";
  model: string;      // Eclipse's id
  label: string;
  setting: string;    // resolution, "5 s, sound on", ...
  route: "higgsfield" | "direct";
  usd: number;        // provider list cost of what the credits pay for (one image, one batch of images, or a 5 second clip)
  credits: number;    // whole credits charged for it
  estimate: boolean;  // marked Estimate in the owner's workbook, not a confirmed list price
  margin: Record<string, number>;  // plan id -> gross margin 0..1 if all of that plan's credits are used on this
  note?: string;
};

const margins = (usd: number, credits: number): Record<string, number> =>
  Object.fromEntries(plans.map((p) => [p.id, 1 - usd / (credits * netPerCredit(p))]));

export function imageRows(): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const m of allImageModels()) {
    for (const [key, usd] of Object.entries(m.usd)) {
      const res = key === "default" ? undefined : key;
      const batch = m.batch ?? 1;
      const credits = imageCredits(m, res, "higgsfield")!;
      rows.push({ kind: "image", model: m.id, label: m.label, setting: key === "default" ? "any" : key, route: "higgsfield", usd: usd * batch, credits, estimate: Boolean(m.estimate?.includes(key)), margin: margins(usd * batch, credits), note: batch > 1 ? `${batch} images for one credit` : m.enabled ? undefined : "switched off" });
      if (m.directUsd?.[key] != null) {
        const dc = imageCredits(m, res, "direct")!;
        rows.push({ kind: "image", model: m.id, label: m.label, setting: `${key === "default" ? "any" : key} (direct)`, route: "direct", usd: m.directUsd[key], credits: dc, estimate: true, margin: margins(m.directUsd[key], dc), note: routeFor(m.id) === "direct" ? "in use" : routeSetting(m.id) === "direct" ? "set, but not available yet" : "not in use" });
      }
    }
  }
  return rows;
}

/** A 5 second clip is the yardstick for video: the cost and the credits are for 5 s (the price of any other length rounds once, for the whole clip). */
export const YARDSTICK_SECONDS = 5;

export function videoRows(models: VideoModel[] = VIDEO_MODELS): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const m of models) {
    const l = m.live;
    if (!l) continue;
    for (const key of Object.keys(l.price.usd)) {
      const res = key === "default" ? undefined : key;
      for (const sound of l.price.usdAudio && l.audio ? [false, true] : [false]) {
        const table = sound ? l.price.usdAudio! : l.price.usd;
        const perSecond = table[key] ?? l.price.usd[key];
        const credits = videoCredits(m, res, YARDSTICK_SECONDS, sound, "higgsfield")!;
        const est = l.price.estimate ?? [];
        rows.push({ kind: "video", model: m.id, label: m.label, setting: `${key === "default" ? "any" : key}${sound ? ", sound on" : l.price.usdAudio ? ", sound off" : ""}`, route: "higgsfield", usd: perSecond * YARDSTICK_SECONDS, credits, estimate: est.includes(key) || (sound && est.includes("audio")), margin: margins(perSecond * YARDSTICK_SECONDS, credits), note: m.hidden ? "per second of the motion clip" : undefined });
      }
      if (l.price.directUsd?.[key] != null) {
        const credits = videoCredits(m, res, YARDSTICK_SECONDS, false, "direct")!;
        rows.push({ kind: "video", model: m.id, label: m.label, setting: `${key} (direct)`, route: "direct", usd: l.price.directUsd[key] * YARDSTICK_SECONDS, credits, estimate: true, margin: margins(l.price.directUsd[key] * YARDSTICK_SECONDS, credits), note: routeFor(m.id) === "direct" ? "in use" : routeSetting(m.id) === "direct" ? "set, but not available yet" : "not in use" });
      }
    }
  }
  return rows;
}

export const allPriceRows = (): PriceRow[] => [...imageRows(), ...videoRows()];

/** The direct routes and the key each one needs, for the page. */
export const directRouteList = () => Object.entries(DIRECT_KEY).map(([model, key]) => ({ model, key, set: Boolean(process.env[key]), setting: routeSetting(model), using: routeFor(model) }));

export { creditsForUsd, CREDIT_PROVIDER_USD };
