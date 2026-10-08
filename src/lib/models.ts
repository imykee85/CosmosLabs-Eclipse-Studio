// The one list of image models. Each entry maps to a real Higgsfield endpoint; nothing falls back to another model.
// The Create page and the Canvas build their pickers from /api/models, which returns only enabled entries.
//
// `verified` means a real render passed through this app. Only soul_v2 has. The other endpoint ids come from the
// Higgsfield image catalog; their request pages could not be read from the build sandbox, so their ratios, resolutions
// and body fields are best guesses. They stay disabled until tested: set HIGGSFIELD_ENABLED_MODELS in Vercel
// (comma-separated ids, e.g. soul_cinema,grok_image_2) to switch one on, try it in the picker, and keep it only if it passes.
// HIGGSFIELD_ENDPOINT_<ID> (id upper-cased) overrides an endpoint without a code change.

export type ImageModel = {
  id: string;
  label: string;
  blurb: string;
  type: "image";
  endpoint: string;
  ratios: string[];
  resolutions: string[];       // empty: the model takes no resolution field
  defaultResolution?: string;  // the cheapest tier, sent when the request names none
  maxBatch: number;
  maxReferences: number;       // reference images the model accepts (none are sent yet)
  requiresReference: boolean;  // needs an input image; kept out of the pickers until the app can send one
  extraBody?: Record<string, unknown>;  // fixed fields sent with every request (e.g. the cheapest quality tier)
  enabled: boolean;
  verified: boolean;
  estimatedCostUsd: number | null;  // blank until measured from real generations
  creditCost: number | null;        // credits charged per render; null = free for now, no credit check
};

const SOUL_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const WIDE = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];

function m(p: Partial<ImageModel> & Pick<ImageModel, "id" | "label" | "blurb" | "endpoint" | "ratios">): ImageModel {
  return { type: "image", resolutions: [], maxBatch: 1, maxReferences: 0, requiresReference: false, enabled: false, verified: false, estimatedCostUsd: null, creditCost: null, ...p };
}

