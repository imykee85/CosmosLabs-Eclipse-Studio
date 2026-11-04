import type { PublicModel } from "./models";
import { imageCost, tierResolution } from "./image-render";
import { toolModel, toolTier } from "./picture-tools";
import { capsFor, isLive, videoModelById, videoPrice, workflowFor } from "./video-models";
import { newPlan, type PlanSpec, type PlanState } from "./agent-plan";

// The settings an Atlas plan runs with, worked out ONCE from the models this account can use. Pure, so the browser (the price on the card) and the server (the run) agree.
const VIDEO_MODEL = "seedance_2_5";
export type PlanSetup = { modelId: string; tier: string; resolution?: string; ratio: string; vmodelId: string; quality: string; seconds: number; vratio: string; pictures: number; route: "direct" | "higgsfield"; creditsOn: boolean };

/** How many scene pictures the video can take beside the hero. */
export const sceneLimit = (refMax: number, scenes: number) => Math.max(0, Math.min(scenes, refMax - 1));

export function planSetup(spec: PlanSpec, models: PublicModel[], direct: string[], creditsOn: boolean): PlanSetup | string {
  const model = toolModel(models, "camera");
  if (!model) return "No picture model is available on this account.";
  const vm = videoModelById(VIDEO_MODEL);
  if (!vm || !isLive(vm)) return "The video model for plans is not available right now.";
  const caps = capsFor(vm, workflowFor(vm, false, true));
  if (caps.refMax < 2) return "The video model for plans cannot take reference pictures right now.";
  const tier = toolTier(model, "camera");
  const quality = caps.qualities.includes("720p") ? "720p" : caps.defaultQuality;
  const seconds = caps.durations.reduce((best, d) => (Math.abs(d - spec.seconds) < Math.abs(best - spec.seconds) ? d : best), caps.durations[0]);
  return {
    modelId: model.id, tier, resolution: model.resolutions.length ? tierResolution(model.resolutions, tier) : undefined, ratio: model.ratios.includes(spec.ratio) ? spec.ratio : "auto",
    vmodelId: vm.id, quality, seconds, vratio: caps.ratios.includes(spec.ratio) ? spec.ratio : caps.defaultRatio, pictures: 1 + sceneLimit(caps.refMax, spec.scenes.length),
    route: direct.includes(vm.id) ? "direct" : "higgsfield", creditsOn,
  };
}

/** The plan as the card shows it: trimmed to what the models take, with the total price in ledger units (null while credits are off or a price is missing). */
export function quoteWith(spec: PlanSpec, s: PlanSetup | string, models: PublicModel[]): PlanState {
  if (typeof s === "string") return { ...newPlan(spec, null), note: s };
  const model = models.find((m) => m.id === s.modelId);
  const img = imageCost(model, s.resolution, 1);
  const vid = videoPrice(videoModelById(s.vmodelId)!, s.quality, s.seconds, false, s.route);
  return newPlan({ ...spec, scenes: spec.scenes.slice(0, s.pictures - 1), seconds: s.seconds, ratio: s.vratio }, s.creditsOn && img != null && vid != null ? img * s.pictures + vid : null);
}
