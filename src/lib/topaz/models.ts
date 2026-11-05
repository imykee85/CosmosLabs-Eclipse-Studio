// Upscale: presets, sizes and prices. Pure functions, no network. The maker's own names stay in here; people see "Auto", "Faithful" and "Creative".
// Source of every number: the owner's Topaz docs pack (docs/topaz.md). Prices are credits of the maker; Eclipse turns them into dollars with the
// Config value TOPAZ_CREDIT_USD (NOT guessed: with it unset, Upscale stays switched off) and then into Eclipse credits at cost, rounded up to the cent.
export type Preset = "auto" | "faithful" | "creative";
export const PRESETS: Preset[] = ["auto", "faithful", "creative"];
export const PRESET_LABEL: Record<Preset, string> = { auto: "Auto", faithful: "Faithful", creative: "Creative" };
export const PRESET_HINT: Record<"image" | "video", Record<Preset, string>> = {
  image: { auto: "Best overall: sharper and richer", faithful: "Stays true to the original", creative: "Adds new detail, best for AI pictures" },
  video: { auto: "Best for AI video", faithful: "Stays true to the footage", creative: "Adds new detail, prompt-guided" },
};

export const MAX_IMAGE_MP = 256;       // input and output
export const MAX_IMAGE_SIDE = 32000;
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // the source is sent through this server in one piece
const round = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

// ---------- images ----------
type ImageSpec = { model: string; path: string; mpPerCredit: number };
export const IMAGE_SPECS: Record<Preset, ImageSpec> = {
  auto: { model: "Wonder 4", path: "/image/v1/enhance-gen/async", mpPerCredit: 8 },
  faithful: { model: "Upscale High Fidelity V3", path: "/image/v1/enhance/async", mpPerCredit: 24 },
  creative: { model: "Bloom 2", path: "/image/v1/enhance-gen/async", mpPerCredit: 2 },
};

export type ImageSize = { ok: true; w: number; h: number } | { ok: false; error: string };
export function imageOutputSize(w: number, h: number, scale: number): ImageSize {
  if (!(w > 0 && h > 0)) return { ok: false, error: "This picture's size is not known, so it cannot be upscaled." };
  if (![2, 4].includes(scale)) return { ok: false, error: "Choose 2x or 4x." };
  if ((w * h) / 1e6 > MAX_IMAGE_MP) return { ok: false, error: "This picture is already too large to upscale." };
  const ow = Math.round(w * scale), oh = Math.round(h * scale);
  if (ow > MAX_IMAGE_SIDE || oh > MAX_IMAGE_SIDE || (ow * oh) / 1e6 > MAX_IMAGE_MP) return { ok: false, error: `${scale}x would be too large. Try 2x.` };
  return { ok: true, w: ow, h: oh };
}
/** Credits of the maker for an image: one credit per `mpPerCredit` megapixels of OUTPUT, rounded up. */
export const imageTopazCredits = (preset: Preset, outW: number, outH: number): number => Math.max(1, Math.ceil(((outW * outH) / 1e6) / IMAGE_SPECS[preset].mpPerCredit - 1e-9));

export function imageFormFields(preset: Preset, outW: number, outH: number, opts: { creativity?: number } = {}): Record<string, string> {
  const f: Record<string, string> = { model: IMAGE_SPECS[preset].model, output_format: "jpeg", output_width: String(outW), output_height: String(outH) };
  if (preset === "creative") {
    f.creativity = String(Math.min(9, Math.max(1, Math.round(opts.creativity ?? 3))));
    f.autoprompt = "true"; f.colorPreservation = "true";
  }
  return f;
}

// ---------- video ----------
type VideoSpec = { model: string; label: string };
export const VIDEO_SPECS: Record<Preset, VideoSpec> = {
  auto: { model: "slp-2.6", label: "Starlight Precise 2.6" },
  faithful: { model: "prob-4", label: "Proteus" },
  creative: { model: "ast-2", label: "Astra 2" },
};
export type VideoTarget = "1080p" | "4k";
export const VIDEO_TARGETS: VideoTarget[] = ["1080p", "4k"];
export const TARGET_HEIGHT: Record<VideoTarget, number> = { "1080p": 1080, "4k": 2160 };

export type VideoSize = { ok: true; w: number; h: number } | { ok: false; error: string };
/** The output size for a target height, keeping the shape (multiples of 4, as the maker rounds up). Only ever larger than the source. */
export function videoOutputSize(w: number, h: number, target: VideoTarget): VideoSize {
  if (!(w > 0 && h > 0)) return { ok: false, error: "This video's size is not known, so it cannot be upscaled." };
  const short = Math.min(w, h), th = TARGET_HEIGHT[target];
  if (short >= th) return { ok: false, error: `This video is already ${short >= 2160 ? "4K" : "1080p"} or larger.` };
  const k = th / short;
  const ow = round(w * k, 4), oh = round(h * k, 4);
  if (Math.max(ow, oh) > 4096) return { ok: false, error: "That output is too large for this video's shape." };
  return { ok: true, w: ow, h: oh };
}

/** Credits of the maker for a video, estimated from the docs' formulas (the maker's own estimate is checked again before anything is accepted). */
export function videoTopazCredits(preset: Preset, p: { inW: number; inH: number; outW: number; outH: number; seconds: number; fps: number }): number {
  const frames = Math.max(1, Math.ceil(p.seconds * p.fps));
  const big = Math.min(p.outW, p.outH) > 1080;
  let base: number;
  if (preset === "auto") base = frames / (big ? 11.9179 : 26.0417);
  else if (preset === "creative") base = frames / (big ? 6 : 10);
  else {
    // 2 credits per gigapixel, billed at the next scale step (up to 1.2x = 1x, up to 2.4x = 2x, more = 4x) of the SOURCE size.
    const scale = Math.min(p.outW / p.inW, p.outH / p.inH);
    const step = scale <= 1.2 ? 1 : scale <= 2.4 ? 2 : 4;
    base = ((p.inW * step * p.inH * step * frames) / 1e9) * 2;
  }
  // The maker also bills 1 credit per GiB of output file (a few hundredths for a short clip). The docs' own examples leave it out, so it is not added here;
  // the maker's estimate is compared with this one before anything is accepted (see runVideo).
  return Math.max(1, Math.ceil(base - 1e-9));
}

export function videoFilter(preset: Preset, opts: { creativity?: number } = {}): Record<string, unknown> {
  if (preset === "creative") return { model: VIDEO_SPECS.creative.model, creativity: Math.min(1, Math.max(0, opts.creativity ?? 0.3)), sharp: 0.5 };
  return { model: VIDEO_SPECS[preset].model };
}

// ---------- money ----------
/** Dollars per Topaz credit. Unset or not a positive number: Upscale is off (the owner sets it from their plan; it is not guessed). */
export const topazCreditUsd = (): number => { const n = Number(process.env.TOPAZ_CREDIT_USD); return Number.isFinite(n) && n > 0 ? n : 0; };
export const topazConfigured = (): boolean => Boolean(process.env.TOPAZ_API_KEY) && topazCreditUsd() > 0;
