import type { AudioKind } from "./types";

// The audio model registry: model ids, limits, prices and which controls a model supports live HERE (config), never in adapters.
// A control a model cannot use is greyed in the UI, not removed. Prices are USD: `price` per `per` units of `priceUnit`.
export type AudioModel = {
  id: string;
  provider: "elevenlabs" | "fake";
  label: string;
  kinds: AudioKind[];
  maxChars: number;          // characters per job (the text box counter)
  callChars: number;         // characters per provider request: longer text is split at sentence ends and joined (chunk.ts)
  priceUnit: "char" | "byte" | "second" | "minute" | "hour" | "request";
  price: number;
  per: number;
  supports: { emotionTags: boolean; speed: boolean; pitch: boolean; voiceClone: boolean; streaming: boolean; subtitles: boolean };
  deprecatedOn?: string;
  note?: string;
};

const TAGS_AND_SPEED = { emotionTags: true, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } as const;

export const AUDIO_MODELS: AudioModel[] = [
  { id: "eleven_v4", provider: "elevenlabs", label: "Eleven v4", kinds: ["tts"], maxChars: 10000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { ...TAGS_AND_SPEED }, note: "Flagship, 90+ languages, audio tags such as [whispers]" },
  // The reference gives no character limit for Turbo; 5,000 is a cautious guess (VERIFY).
  { id: "eleven_v4_turbo", provider: "elevenlabs", label: "Eleven v4 Turbo", kinds: ["tts"], maxChars: 5000, callChars: 5000, priceUnit: "char", price: 0.04, per: 1000, supports: { ...TAGS_AND_SPEED }, note: "About 100 ms, audio tags" },
  { id: "eleven_v3", provider: "elevenlabs", label: "Eleven v3", kinds: ["tts"], maxChars: 5000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { ...TAGS_AND_SPEED } },
  { id: "eleven_multilingual_v2", provider: "elevenlabs", label: "Multilingual v2", kinds: ["tts"], maxChars: 10000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false }, note: "Most stable for long reads" },
  { id: "eleven_flash_v2_5", provider: "elevenlabs", label: "Flash v2.5", kinds: ["tts"], maxChars: 40000, callChars: 5000, priceUnit: "char", price: 0.04, per: 1000, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false }, note: "About 75 ms, 32 languages" },
];

// A stand-in model for tests and local runs (AUDIO_FAKE=1): talks to a fake server, never to a real provider.
export const FAKE_MODEL: AudioModel = { id: "fake-tts", provider: "fake", label: "Test voice", kinds: ["tts"], maxChars: 2000, callChars: 80, priceUnit: "char", price: 0.08, per: 1000, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: false, streaming: false, subtitles: false } };

export const fakeEnabled = () => process.env.AUDIO_FAKE === "1";

export function audioModels(): AudioModel[] {
  return fakeEnabled() ? [...AUDIO_MODELS, FAKE_MODEL] : AUDIO_MODELS;
}

export const findAudioModel = (id: unknown): AudioModel | undefined => (typeof id === "string" ? audioModels().find((m) => m.id === id) : undefined);
export const ttsModels = () => audioModels().filter((m) => m.kinds.includes("tts"));
