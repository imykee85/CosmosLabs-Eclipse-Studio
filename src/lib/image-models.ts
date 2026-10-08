// Image models the app can generate with. Shared by the pickers (client) and the generate route (server).
// `path` and `resolution` are what the Higgsfield REST call needs; both can be overridden per model with
// HIGGSFIELD_PATH_<ID> and HIGGSFIELD_RESOLUTION_<ID> (id upper-cased, e.g. HIGGSFIELD_PATH_NANO_BANANA_PRO).
// Only soul_2 has been run against the live API. The other two paths are best guesses and UNVERIFIED.
// Supported shapes follow Higgsfield's model catalog; the resolution is the cheapest tier.

export const APP_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;

export type ImageModel = {
  id: string;
  label: string;
  blurb: string;
  path: string;
  resolution?: string;
  ratios: string[];
};

export const IMAGE_MODELS: ImageModel[] = [
  { id: "soul_2", label: "Soul 2", blurb: "Realistic people and fashion. Cheapest.", path: "higgsfield-ai/soul/v2/standard", resolution: "720p", ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] },
  { id: "nano_banana_pro", label: "Nano Banana Pro", blurb: "Top quality, sharp text and diagrams.", path: "google/nano-banana-pro", resolution: "1k", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"] },
  { id: "seedream_v5_pro", label: "Seedream 5.0 Pro", blurb: "Strong instruction following, up to 2K.", path: "bytedance/seedream/v5/pro/text-to-image", resolution: "1k", ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"] },
];

export const DEFAULT_MODEL_ID = "soul_2";
export const MODEL_STORAGE_KEY = "eclipse-image-model";

export function getModel(id: unknown): ImageModel {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];
}

// The model's closest supported shape for a requested one (e.g. 4:5 becomes 3:4 on Soul 2).
export function nearestRatio(model: ImageModel, wanted: string): string {
  if (model.ratios.includes(wanted)) return wanted;
  const value = (r: string) => { const [w, h] = r.split(":").map(Number); return w / h; };
  const target = value(wanted);
  return model.ratios.reduce((best, r) => (Math.abs(value(r) - target) < Math.abs(value(best) - target) ? r : best), model.ratios[0]);
}
