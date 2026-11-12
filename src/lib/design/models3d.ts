// Design Studio's 3D generator: which makers and modes are offered, what each is sent, and what it costs. NOT VERIFIED against the live API (the request
// pages for 3D were not available): the endpoint path of each model defaults to its catalog id and can be set with HIGGSFIELD_3D_PATH_<ID> (Config value),
// and the price is a PROVISIONAL maker cost in dollars (override with DESIGN3D_USD_<ID>). Charged at that cost rounded up to the cent, like images and video.
import { creditsForUsd } from "../price-constants";
import { toLedger } from "../credit-units";

export type Mode3D = "image" | "multi" | "text";
export type Model3DSpec = {
  id: string; label: string; maker: string; modes: Mode3D[]; maxImages: number; minImages: number;
  family: "meshy" | "tripo" | "hunyuan"; usd: number; polyMin: number; polyMax: number; polyDefault: number; blurb: string;
};

export const MODELS_3D: Model3DSpec[] = [
  { id: "meshy_v7_image_to_3d", label: "Meshy 7", maker: "Meshy", modes: ["image"], minImages: 1, maxImages: 1, family: "meshy", usd: 0.4, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "One picture to a textured model" },
  { id: "meshy_multi_image_to_3d", label: "Meshy Multi-view", maker: "Meshy", modes: ["multi"], minImages: 1, maxImages: 4, family: "meshy", usd: 0.5, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "Up to 4 views of the same thing, truer shape" },
  { id: "tripo_h3_1_image_to_3d", label: "Tripo H3.1", maker: "Tripo", modes: ["image"], minImages: 1, maxImages: 1, family: "tripo", usd: 0.4, polyMin: 1000, polyMax: 2000000, polyDefault: 100000, blurb: "Detailed textures, PBR materials" },
  { id: "tripo_h3_1_multiview_to_3d", label: "Tripo H3.1 Multi-view", maker: "Tripo", modes: ["multi"], minImages: 2, maxImages: 4, family: "tripo", usd: 0.5, polyMin: 1000, polyMax: 2000000, polyDefault: 100000, blurb: "2 to 4 views in order: front, left, right, back" },
  { id: "hunyuan3d_v3_image_to_3d", label: "Hunyuan3D v3", maker: "Tencent", modes: ["image", "multi"], minImages: 1, maxImages: 4, family: "hunyuan", usd: 0.5, polyMin: 40000, polyMax: 1500000, polyDefault: 500000, blurb: "High face counts, one picture or several views" },
  { id: "meshy_v6_text_to_3d", label: "Meshy 6 (text)", maker: "Meshy", modes: ["text"], minImages: 0, maxImages: 0, family: "meshy", usd: 0.3, polyMin: 100, polyMax: 300000, polyDefault: 30000, blurb: "Describe it, get a model" },
  { id: "hunyuan3d_v3_1_text_to_3d", label: "Hunyuan 3D v3.1 (text)", maker: "Tencent", modes: ["text"], minImages: 0, maxImages: 0, family: "hunyuan", usd: 0.3, polyMin: 40000, polyMax: 1500000, polyDefault: 500000, blurb: "Describe it, get a model" },
];

export const find3D = (id: unknown): Model3DSpec | undefined => MODELS_3D.find((m) => m.id === id);
export const modelsFor = (mode: Mode3D) => MODELS_3D.filter((m) => m.modes.includes(mode));
export const MAX_PROMPT_3D = 600;

function usdOf(m: Model3DSpec): number {
  const v = Number(process.env[`DESIGN3D_USD_${m.id.toUpperCase()}`]);
  return Number.isFinite(v) && v > 0 ? v : m.usd;
}
/** Ledger units held and charged for one model. */
export const price3D = (m: Model3DSpec): number => toLedger(creditsForUsd(usdOf(m)));
export const path3D = (m: Model3DSpec): string => (process.env[`HIGGSFIELD_3D_PATH_${m.id.toUpperCase()}`] ?? m.id).replace(/^\/+/, "");

export type Options3D = { textured: boolean; pbr: boolean; polycount: number | null };
export function cleanOptions(m: Model3DSpec, raw: unknown): Options3D {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = Number(o.polycount);
  const polycount = Number.isFinite(n) && n > 0 ? Math.round(Math.min(m.polyMax, Math.max(m.polyMin, n))) : null;
  const textured = o.textured !== false, pbr = textured && o.pbr === true;
  return { textured, pbr, polycount };
}

/** The request body for one model. Field names follow the catalog (see the NOT VERIFIED note above). */
export function buildBody3D(m: Model3DSpec, mode: Mode3D, o: { prompt: string; urls: string[]; options: Options3D }): Record<string, unknown> {
  const { textured, pbr, polycount } = o.options;
  const body: Record<string, unknown> = {};
  if (mode === "text") body.prompt = o.prompt;
  else if (mode === "image" || o.urls.length === 1) body.image_url = o.urls[0];
  else body.image_urls = o.urls;
  if (mode === "image" && o.urls.length > 1) body.image_urls = o.urls;
  if (m.family === "meshy") {
    if (mode === "text") { body.mode = textured ? "full" : "preview"; if (pbr) body.enable_pbr = true; if (polycount) body.target_polycount = polycount; }
    else { body.should_texture = textured; if (pbr) body.enable_pbr = true; if (polycount) body.target_polycount = polycount; }
  } else if (m.family === "tripo") {
    body.texture = textured; body.pbr = pbr; if (polycount) body.face_limit = polycount;
  } else {
    if (mode === "text") { body.mode = "std"; } else { body.enable_pbr = pbr; body.generate_type = textured ? "Normal" : "Geometry"; if (polycount) body.face_count = polycount; }
  }
  return body;
}
