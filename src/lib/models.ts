// The one list of image models. Each entry maps to a real Higgsfield endpoint; nothing falls back to another model.
// The Create page and the Canvas build their pickers from /api/models, which returns only enabled entries.
//
// `verified` means a real render passed through this app. Only soul_v2 has. Every model's fields come from its Higgsfield
// request page, but the others have not been test-rendered; they are all switched on at the owner's request so they can be
// tried from the picker. To hide one that fails, set `enabled: false` on its entry (HIGGSFIELD_ENABLED_MODELS can still
// add disabled entries back without a code change). Models that need an input image are kept out of the picker.
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
  maxPrompt: number;           // longest prompt the model accepts, in characters
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
  return { type: "image", resolutions: [], maxPrompt: 2000, maxBatch: 1, maxReferences: 0, requiresReference: false, enabled: true, verified: false, estimatedCostUsd: null, creditCost: null, ...p };
}

// CREDIT PRICES (provisional). Provider cost seen so far on the Higgsfield bill: about $0.00 (Soul 2), $0.01 to $0.04, $0.12 and $0.21
// per render, and failed renders are refunded by Higgsfield. A credit is worth about $0.008 on the cheapest placeholder plan (Scale,
// $199 for 25,000 credits, see plans.ts), so each price below covers the provider cost plus roughly 20% room at that worst rate:
//   soul     Soul 2, about $0.003               ->  2 credits  (cost basis $0.015)
//   light    up to $0.04 seen                   ->  7 credits  (cost basis $0.05)
//   standard $0.12 seen                         -> 19 credits  (cost basis $0.15)
//   premium  $0.21 seen                         -> 32 credits  (cost basis $0.25)
// Which model sits in which tier is a best guess from the model's size and quality setting until each charge on the bill is matched to a
// model; adjust the numbers here. Nothing is charged until CREDITS_ENABLED=1 is set (see chargeFor).
const CREDITS = { soul: 2, light: 7, standard: 19, premium: 32 } as const;

