import type { AudioModel } from "./registry";

// Provider cost in USD for a number of units of the model's price unit (chars, bytes, seconds...).
export const usdFor = (m: AudioModel, units: number) => (Math.max(0, units) / m.per) * m.price;

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
  return ((m.price / m.per) * margin) / creditUsd;
}
