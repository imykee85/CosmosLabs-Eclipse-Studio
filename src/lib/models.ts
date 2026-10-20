// The one list of image models. Each entry maps to a real Higgsfield endpoint; nothing falls back to another model.
// The Create page and the Canvas build their pickers from /api/models, which returns only enabled entries.
//
// `verified` means a real render passed through this app. soul_v2 and (owner-confirmed 2026-10-10) soul_cinema, grok_image_2, recraft_v4_1, qwen_image_3_edit, ideogram_4, z_image_turbo, marketing_studio_image and ads_studio have; `autoPick: false` keeps a model out of Auto. Every model's fields come from its Higgsfield
// request page, but the others have not been test-rendered; they are all switched on at the owner's request so they can be
// tried from the picker. To hide one that fails, set `enabled: false` on its entry (HIGGSFIELD_ENABLED_MODELS can still
// add disabled entries back without a code change). Edit models (references.min > 0) are listed once their picture field is confirmed; Image Studio asks for a picture before it will run them.
// HIGGSFIELD_ENDPOINT_<ID> (id upper-cased) overrides an endpoint without a code change.

import type { SizeRule } from "@/lib/providers/types";
import { toLedger } from "./credit-units";
import { creditsForUsd } from "./price-constants";
import { routeFor } from "./routes";
import { PROVIDER_KEYS, type ProviderId } from "./providers";

// min 1 means an edit model that cannot run without a picture. `field` is the request field the pictures go in; it is
// left out until it has been confirmed on the model's Higgsfield request page, and a model without a confirmed field takes
// NO pictures (it is never sent a guess that the provider might silently ignore). The environment can supply a field
// without a deploy: HIGGSFIELD_REFERENCE_FIELD_<ID> (and _STYLE_<ID>: urls | url | objects).
//   urls: "field": ["https://...", ...]   url: "field": "https://..." (first picture)   objects: "field": [{ type: "image_url", image_url }]
type RefSpec = { min: number; max: number; field?: string; style?: "urls" | "url" | "objects" };

// Seed: the starting number of the noise a render grows from. Only the models below list a `seed` field in their request schema (read from
// docs.higgsfield.ai, 2026-10-09). Every schema rejects unknown fields, so a seed is NEVER sent to a model whose spec says `supported: false`.
// `allowNull` is whether an explicit null means "random" (we never send null: when no seed is chosen we pick a random one ourselves, so it can be saved and reused).
export type SeedSpec = { supported: boolean; min: number; max: number; allowNull: boolean };
const NO_SEED: SeedSpec = { supported: false, min: 0, max: 0, allowNull: false };
const SEED_SOUL: SeedSpec = { supported: true, min: 1, max: 1_000_000, allowNull: false };   // soul/v2 and soul/cinema: omit = random, explicit null is invalid
const SEED_SOUL_V1: SeedSpec = { supported: true, min: 1, max: 1_000_000, allowNull: true };  // soul/standard: omit or null = random
const SEED_INT31: SeedSpec = { supported: true, min: 0, max: 2_147_483_647, allowNull: false }; // qwen-image-3/edit, z-image/turbo