export const MODELS: ImageModel[] = [
  m({ id: "soul_v2", creditCost: CREDITS.soul, label: "Soul 2", blurb: "Realistic people and fashion.", endpoint: "higgsfield-ai/soul/v2/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4, maxReferences: 0, enabled: true, verified: true }),
  // soul: request page read (same fields as Soul 2: 720p/1080p, batch 1 or 4, the 7 shapes above); not yet test-rendered.
  m({ id: "soul", creditCost: CREDITS.light, label: "Soul", blurb: "The first Soul model.", endpoint: "higgsfield-ai/soul/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  // soul_cinema: request page read (fixed style, the 7 Soul shapes, 720p/1080p, batch 1 or 4; 21:9 is NOT accepted); not yet test-rendered.
  m({ id: "soul_cinema", creditCost: CREDITS.light, label: "Soul Cinema", blurb: "Cinema-grade stills and concept art.", endpoint: "higgsfield-ai/soul/cinema", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  // marketing_studio_image (2.0 Alpha): request page read. Text-only works (no image_urls, enhance_prompt off); prompt up to 5000 characters; quality low/medium/high; 1k/2k/4k; "auto" shape left out of the picker; unknown fields rejected. Sent at quality low and 1k, the cheapest. Not yet test-rendered.
  m({ id: "marketing_studio_image", creditCost: CREDITS.standard, maxPrompt: 5000, label: "Marketing Studio Image", blurb: "Product and campaign visuals.", endpoint: "marketing-studio/image", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxReferences: 16, extraBody: { quality: "low" } }),
  // marketing_studio_image_flare (2.5 Flare): request page read. Same fields as 2.0 Alpha except quality also accepts xhigh and max. Sent at quality low and 1k. Not yet test-rendered.
  m({ id: "marketing_studio_image_flare", creditCost: CREDITS.standard, maxPrompt: 5000, label: "Marketing Studio Flare", blurb: "Marketing Studio Image, Flare variant.", endpoint: "marketing-studio/image/flare", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxReferences: 16, extraBody: { quality: "low" } }),
  // marketing_studio_image_sunburst (2.5 Sunburst): request page read; identical fields to Flare. Not yet test-rendered.
  m({ id: "marketing_studio_image_sunburst", creditCost: CREDITS.standard, maxPrompt: 5000, label: "Marketing Studio Sunburst", blurb: "Marketing Studio Image, Sunburst variant.", endpoint: "marketing-studio/image/sunburst", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxReferences: 16, extraBody: { quality: "low" } }),
  // ads_studio: request page read. Takes a marketing BRIEF (up to 8000 characters); product images are optional, so text-only works. No resolution field, unknown fields rejected, 14 shapes, 1 to 8 ad concepts per request (we send 1). Docs give an illustrative ~$0.084 per image (not measured here, so estimatedCostUsd stays blank). Not yet test-rendered.
  m({ id: "ads_studio", creditCost: CREDITS.premium, maxPrompt: 8000, label: "Ads Studio", blurb: "Ad creatives from a short marketing brief.", endpoint: "higgsfield/ads-studio/v1.0", ratios: ["1:1", "4:5", "5:4", "16:9", "9:16", "4:3", "3:4", "21:9", "3:2", "2:3", "2:1", "1:2", "3:1", "1:3"], maxBatch: 8, maxReferences: 10 }),
  // grok_image_2: request page read (text-to-image when no image_urls are sent; 1k/2k; quality low or medium; one image per request). "auto" shape left out of the picker. Sent at quality "low", the cheapest tier. Not yet test-rendered.
  m({ id: "grok_image_2", creditCost: CREDITS.light, label: "Grok Image 2.0", blurb: "Fast, flexible image generation.", endpoint: "xai/grok-imagine-image-2.0", ratios: ["1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], resolutions: ["1k", "2k"], defaultResolution: "1k", extraBody: { quality: "low" } }),
  // recraft_v4_1: request page read (1k only, 14 shapes, jpg default, prompt up to 10000 characters, unknown fields rejected); not yet test-rendered.
  m({ id: "recraft_v4_1", creditCost: CREDITS.light, maxPrompt: 10000, label: "Recraft V4.1", blurb: "Illustration and design, 1K.", endpoint: "recraft/v4.1/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["1k"], defaultResolution: "1k" }),
  // recraft_v4_1_pro: request page read (2k only, same 14 shapes as V4.1, unknown fields rejected); not yet test-rendered.
  m({ id: "recraft_v4_1_pro", creditCost: CREDITS.standard, maxPrompt: 10000, label: "Recraft V4.1 Pro", blurb: "Recraft V4.1 at 2K.", endpoint: "recraft/v4.1/pro/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["2k"], defaultResolution: "2k" }),
  // recraft_v4_1_utility: request page read (1k only, the same 14 shapes); not yet test-rendered.
  m({ id: "recraft_v4_1_utility", creditCost: CREDITS.light, maxPrompt: 10000, label: "Recraft V4.1 Utility", blurb: "Clean product shots and mockups.", endpoint: "recraft/v4.1/utility/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["1k"], defaultResolution: "1k" }),
  // recraft_v4_1_utility_pro: request page read (2k only, the same 14 shapes); not yet test-rendered.
  m({ id: "recraft_v4_1_utility_pro", creditCost: CREDITS.standard, maxPrompt: 10000, label: "Recraft V4.1 Utility Pro", blurb: "Utility variant at 2K.", endpoint: "recraft/v4.1/utility/pro/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["2k"], defaultResolution: "2k" }),
  // qwen_image_3: request page read (1k/2k PNG, the 10 shapes below, no batch field, unknown fields are rejected); not yet test-rendered.
  m({ id: "qwen_image_3", creditCost: CREDITS.light, label: "Qwen Image 3", blurb: "Detailed text-to-image.", endpoint: "alibaba/qwen-image-3/text-to-image", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k" }),
  // qwen_image_3_edit: request page read (1 to 3 public image_urls REQUIRED, 1k/2k, same 10 shapes as text-to-image); not tested, and hidden from the pickers because the app cannot send a reference image yet.
  m({ id: "qwen_image_3_edit", creditCost: CREDITS.light, label: "Qwen Image 3 Edit", blurb: "Edits existing images (needs a reference image).", endpoint: "alibaba/qwen-image-3/edit", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k", maxReferences: 3, requiresReference: true }),
  // ideogram_4: request page read (no resolution field and unknown fields are rejected; 23 shapes; prompt 2 to 2048 characters; rendering_speed is case-sensitive). Sent at TURBO, the cheapest speed. Not yet test-rendered.
  m({ id: "ideogram_4", creditCost: CREDITS.light, maxPrompt: 2048, label: "Ideogram 4.0", blurb: "Strong typography in images.", endpoint: "ideogram/v4.0", ratios: ["1:1", "1:2", "2:1", "2:3", "3:2", "4:5", "5:4", "9:16", "16:9", "5:8", "8:5", "3:4", "4:3", "9:22", "22:9", "9:23", "23:9", "3:8", "8:3", "5:12", "12:5", "1:3", "3:1"], extraBody: { rendering_speed: "TURBO" } }),
  // z_image_turbo: request page read (text-to-image only, prompt up to 800 characters, 1k/2k PNG, 10 shapes, unknown fields rejected; prompt_extend stays off, the cheaper tier). Not yet test-rendered.
  m({ id: "z_image_turbo", creditCost: CREDITS.light, label: "Z-Image Turbo", blurb: "Very fast drafts.", endpoint: "z-image/turbo", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k", maxPrompt: 800 }),
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

export function getModelById(id: string | null | undefined): ImageModel | undefined {
  return MODELS.find((x) => x.id === id);
}

// What a render costs the user, in credits. Null while charging is switched off (the default), so nothing is checked or charged.
export function chargeFor(model: ImageModel | undefined): number | null {
  if (process.env.CREDITS_ENABLED !== "1") return null;
  return model?.creditCost ?? null;
}

export function endpointFor(model: ImageModel): string {
  return process.env[`HIGGSFIELD_ENDPOINT_${model.id.toUpperCase()}`] ?? model.endpoint;
}

// What the pickers need, with no server-only fields.
export type PublicModel = Pick<ImageModel, "id" | "label" | "blurb" | "ratios" | "maxBatch" | "maxPrompt" | "verified"> & { credits: number | null };
export function toPublic(model: ImageModel): PublicModel {
  return { id: model.id, label: model.label, blurb: model.blurb, ratios: model.ratios, maxBatch: model.maxBatch, maxPrompt: model.maxPrompt, verified: model.verified, credits: chargeFor(model) };
}
