// Design Studio's 3D generator: which makers and modes are offered, what each is sent, and what it costs. NOT VERIFIED against the live API (the request
// pages for 3D were not available): the endpoint path of each model defaults to its catalog id and can be set with HIGGSFIELD_3D_PATH_<ID> (Config value),
// and the price is a PROVISIONAL maker cost in dollars (override with DESIGN3D_USD_<ID>). Charged at that cost rounded up to the cent, like images and video.
import { creditsForUsd } from "../price-constants";
import { toLedger } from "../credit-units";

export type Mode3D = "image" | "multi" | "text";
export type Model3DSpec = {
  id: string; label: string; maker: string; modes: Mode3D[]; maxImages: number; minImages: number;
  family: "meshy" | "tripo" | "tripo2" | "hunyuan" | "sam" | "seed3d" | "hyper3d" | "hitem3d"; rig?: boolean; usd: number; polyMin: number; polyMax: number; polyDefault: number; blurb: string;
  // ByteDance's cloud (Volcano Ark / BytePlus ModelArk, owner's brief 2026-11-12): a task API of its own, not Higgsfield. NOT run live: off until one real task passes
  // (add the id to ENABLED_MODELS) and ARK_API_KEY is set. `arkId` is the provider's model id (ARK_3D_MODEL_<ID> overrides it).
  route?: "ark"; arkId?: string; off?: boolean;
};

export const MODELS_3D: Model3DSpec[] = [
  { id: "meshy_v7_image_to_3d", rig: true, label: "Meshy 7", maker: "Meshy", modes: ["image"], minImages: 1, maxImages: 1, family: "meshy", usd: 0.4, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "One picture to a textured model" },
  { id: "meshy_multi_image_to_3d", label: "Meshy Multi-view", maker: "Meshy", modes: ["multi"], minImages: 1, maxImages: 4, family: "meshy", usd: 0.5, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "Up to 4 views of the same thing, truer shape" },
  { id: "tripo_h3_1_image_to_3d", label: "Tripo H3.1", maker: "Tripo", modes: ["image"], minImages: 1, maxImages: 1, family: "tripo", usd: 0.4, polyMin: 1000, polyMax: 2000000, polyDefault: 100000, blurb: "Detailed textures, PBR materials" },
  { id: "tripo_h3_1_multiview_to_3d", label: "Tripo H3.1 Multi-view", maker: "Tripo", modes: ["multi"], minImages: 2, maxImages: 4, family: "tripo", usd: 0.5, polyMin: 1000, polyMax: 2000000, polyDefault: 100000, blurb: "2 to 4 views in order: front, left, right, back" },
  { id: "tripo_p2_image_to_3d", label: "Tripo P2", maker: "Tripo", modes: ["image"], minImages: 1, maxImages: 1, family: "tripo2", usd: 0.5, polyMin: 48, polyMax: 50000, polyDefault: 20000, blurb: "Clean, production-ready meshes" },
  { id: "hunyuan3d_v3_image_to_3d", label: "Hunyuan3D v3", maker: "Tencent", modes: ["image", "multi"], minImages: 1, maxImages: 4, family: "hunyuan", usd: 0.5, polyMin: 40000, polyMax: 1500000, polyDefault: 500000, blurb: "High face counts, one picture or several views" },
  { id: "sam_3_3d", label: "SAM 3D Objects", maker: "Meta", modes: ["image"], minImages: 1, maxImages: 1, family: "sam", usd: 0.2, polyMin: 0, polyMax: 0, polyDefault: 0, blurb: "Lifts the object out of a photo" },
  { id: "meshy_v6_text_to_3d", label: "Meshy 6 (text)", maker: "Meshy", modes: ["text"], minImages: 0, maxImages: 0, family: "meshy", usd: 0.3, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "Describe it, get a model" },
  { id: "tripo_3d", label: "Tripo (text)", maker: "Tripo", modes: ["text"], minImages: 0, maxImages: 0, family: "tripo", usd: 0.3, polyMin: 1000, polyMax: 2000000, polyDefault: 100000, blurb: "Describe it, with things to leave out" },
  { id: "hunyuan3d_v3_1_text_to_3d", label: "Hunyuan 3D v3.1 (text)", maker: "Tencent", modes: ["text"], minImages: 0, maxImages: 0, family: "hunyuan", usd: 0.3, polyMin: 40000, polyMax: 1500000, polyDefault: 500000, blurb: "Describe it, get a model" },
  // ---- ByteDance cloud (task API on ModelArk). Prices are PROVISIONAL (Seed3D 2.0 $0.353 at a reseller, Hyper3D about $0.40, Hitem3D a third-party estimate): measure
  // real cost from `usage.total_tokens` on the first tasks and correct them (DESIGN3D_USD_<ID> overrides). Seed3D 2.0 has no page on BytePlus, so it may need the other platform.
  { id: "seed3d_2_0", route: "ark", arkId: "doubao-seed3d-2-0-260328", off: true, label: "Seed3D 2.0", maker: "ByteDance", modes: ["image"], minImages: 1, maxImages: 1, family: "seed3d", usd: 0.35, polyMin: 100000, polyMax: 1000000, polyDefault: 500000, blurb: "ByteDance's own model: a textured PBR asset from one picture" },
  { id: "hyper3d_gen2", route: "ark", arkId: "hyper3d-gen2-260112", off: true, label: "Hyper3D Gen2", maker: "Deemos", modes: ["text", "image", "multi"], minImages: 0, maxImages: 5, family: "hyper3d", usd: 0.399, polyMin: 1000, polyMax: 200000, polyDefault: 18000, blurb: "Words or up to 5 pictures, clean quad meshes" },
  { id: "hitem3d_2_0", route: "ark", arkId: "hitem3d-2-0-251223", off: true, label: "Hitem3D 2.0", maker: "Hitem3D", modes: ["image", "multi"], minImages: 1, maxImages: 4, family: "hitem3d", usd: 1.4, polyMin: 100000, polyMax: 2000000, polyDefault: 150000, blurb: "Sharp geometry from 1 to 4 views (front, back, left, right)" },
];

