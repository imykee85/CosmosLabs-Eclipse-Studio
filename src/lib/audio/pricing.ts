import { estimateSeconds } from "./pricing-client";
import { priceOf, type AudioModel } from "./registry";

// Provider cost in USD for a number of units of the model's price unit (chars, bytes, seconds...).
export const usdFor = (m: AudioModel, units: number) => (Math.max(0, units) / m.per) * priceOf(m);

// Credits: provider cost x margin, converted at USD per credit, rounded UP (at least 1). Config values: AUDIO_MARGIN (default 1.25), AUDIO_CREDIT_USD (default 0.008,
// a credit on the cheapest placeholder plan). Provisional until real bills are matched (docs/video-pricing.md has the same approach for video).
export function creditsFor(usd: number): number {
  const margin = Number(process.env.AUDIO_MARGIN) > 0 ? Number(process.env.AUDIO_MARGIN) : 1.25;
  const creditUsd = Number(process.env.AUDIO_CREDIT_USD) > 0 ? Number(process.env.AUDIO_CREDIT_USD) : 0.008;
  return Math.max(1, Math.ceil((usd * margin) / creditUsd));
}

// Credits for a text of `chars` characters (a "char" priced model). Null when the model is not priced per character.
export function ttsCredits(m: AudioModel, chars: number): number | null {
  return m.priceUnit === "char" ? creditsFor(usdFor(m, chars)) : null;
}

export const audioCreditsOn = () => process.env.CREDITS_ENABLED === "1";

// Credits per single character (a fraction), so the page can show the same price the server will hold: max(1, ceil(chars x this)).
export function creditsPerChar(m: AudioModel): number | null {
  if (m.priceUnit !== "char") return null;
  const margin = Number(process.env.AUDIO_MARGIN) > 0 ? Number(process.env.AUDIO_MARGIN) : 1.25;
  const creditUsd = Number(process.env.AUDIO_CREDIT_USD) > 0 ? Number(process.env.AUDIO_CREDIT_USD) : 0.008;
  return ((priceOf(m) / m.per) * margin) / creditUsd;
}

// The units a text costs before it is made: characters, or UTF-8 bytes (Fish). A second-priced model (Seed Audio) is held at its longest result.
export function holdUnits(m: AudioModel, text: string): number {
  if (m.priceUnit === "byte") return Buffer.byteLength(text, "utf8");
  if (m.priceUnit === "second") return m.maxSeconds ?? 120;
  return text.length;
}

// The units actually billed once made: the seconds the provider reports (never more than the hold), else the same units as the hold.
export function settledUnits(m: AudioModel, text: string, seconds?: number): number {
  if (m.priceUnit === "second") return Math.min(m.maxSeconds ?? 120, seconds != null && seconds > 0 ? seconds : m.maxSeconds ?? 120);
  return holdUnits(m, text);
}

// Credits per unit (a fraction) for the page's price label, and the unit it counts. Seconds cannot be known before the take is made, so the label shows the hold.
export function pagePricing(m: AudioModel): { unit: "char" | "byte"; perUnit: number } | { unit: "max"; credits: number } | { unit: "sec"; perSec: number } | null {
  const margin = Number(process.env.AUDIO_MARGIN) > 0 ? Number(process.env.AUDIO_MARGIN) : 1.25;
  const creditUsd = Number(process.env.AUDIO_CREDIT_USD) > 0 ? Number(process.env.AUDIO_CREDIT_USD) : 0.008;
  if (m.priceUnit === "char" || m.priceUnit === "byte") return { unit: m.priceUnit, perUnit: ((priceOf(m) / m.per) * margin) / creditUsd };
  if (m.priceUnit === "second" && m.maxVariants) return { unit: "sec", perSec: ((priceOf(m) / m.per) * margin) / creditUsd }; // per second per variant (the page multiplies)
  if (m.priceUnit === "second") return { unit: "max", credits: creditsFor(usdFor(m, m.maxSeconds ?? 120)) };
  if (m.priceUnit === "hour" || m.priceUnit === "minute") return { unit: "sec", perSec: ((priceOf(m) / m.per) * margin) / creditUsd }; // by the length of the audio
  return null;
}

// Audio length is not known before the work is done, so the hold uses a ceiling: the clip length asked for (sound effects and music), or an upper estimate from the size
// of a recording (a compressed file is rarely above 128 kbit/s, so size x 8 / 128,000 is a safe over-estimate).
export { estimateSeconds } from "./pricing-client";
export function holdUnitsFor(m: AudioModel, b: { text?: string; durationSec?: number; inputBytes?: number; variants?: number }): number {
  if (m.maxVariants) return (b.durationSec ?? 30) * Math.min(m.maxVariants, Math.max(1, Math.floor(b.variants ?? 1))); // billed per second per variant
  if (m.kinds.includes("stt")) return Math.min(estimateSeconds(b.inputBytes ?? 0), m.maxInputSeconds ?? 36000);
  if (m.kinds.includes("sfx")) return b.durationSec ?? m.maxSeconds ?? 30;
  if (m.kinds.includes("music")) return b.durationSec ?? 60;
  return holdUnits(m, b.text ?? "");
}