export type ImageModel = {
  id: string;
  provider: ProviderId;         // who makes the picture: Higgsfield (a job to poll) or Google / OpenAI / BytePlus (the reply carries the picture)
  apiModel?: string;            // the provider's own model id, for the providers that name one (Google, OpenAI)
  sizeRule?: SizeRule; // BytePlus: pixel target per tier and the allowed total pixel range
  outputPng?: boolean;          // BytePlus: the model takes output_format
  sizing?: "custom16" | "fixed3"; // OpenAI: the model takes any WIDTHxHEIGHT, or one of three fixed sizes
  label: string;
  blurb: string;
  type: "image";
  endpoint: string;
  ratios: string[];
  resolutions: string[];       // empty: the model takes no resolution field
  defaultResolution?: string;  // the cheapest tier, sent when the request names none
  maxPrompt: number;           // longest prompt the model accepts, in characters
  maxBatch: number;
  seed: SeedSpec;              // see SeedSpec; unconfirmed models are unsupported until their page says otherwise
  references: RefSpec;         // reference pictures: how many, and which request field carries them (see RefSpec)
  extraBody?: Record<string, unknown>;  // fixed fields sent with every request (e.g. the cheapest quality tier)
  enabled: boolean;
  verified: boolean;
  autoPick: boolean;           // may Auto choose it? Specialist or costly models (a marketing brief, an ad) are left for people to pick on purpose
  estimatedCostUsd: number | null;  // blank until measured from real generations
  // PRICE. `usd` is the provider's LIST cost of one image by resolution ("default" when the model has no resolution field); credits come from it by the
  // rule in the comment above the list. `estimate` lists the resolutions whose cost is an estimate in the owner's workbook, not a confirmed list price.
  // `batch`: one credit pays for up to that many images in one Generate (Soul 2 and Soul Cinema cost far less than a credit each).
  // `directUsd`: the cost on the cheaper direct route (see routes.ts), used only when that route is really in use.
  usd: Record<string, number>;
  estimate?: string[];
  batch?: number;
  directUsd?: Record<string, number>;
};

const SOUL_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const GEMINI_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]; // provisional: to be replaced by the list on Google's page
const GPT_FREE_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];
// BytePlus Seedream (brief of 2026-10-09). The model ids are NOT confirmed (a third party listed them; 5.0 flash has none): get the real ones from the
// console's Model List and set ARK_MODEL_<ID> (Config value), e.g. ARK_MODEL_SEEDREAM_5_FLASH. Pixel ranges are from the official page; the size tables
// other than the 5.0 pro example are computed (same area, multiples of 16) until the owner's page copy is read.
const ARK_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"];
const ARK_PRO: SizeRule = { px: { "1k": 1024 ** 2, "2k": 2048 ** 2 }, min: 921_600, max: 4_624_220, table: { "2k": { "1:1": "2048x2048", "4:3": "2368x1776", "3:4": "1776x2368", "16:9": "2816x1584", "9:16": "1584x2816", "3:2": "2496x1664", "2:3": "1664x2496", "21:9": "3136x1344" } } }; // the 2K row is the page's own table
const ARK_BIG: SizeRule = { px: { "2k": 2048 ** 2, "4k": 4096 ** 2 }, min: 3_686_400, max: 16_777_216 };
const ARK_40: SizeRule = { px: { "1k": 1024 ** 2, "2k": 2048 ** 2, "4k": 4096 ** 2 }, min: 921_600, max: 16_777_216 };
const GPT_FIXED_RATIOS = ["1:1", "3:2", "2:3"];
const WIDE = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];

function m(p: Partial<ImageModel> & Pick<ImageModel, "id" | "label" | "blurb" | "endpoint" | "ratios">): ImageModel {
  return { type: "image", resolutions: [], maxPrompt: 2000, maxBatch: 1, provider: "higgsfield", seed: NO_SEED, references: { min: 0, max: 0 }, enabled: true, verified: false, autoPick: true, estimatedCostUsd: null, usd: {}, ...p };
}

// CREDIT PRICES (owner decision 2026-10-20). A credit is worth $0.10 to the customer and pays for $0.04 of provider cost (a 2.5x markup). The
// credits for an image are the provider's LIST cost of that image at the chosen resolution divided by $0.04, rounded UP, at least 1 (see imageCredits).
// List prices only: the provider's own promotions are not used (they are extra margin while they last). Reference pictures add a little input cost on
// Google, OpenAI and Ads Studio; the markup covers it, so there is no separate charge. Marketing Studio stays at quality low, Grok Image 2 at low, GPT at medium.
// Nothing is charged until CREDITS_ENABLED=1 is set (see chargeFor). The workbook with the sources is docs/pricing.md.