export const find3D = (id: unknown): Model3DSpec | undefined => MODELS_3D.find((m) => m.id === id);
/** Is the model on? Higgsfield models always are; the ByteDance-cloud ones need ARK_API_KEY and, until their first real task passes, their id in ENABLED_MODELS. */
export function isOn3D(m: Model3DSpec): boolean {
  if (m.route !== "ark") return true;
  if (!process.env.ARK_API_KEY) return false;
  return !m.off || `${process.env.ENABLED_MODELS ?? ""}`.split(",").map((s) => s.trim()).includes(m.id);
}
export const visible3D = () => MODELS_3D.filter(isOn3D);
export const modelsFor = (mode: Mode3D) => MODELS_3D.filter((m) => m.modes.includes(mode));
export const arkModelId = (m: Model3DSpec): string => process.env[`ARK_3D_MODEL_${m.id.toUpperCase()}`] ?? m.arkId ?? m.id;
export const MAX_PROMPT_3D = 600;

/** BytePlus price list (12 Nov 2026): Hitem3D by mode (white or textured, standard or high precision); the others are one price per call. */
const HITEM_USD = { std: { white: 0.8, tex: 1.4 }, pro: { white: 1.2, tex: 1.8 } } as const;
function usdOf(m: Model3DSpec, o?: Pick<Options3D, "textured" | "detailed">): number {
  const v = Number(process.env[`DESIGN3D_USD_${m.id.toUpperCase()}`]);
  if (Number.isFinite(v) && v > 0) return v;
  if (m.family === "hitem3d") { const t = HITEM_USD[o?.detailed ? "pro" : "std"]; return o && !o.textured ? t.white : t.tex; }
  return m.usd;
}
/** Ledger units held and charged for one model (with the chosen options, the price of that mode; without, the default textured one). */
export const price3D = (m: Model3DSpec, o?: Pick<Options3D, "textured" | "detailed">): number => toLedger(creditsForUsd(usdOf(m, o)));
export const path3D = (m: Model3DSpec): string => (process.env[`HIGGSFIELD_3D_PATH_${m.id.toUpperCase()}`] ?? m.id).replace(/^\/+/, "");

export type Options3D = { textured: boolean; pbr: boolean; polycount: number | null; detailed: boolean; avoid: string; rig: boolean };
export function cleanOptions(m: Model3DSpec, raw: unknown): Options3D {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = Number(o.polycount);
  const polycount = m.polyMax > 0 && Number.isFinite(n) && n > 0 ? Math.round(Math.min(m.polyMax, Math.max(m.polyMin, n))) : null;
  const textured = o.textured !== false, pbr = textured && o.pbr === true;
  return { textured, pbr, polycount, detailed: o.detailed === true, avoid: typeof o.avoid === "string" ? o.avoid.trim().slice(0, 1024) : "", rig: m.rig === true && o.rig === true };
}

