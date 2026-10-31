import type { VideoModel } from "./video-models";
import type { PlanId } from "./access-table";

// Which plan can use which video model and quality (owner 2026-10-31): by the model maker's own cost per second at the chosen quality (the price the person is
// charged, no sound). Starter: up to $0.15 a second. Growth: up to $0.40. Scale: everything. Images are open to every plan. Safe for the browser and the server.
export const STARTER_MAX_PER_SECOND = 0.15;
export const GROWTH_MAX_PER_SECOND = 0.4;

/** The maker's cost per second for this model at this quality (direct price where the model has one), or null for a model with no price table. */
export function videoCostPerSecond(m: VideoModel, resolution: string | undefined): number | null {
  const p = m.live?.price;
  if (!p) return null;
  const table = p.directUsd && p.directUsd[resolution ?? "default"] != null ? p.directUsd : p.usd;
  const key = resolution && table[resolution] != null ? resolution : table.default != null ? "default" : Object.keys(table)[0];
  return key != null && table[key] != null ? table[key] : null;
}

/** The cheapest plan that includes this model at this quality. A model with no price is left to Scale. */
export function videoTierFor(m: VideoModel, resolution: string | undefined): PlanId {
  const c = videoCostPerSecond(m, resolution);
  if (c == null) return "scale";
  if (c <= STARTER_MAX_PER_SECOND + 1e-9) return "starter";
  if (c <= GROWTH_MAX_PER_SECOND + 1e-9) return "growth";
  return "scale";
}

/** The cheapest plan that includes ANY quality of this model (what a model row in the picker shows). */
export function videoMinTier(m: VideoModel): PlanId {
  const p = m.live?.price;
  if (!p) return "scale";
  const order: PlanId[] = ["starter", "growth", "scale"];
  let best: PlanId = "scale";
  for (const key of Object.keys(p.usd)) { const t = videoTierFor(m, key === "default" ? undefined : key); if (order.indexOf(t) < order.indexOf(best)) best = t; }
  return best;
}