const MODELS: ImageModel[] = [
  m({ id: "soul_v2", usd: { "720p": 0.0032, "1080p": 0.0057 }, batch: 4, seed: SEED_SOUL, label: "Soul 2", blurb: "Realistic people and fashion.", endpoint: "higgsfield-ai/soul/v2/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4, enabled: true, verified: true }),
  // soul: request page read (same fields as Soul 2: 720p/1080p, batch 1 or 4, the 7 shapes above); not yet test-rendered.
  m({ id: "soul", usd: { "720p": 0.0938, "1080p": 0.1875 }, seed: SEED_SOUL_V1, label: "Soul", blurb: "The first Soul model.", endpoint: "higgsfield-ai/soul/standard", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  // soul_cinema: request page read (fixed style, the 7 Soul shapes, 720p/1080p, batch 1 or 4; 21:9 is NOT accepted); not yet test-rendered.
  m({ id: "soul_cinema", usd: { "720p": 0.0032, "1080p": 0.0057 }, estimate: ["1080p"], batch: 4, verified: true, seed: SEED_SOUL, label: "Soul Cinema", blurb: "Cinema-grade stills and concept art.", endpoint: "higgsfield-ai/soul/cinema", ratios: SOUL_RATIOS, resolutions: ["720p", "1080p"], defaultResolution: "720p", maxBatch: 4 }),
  // marketing_studio_image (2.0 Alpha): request page read. Text-only works (no image_urls, enhance_prompt off); prompt up to 5000 characters; quality low/medium/high; 1k/2k/4k; "auto" shape left out of the picker; unknown fields rejected. Sent at quality low and 1k, the cheapest. Not yet test-rendered.
  m({ id: "marketing_studio_image", usd: { "1k": 0.0162, "2k": 0.0222, "4k": 0.1 }, estimate: ["4k"], verified: true, autoPick: false, maxPrompt: 5000, label: "Marketing Studio Image", blurb: "Product and campaign visuals.", endpoint: "marketing-studio/image", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", references: { min: 0, max: 16, field: "image_urls" }, extraBody: { quality: "low", enhance_prompt: false } }),
  // marketing_studio_image_flare (2.5 Flare): request page read. Same fields as 2.0 Alpha except quality also accepts xhigh and max. Sent at quality low and 1k. Not yet test-rendered.
  m({ id: "marketing_studio_image_flare", usd: { "1k": 0.0162, "2k": 0.0222, "4k": 0.1 }, estimate: ["1k", "2k", "4k"], maxPrompt: 5000, label: "Marketing Studio Flare", blurb: "Marketing Studio Image, Flare variant.", endpoint: "marketing-studio/image/flare", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", references: { min: 0, max: 16 }, extraBody: { quality: "low" } }),
  // marketing_studio_image_sunburst (2.5 Sunburst): request page read; identical fields to Flare. Not yet test-rendered.
  m({ id: "marketing_studio_image_sunburst", usd: { "1k": 0.0162, "2k": 0.0222, "4k": 0.1 }, estimate: ["1k", "2k", "4k"], maxPrompt: 5000, label: "Marketing Studio Sunburst", blurb: "Marketing Studio Image, Sunburst variant.", endpoint: "marketing-studio/image/sunburst", ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", references: { min: 0, max: 16 }, extraBody: { quality: "low" } }),
  // ads_studio: request page read. Takes a marketing BRIEF (up to 8000 characters); product images are optional, so text-only works. No resolution field, unknown fields rejected, 14 shapes, 1 to 8 ad concepts per request (we send 1). Docs give an illustrative ~$0.084 per image (not measured here, so estimatedCostUsd stays blank). Not yet test-rendered.
  m({ id: "ads_studio", usd: { "default": 0.1071 }, verified: true, autoPick: false, maxPrompt: 8000, label: "Ads Studio", blurb: "Ad creatives from a short marketing brief.", endpoint: "higgsfield/ads-studio/v1.0", ratios: ["1:1", "4:5", "5:4", "16:9", "9:16", "4:3", "3:4", "21:9", "3:2", "2:3", "2:1", "1:2", "3:1", "1:3"], maxBatch: 8, references: { min: 0, max: 10, field: "image_urls" } }),
  // grok_image_2: request page read (text-to-image when no image_urls are sent; 1k/2k; quality low or medium; one image per request). "auto" shape left out of the picker. Sent at quality "low", the cheapest tier. Not yet test-rendered.
  m({ id: "grok_image_2", usd: { "1k": 0.04, "2k": 0.08 }, estimate: ["2k"], directUsd: { "1k": 0.04, "2k": 0.04 }, verified: true, label: "Grok Image 2.0", blurb: "Fast, flexible image generation.", endpoint: "xai/grok-imagine-image-2.0", ratios: ["1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], resolutions: ["1k", "2k"], defaultResolution: "1k", references: { min: 0, max: 10, field: "image_urls" }, extraBody: { quality: "low" } }),
  // recraft_v4_1: request page read (1k only, 14 shapes, jpg default, prompt up to 10000 characters, unknown fields rejected); not yet test-rendered.
  m({ id: "recraft_v4_1", usd: { "1k": 0.035 }, verified: true, maxPrompt: 10000, label: "Recraft V4.1", blurb: "Illustration and design, 1K.", endpoint: "recraft/v4.1/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["1k"], defaultResolution: "1k" }),
  // recraft_v4_1_pro: request page read (2k only, same 14 shapes as V4.1, unknown fields rejected); not yet test-rendered.
  m({ id: "recraft_v4_1_pro", usd: { "2k": 0.21 }, maxPrompt: 10000, label: "Recraft V4.1 Pro", blurb: "Recraft V4.1 at 2K.", endpoint: "recraft/v4.1/pro/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["2k"], defaultResolution: "2k" }),
  // recraft_v4_1_utility: request page read (1k only, the same 14 shapes); not yet test-rendered.
  m({ id: "recraft_v4_1_utility", usd: { "1k": 0.035 }, maxPrompt: 10000, label: "Recraft V4.1 Utility", blurb: "Clean product shots and mockups.", endpoint: "recraft/v4.1/utility/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["1k"], defaultResolution: "1k" }),
  // recraft_v4_1_utility_pro: request page read (2k only, the same 14 shapes); not yet test-rendered.
  m({ id: "recraft_v4_1_utility_pro", usd: { "2k": 0.21 }, maxPrompt: 10000, label: "Recraft V4.1 Utility Pro", blurb: "Utility variant at 2K.", endpoint: "recraft/v4.1/utility/pro/text-to-image", ratios: ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"], resolutions: ["2k"], defaultResolution: "2k" }),
  // qwen_image_3: request page read (1k/2k PNG, the 10 shapes below, no batch field, unknown fields are rejected); not yet test-rendered.
  m({ id: "qwen_image_3", usd: { "1k": 0.04, "2k": 0.075 }, directUsd: { "1k": 0.0248, "2k": 0.0248 }, label: "Qwen Image 3", blurb: "Detailed text-to-image.", endpoint: "alibaba/qwen-image-3/text-to-image", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k" }),
  // qwen_image_3_edit: request page read (1 to 3 public image_urls REQUIRED, 1k/2k, same 10 shapes as text-to-image); not test-rendered. The app now sends reference pictures (see RefSpec).
  m({ id: "qwen_image_3_edit", usd: { "1k": 0.04, "2k": 0.075 }, directUsd: { "1k": 0.0248, "2k": 0.0248 }, verified: true, seed: SEED_INT31, label: "Qwen Image 3 Edit", blurb: "Edits existing images (needs a reference image).", endpoint: "alibaba/qwen-image-3/edit", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k", references: { min: 1, max: 3, field: "image_urls" } }),
  // ideogram_4: request page read (no resolution field and unknown fields are rejected; 23 shapes; prompt 2 to 2048 characters; rendering_speed is case-sensitive). Sent at TURBO, the cheapest speed. Not yet test-rendered.
  m({ id: "ideogram_4", usd: { "default": 0.03 }, verified: true, maxPrompt: 2048, label: "Ideogram 4.0", blurb: "Strong typography in images.", endpoint: "ideogram/v4.0", ratios: ["1:1", "1:2", "2:1", "2:3", "3:2", "4:5", "5:4", "9:16", "16:9", "5:8", "8:5", "3:4", "4:3", "9:22", "22:9", "9:23", "23:9", "3:8", "8:3", "5:12", "12:5", "1:3", "3:1"], references: { min: 0, max: 1, field: "image_url", style: "url" }, extraBody: { rendering_speed: "TURBO" } }),
  // z_image_turbo: request page read (text-to-image only, prompt up to 800 characters, 1k/2k PNG, 10 shapes, unknown fields rejected; prompt_extend stays off, the cheaper tier). Not yet test-rendered.
  m({ id: "z_image_turbo", usd: { "1k": 0.015, "2k": 0.015 }, verified: true, seed: SEED_INT31, label: "Z-Image Turbo", blurb: "Very fast drafts.", endpoint: "z-image/turbo", ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], defaultResolution: "1k", maxPrompt: 800 }),
  // ---- Google Nano Banana (Gemini API). From the owner's brief; NOT test-rendered, so every entry is disabled until one cheap live render passes
  // (then add the id to ENABLED_MODELS). Provisional, to confirm from the page: the aspect-ratio list, the prompt limit, request size limits. No seed is documented.
  // The brief's reference split (objects, characters, style) is not modelled yet: every picture is sent as an object image, so the cap is the object-image limit.
  m({ id: "nano_banana_2_1", usd: { "1k": 0.0336, "2k": 0.0504, "4k": 0.0756 }, provider: "google", apiModel: "gemini-nano-banana-2.1", label: "Nano Banana 2.1", blurb: "Google's recommended image model.", endpoint: "", ratios: GEMINI_RATIOS, resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxPrompt: 8000, references: { min: 0, max: 10, field: "input" }, enabled: true }),
  m({ id: "nano_banana_2_lite", usd: { "1k": 0.025 }, estimate: ["1k"], provider: "google", apiModel: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite", blurb: "Fastest and cheapest. 1K only.", endpoint: "", ratios: GEMINI_RATIOS, resolutions: ["1k"], defaultResolution: "1k", maxPrompt: 8000, references: { min: 0, max: 14, field: "input" }, enabled: true }),
  m({ id: "nano_banana_2", usd: { "1k": 0.067, "2k": 0.101, "4k": 0.151 }, provider: "google", apiModel: "gemini-3.1-flash-image", label: "Nano Banana 2", blurb: "Fast, sharp images.", endpoint: "", ratios: GEMINI_RATIOS, resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxPrompt: 8000, references: { min: 0, max: 10, field: "input" }, enabled: true }),
  m({ id: "nano_banana_pro", usd: { "1k": 0.134, "2k": 0.134, "4k": 0.24 }, provider: "google", apiModel: "gemini-3-pro-image", label: "Nano Banana Pro", blurb: "Google's highest quality.", endpoint: "", ratios: GEMINI_RATIOS, resolutions: ["1k", "2k", "4k"], defaultResolution: "1k", maxPrompt: 8000, references: { min: 0, max: 6, field: "input" }, enabled: true }),
  // gemini-2.5-flash-image: the brief gives no size or reference facts for it, so it takes neither until they are confirmed.
  m({ id: "nano_banana", usd: { "default": 0.039 }, provider: "google", apiModel: "gemini-2.5-flash-image", label: "Nano Banana", blurb: "The original Nano Banana.", endpoint: "", ratios: GEMINI_RATIOS, maxPrompt: 8000, enabled: true }),

  // ---- OpenAI GPT Image. From the owner's brief; NOT test-rendered (all disabled until a cheap live render passes). No seed. Quality is sent as medium until real costs are measured.
  // The gpt-image-2 family takes any WIDTHxHEIGHT; the older models take only 1024x1024, 1536x1024 and 1024x1536. References go through /images/edits (up to 16).
  m({ id: "gpt_image_2_5_sunburst", usd: { "1k": 0.06, "2k": 0.2 }, estimate: ["2k"], provider: "openai", apiModel: "gpt-image-2.5-sunburst", sizing: "custom16", label: "GPT Image 2.5 Sunburst", blurb: "OpenAI's newest image model.", endpoint: "", ratios: GPT_FREE_RATIOS, resolutions: ["1k", "2k"], defaultResolution: "1k", maxPrompt: 32000, references: { min: 0, max: 16, field: "images" }, enabled: true }),
  m({ id: "gpt_image_2_5_flare", usd: { "1k": 0.06, "2k": 0.2 }, estimate: ["2k"], provider: "openai", apiModel: "gpt-image-2.5-flare", sizing: "custom16", label: "GPT Image 2.5 Flare", blurb: "OpenAI's 2.5 image model, Flare variant.", endpoint: "", ratios: GPT_FREE_RATIOS, resolutions: ["1k", "2k"], defaultResolution: "1k", maxPrompt: 32000, references: { min: 0, max: 16, field: "images" }, enabled: true }),
  m({ id: "gpt_image_2", usd: { "1k": 0.053, "2k": 0.2 }, estimate: ["2k"], provider: "openai", apiModel: "gpt-image-2", sizing: "custom16", label: "GPT Image 2", blurb: "Flexible sizes and strong detail.", endpoint: "", ratios: GPT_FREE_RATIOS, resolutions: ["1k", "2k"], defaultResolution: "1k", maxPrompt: 32000, references: { min: 0, max: 16, field: "images" }, enabled: true }),
  m({ id: "gpt_image_1_5", usd: { "default": 0.051 }, provider: "openai", apiModel: "gpt-image-1.5", sizing: "fixed3", label: "GPT Image 1.5", blurb: "Three fixed sizes.", endpoint: "", ratios: GPT_FIXED_RATIOS, maxPrompt: 32000, references: { min: 0, max: 16, field: "images" }, enabled: true }),
  m({ id: "gpt_image_1", usd: { "default": 0.063 }, enabled: false, provider: "openai", apiModel: "gpt-image-1", sizing: "fixed3", label: "GPT Image 1", blurb: "Three fixed sizes.", endpoint: "", ratios: GPT_FIXED_RATIOS, maxPrompt: 32000, references: { min: 0, max: 16, field: "images" } }),
  m({ id: "gpt_image_1_mini", usd: { "default": 0.0165 }, provider: "openai", apiModel: "gpt-image-1-mini", sizing: "fixed3", label: "GPT Image 1 mini", blurb: "The cheapest GPT Image.", endpoint: "", ratios: GPT_FIXED_RATIOS, maxPrompt: 32000, references: { min: 0, max: 16, field: "images" }, enabled: true }),
  // BytePlus Seedream: no seed, watermark off, references as base64 (10 for 5.0 pro/flash, 14 for the others).
  m({ id: "seedream_5_pro", usd: { "1k": 0.0675, "2k": 0.1 }, estimate: ["2k"], provider: "byteplus", apiModel: "seedream-5-0-pro-260628", sizeRule: ARK_PRO, outputPng: true, label: "Seedream 5.0 Pro", blurb: "ByteDance's top image model.", endpoint: "", ratios: ARK_RATIOS, resolutions: ["1k", "2k"], defaultResolution: "2k", maxPrompt: 3000, references: { min: 0, max: 10, field: "image" }, enabled: true }),
  m({ id: "seedream_5_flash", usd: { "1k": 0.035, "2k": 0.035 }, estimate: ["1k", "2k"], provider: "byteplus", sizeRule: ARK_PRO, outputPng: true, label: "Seedream 5.0 Flash", blurb: "Faster Seedream 5.0.", endpoint: "", ratios: ARK_RATIOS, resolutions: ["1k", "2k"], defaultResolution: "2k", maxPrompt: 3000, references: { min: 0, max: 10, field: "image" }, enabled: true }),
  m({ id: "seedream_5_lite", usd: { "2k": 0.035, "4k": 0.035 }, provider: "byteplus", apiModel: "doubao-seedream-5-0-260128", sizeRule: ARK_BIG, outputPng: true, label: "Seedream 5.0 Lite", blurb: "Lighter Seedream 5.0, 2K to 4K.", endpoint: "", ratios: ARK_RATIOS, resolutions: ["2k", "4k"], defaultResolution: "2k", maxPrompt: 3000, references: { min: 0, max: 14, field: "image" }, enabled: true }),
  m({ id: "seedream_4_5", usd: { "2k": 0.04, "4k": 0.04 }, provider: "byteplus", apiModel: "doubao-seedream-4-5-251128", sizeRule: ARK_BIG, label: "Seedream 4.5", blurb: "Seedream 4.5, 2K to 4K.", endpoint: "", ratios: ARK_RATIOS, resolutions: ["2k", "4k"], defaultResolution: "2k", maxPrompt: 3000, references: { min: 0, max: 14, field: "image" }, enabled: true }),
  m({ id: "seedream_4", usd: { "1k": 0.03, "2k": 0.03, "4k": 0.03 }, provider: "byteplus", apiModel: "doubao-seedream-4-0-250828", sizeRule: ARK_40, label: "Seedream 4.0", blurb: "Seedream 4.0, 1K to 4K.", endpoint: "", ratios: ARK_RATIOS, resolutions: ["1k", "2k", "4k"], defaultResolution: "2k", maxPrompt: 3000, references: { min: 0, max: 14, field: "image" }, enabled: true }),
];

// Google, OpenAI and BytePlus models are on as soon as their key (and, for Seedream, model id) is set; until then they are hidden. Disabled entries become available when listed in ENABLED_MODELS (HIGGSFIELD_ENABLED_MODELS still works): set it to enable a model after its first cheap live render passed.
function isEnabled(model: ImageModel): boolean {
  const extra = `${process.env.ENABLED_MODELS ?? ""},${process.env.HIGGSFIELD_ENABLED_MODELS ?? ""}`.split(",").map((s) => s.trim()).filter(Boolean);
  return model.enabled || extra.includes(model.id);
}

// The provider's model id, with ARK_MODEL_<ID> (and the same for the others) as a correction from the environment.
export const apiModelOf = (model: ImageModel): string | undefined => process.env[`ARK_MODEL_${model.id.toUpperCase()}`] ?? model.apiModel;

/** Every image model in the registry, enabled or not (the owner's price check lists them all). */
export const allImageModels = (): ImageModel[] => MODELS;

export function enabledModels(): ImageModel[] {
  return MODELS.filter((m) => isEnabled(m) && isRunnable(m));
}

export function findEnabledModel(id: unknown): ImageModel | undefined {
  return typeof id === "string" ? enabledModels().find((x) => x.id === id) : undefined;
}

export function getModelById(id: string | null | undefined): ImageModel | undefined {
  return MODELS.find((x) => x.id === id);
}


// The key of a model's price table for a resolution: the resolution itself, else the model's own "default" row, else its default or only resolution.
function priceKey(table: Record<string, number>, model: ImageModel, resolution?: string): string | undefined {
  if (resolution && table[resolution] != null) return resolution;
  if (table.default != null) return "default";
  if (model.defaultResolution && table[model.defaultResolution] != null) return model.defaultResolution;
  return Object.keys(table)[0];
}

/** Whole credits one image costs at this resolution, on the given route. Null for a model with no price table. */
export function imageCredits(model: ImageModel | undefined, resolution?: string, route: "higgsfield" | "direct" = model ? routeFor(model.id) : "higgsfield"): number | null {
  if (!model) return null;
  const direct = route === "direct" ? model.directUsd : undefined;
  const table = direct && (resolution ? direct[resolution] != null : direct.default != null || (model.defaultResolution != null && direct[model.defaultResolution] != null)) ? direct : model.usd;
  const key = priceKey(table, model, resolution);
  return key ? creditsForUsd(table[key]) : null;
}

/** What one request costs in LEDGER units (tenths of a credit), or null while charging is off (the default), so nothing is checked or charged. */
export function chargeFor(model: ImageModel | undefined, resolution?: string, route?: "higgsfield" | "direct"): number | null {
  if (process.env.CREDITS_ENABLED !== "1") return null;
  const credits = imageCredits(model, resolution, route);
  return credits == null ? null : toLedger(credits);
}

// What a model really takes, after the environment's corrections. `supported` needs a confirmed request field.
function referenceSpec(model: ImageModel) {
  const key = model.id.toUpperCase();
  const field = process.env[`HIGGSFIELD_REFERENCE_FIELD_${key}`] ?? model.references.field;
  const style = (process.env[`HIGGSFIELD_REFERENCE_STYLE_${key}`] ?? model.references.style ?? "urls") as "urls" | "url" | "objects";
  const supported = model.references.max > 0 && !!field;
  return { supported, field, style, min: supported ? model.references.min : 0, max: supported ? model.references.max : 0 };
}
export const maxRefs = (model: ImageModel) => referenceSpec(model).max;
export const minRefs = (model: ImageModel) => referenceSpec(model).min;
// An edit model whose picture field is not confirmed cannot run at all, so it stays out of every list.
// A model is also hidden while its provider's key is missing on the server.
const isRunnable = (model: ImageModel) => (model.provider === "higgsfield" || !!apiModelOf(model)) && (model.references.min === 0 || referenceSpec(model).supported) && (!PROVIDER_KEYS[model.provider] || Boolean(process.env[PROVIDER_KEYS[model.provider]!]));

// How reference pictures are added to a request body.
export function referenceBody(model: ImageModel, urls: string[]): Record<string, unknown> {
  const spec = referenceSpec(model);
  if (urls.length === 0 || !spec.supported || !spec.field) return {};
  if (spec.style === "url") return { [spec.field]: urls[0] };
  if (spec.style === "objects") return { [spec.field]: urls.map((u) => ({ type: "image_url", image_url: u })) };
  return { [spec.field]: urls };
}

export function endpointFor(model: ImageModel): string {
  return process.env[`HIGGSFIELD_ENDPOINT_${model.id.toUpperCase()}`] ?? model.endpoint;
}

// What the pickers need, with no server-only fields.
// What the browser needs to show a price: ledger units per resolution ("default" for a model with no resolution field), or null while charging is off.
function publicPrices(model: ImageModel): Record<string, number> | null {
  if (process.env.CREDITS_ENABLED !== "1") return null;
  const keys = Object.keys(model.usd);
  if (!keys.length) return null;
  const route = routeFor(model.id);
  return Object.fromEntries(keys.map((k) => [k, toLedger(imageCredits(model, k === "default" ? undefined : k, route)!)]));
}

export type PublicModel = Pick<ImageModel, "id" | "label" | "blurb" | "ratios" | "resolutions" | "maxBatch" | "maxPrompt" | "verified" | "autoPick" | "seed"> & { maxReferences: number; requiresReference: boolean; prices: Record<string, number> | null; batch: number; defaultResolution?: string };
export function toPublic(model: ImageModel): PublicModel {
  return { id: model.id, label: model.label, blurb: model.blurb, ratios: model.ratios, resolutions: model.resolutions, maxBatch: model.maxBatch, maxPrompt: model.maxPrompt, verified: model.verified, autoPick: model.autoPick, seed: model.seed, maxReferences: maxRefs(model), requiresReference: minRefs(model) > 0, prices: publicPrices(model), batch: model.batch ?? 1, defaultResolution: model.defaultResolution };
}