/** The request body for one model. Field names follow the catalog (see the NOT VERIFIED note above). */
export function buildBody3D(m: Model3DSpec, mode: Mode3D, o: { prompt: string; urls: string[]; options: Options3D }): Record<string, unknown> {
  const { textured, pbr, polycount, detailed, avoid, rig } = o.options;
  if (m.route === "ark") return buildArkBody(m, mode, o);
  const body: Record<string, unknown> = {};
  if (mode === "text") body.prompt = o.prompt;
  else if (mode === "image" || o.urls.length === 1) body.image_url = o.urls[0];
  else body.image_urls = o.urls;
  if (mode === "image" && o.urls.length > 1) body.image_urls = o.urls;
  if (m.family === "sam") { body.export_textured_glb = textured; return body; }
  if (m.family === "meshy") {
    if (rig) { body.enable_rigging = true; body.pose_mode = "a-pose"; }
    if (mode === "text") { body.mode = textured ? "full" : "preview"; if (pbr) body.enable_pbr = true; if (polycount) body.target_polycount = polycount; }
    else { body.should_texture = textured; if (pbr) body.enable_pbr = true; if (polycount) body.target_polycount = polycount; }
  } else if (m.family === "tripo") {
    body.texture = textured; body.pbr = pbr; if (polycount) body.face_limit = polycount;
    body.texture_quality = detailed ? "detailed" : "standard"; body.geometry_quality = detailed ? "detailed" : "standard";
    if (mode === "text" && avoid) body.negative_prompt = avoid;
  } else if (m.family === "tripo2") {
    body.texture = textured; body.pbr = pbr; if (polycount) body.face_limit = polycount; body.texture_quality = detailed ? "detailed" : "standard";
  } else {
    if (mode === "text") { body.mode = pbr ? "pro" : "std"; if (pbr) { body.enable_pbr = true; if (polycount) body.face_count = polycount; } } else { body.enable_pbr = pbr; body.generate_type = textured ? "Normal" : "Geometry"; if (polycount) body.face_count = polycount; }
  }
  return body;
}

/** Seed3D takes a detail level, not a face count: the nearest of low (100k), medium (500k), high (1M). */
export const seedTier = (faces: number | null): "low" | "medium" | "high" => (faces == null || faces <= 0 ? "medium" : faces <= 250_000 ? "low" : faces <= 750_000 ? "medium" : "high");

/**
 * The task body for the ByteDance cloud: `{ model, content: [ {type:"text", text:"<prompt> --flag value ..."}, {type:"image_url", ...} ] }`. Flags are written into the text item.
 * Every task asks for a GLB (the viewer and our storage take one file); other formats are not offered yet. NOT run live.
 */
export function buildArkBody(m: Model3DSpec, mode: Mode3D, o: { prompt: string; urls: string[]; options: Options3D }): Record<string, unknown> {
  const { textured, pbr, polycount, detailed } = o.options;
  const flags: string[] = [];
  let text = "";
  if (m.family === "seed3d") flags.push(`--subdivisionlevel ${seedTier(polycount)}`, "--fileformat glb");
  else if (m.family === "hyper3d") {
    text = mode === "text" || o.prompt ? o.prompt.slice(0, 400) : ""; // English only, up to 400 characters, first in the text
    flags.push("--mesh_mode Quad", `--quality_override ${polycount ?? m.polyDefault}`, `--material ${textured ? (pbr ? "PBR" : "Shaded") : "None"}`, "--fileformat glb");
    if (textured && detailed) flags.push("--hd_texture true");
  } else {
    flags.push(`--resolution ${detailed ? "1536pro" : "1536"}`, `--face ${polycount ?? m.polyDefault}`, "--fileformat 2", `--request-type ${textured ? 3 : 1}`);
    if (o.urls.length > 1) flags.push(`--multi_images_bit ${"1".repeat(o.urls.length)}${"0".repeat(Math.max(0, 4 - o.urls.length))}`); // front, back, left, right in the order added
  }
  const content: Record<string, unknown>[] = [{ type: "text", text: [text, ...flags].filter(Boolean).join(" ") }];
  if (mode !== "text") for (const url of o.urls) content.push({ type: "image_url", image_url: { url } });
  return { model: arkModelId(m), content };
}