export const MODELS: ImageModel[] = [
  m({ id: "soul_v2", label: "Soul 2", blurb: "Realistic people and fashion.", endpoint: "higgsfield-ai/soul/v2/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4, maxReferences: 0, enabled: true, verified: true }),
  // soul: request page read (same fields as Soul 2: 720p/1080p, batch 1 or 4, the 7 shapes above); not yet test-rendered.
  m({ id: "soul", label: "Soul", blurb: "The first Soul model.", endpoint: "higgsfield-ai/soul/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  // soul_cinema: request page read (fixed style, the 7 Soul shapes, 720p/1080p, batch 1 or 4; 21:9 is NOT accepted); not yet test-rendered.
  m({ id: "soul_cinema", label: "Soul Cinema", blurb: "Cinema-grade stills and concept art.", endpoint: "higgsfield-ai/soul/cinema", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  m({ id: "marketing_studio_image", label: "Marketing Studio Image", blurb: "Product and campaign visuals.", endpoint: "marketing-studio/image", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k" }),
  m({ id: "marketing_studio_image_flare", label: "Marketing Studio Flare", blurb: "Marketing Studio Image, Flare variant.", endpoint: "marketing-studio/image/flare", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k" }),
  m({ id: "marketing_studio_image_sunburst", label: "Marketing Studio Sunburst", blurb: "Marketing Studio Image, Sunburst variant.", endpoint: "marketing-studio/image/sunburst", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k" }),
  m({ id: "ads_studio", label: "Ads Studio", blurb: "Ad creatives.", endpoint: "higgsfield/ads-studio/v1.0", ratios: ["1:1", "4:5", "9:16", "16:9"] }),
  // grok_image_2: request page read (text-to-image when no image_urls are sent; 1k/2k; quality low or medium; one image per request). "auto" shape left out of the picker. Sent at quality "low", the cheapest tier. Not yet test-rendered.
  m({ id: "grok_image_2", label: "Grok Image 2.0", blurb: "Fast, flexible image generation.", endpoint: "xai/grok-imagine-image-2.0", ratios: ["1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], resolutions: ["1k", "2k"], defaultResolution: "1k", extraBody: { quality: "low" } }),
  m({ id: "recraft_v4_1", label: "Recraft V4.1", blurb: "Illustration and design, 1K.", endpoint: "recraft/v4.1/text-to-image", ratios: ["1:1", "3:4", "4:3", "4:5", "5:4", "3:2", "2:3", "16:9", "9:16"] }),
  m({ id: "recraft_v4_1_pro", label: "Recraft V4.1 Pro", blurb: "Recraft V4.1 at 2K.", endpoint: "recraft/v4.1/pro/text-to-image", ratios: ["1:1", "3:4", "4:3", "4:5", "5:4", "3:2", "2:3", "16:9", "9:16"] }),
  m({ id: "recraft_v4_1_utility", label: "Recraft V4.1 Utility", blurb: "Clean product shots and mockups.", endpoint: "recraft/v4.1/utility/text-to-image", ratios: ["1:1", "3:4", "4:3", "4:5", "5:4", "3:2", "2:3", "16:9", "9:16"] }),
  m({ id: "recraft_v4_1_utility_pro", label: "Recraft V4.1 Utility Pro", blurb: "Utility variant at 2K.", endpoint: "recraft/v4.1/utility/pro/text-to-image", ratios: ["1:1", "3:4", "4:3", "4:5", "5:4", "3:2", "2:3", "16:9", "9:16"] }),
  // qwen_image_3: request page read (1k/2k PNG, the 10 shapes below, no batch field, unknown fields are rejected); not yet test-rendered.
  m({ id: "qwen_image_3", label: "Qwen Image 3", blurb: "Detailed text-to-image.", endpoint: "alibaba/qwen-image-3/text-to-image", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k" }),
  // qwen_image_3_edit: request page read (1 to 3 public image_urls REQUIRED, 1k/2k, same 10 shapes as text-to-image); not tested, and hidden from the pickers because the app cannot send a reference image yet.
  m({ id: "qwen_image_3_edit", label: "Qwen Image 3 Edit", blurb: "Edits existing images (needs a reference image).", endpoint: "alibaba/qwen-image-3/edit", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k", maxReferences: 3, requiresReference: true }),
  m({ id: "ideogram_4", label: "Ideogram 4.0", blurb: "Strong typography in images.", endpoint: "ideogram/v4.0", ratios: ["1:1", "4:5", "5:4", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3"] }),
  m({ id: "z_image_turbo", label: "Z-Image Turbo", blurb: "Very fast drafts.", endpoint: "z-image/turbo", ratios: WIDE }),
];

// Disabled entries become available when listed in HIGGSFIELD_ENABLED_MODELS.
export function isEnabled(model: ImageModel): boolean {
  const extra = (process.env.HIGGSFIELD_ENABLED_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return model.enabled || extra.includes(model.id);
}

export function enabledModels(): ImageModel[] {
  return MODELS.filter(isEnabled);
}

export function findEnabledModel(id: unknown): ImageModel | undefined {
  return typeof id === "string" ? enabledModels().find((x) => x.id === id) : undefined;
}

export function endpointFor(model: ImageModel): string {
  return process.env[`HIGGSFIELD_ENDPOINT_${model.id.toUpperCase()}`] ?? model.endpoint;
}

// What the pickers need, with no server-only fields.
export type PublicModel = Pick<ImageModel, "id" | "label" | "blurb" | "ratios" | "maxBatch" | "verified">;
export function toPublic(model: ImageModel): PublicModel {
  return { id: model.id, label: model.label, blurb: model.blurb, ratios: model.ratios, maxBatch: model.maxBatch, verified: model.verified };
}
