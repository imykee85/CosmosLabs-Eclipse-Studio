import type { AudioKind } from "./types";

// The audio model registry: model ids, limits, prices and which controls a model supports live HERE (config), never in adapters.
// A control a model cannot use is greyed in the UI, not removed. Prices are USD: `price` per `per` units of `priceUnit`.
export type AudioProviderId = "elevenlabs" | "fish" | "minimax" | "qwen" | "seed" | "fake";
export type AudioModel = {
  id: string;
  provider: AudioProviderId;
  label: string;
  kinds: AudioKind[];
  maxChars: number;          // characters per job (the text box counter)
  callChars: number;         // size per provider request (in `callUnit`): longer text is split at sentence ends and joined (chunk.ts)
  callUnit?: "char" | "byte"; // default "char"; Fish counts UTF-8 bytes
  priceUnit: "char" | "byte" | "second" | "minute" | "hour" | "request";
  price: number;
  per: number;
  supports: { emotionTags: boolean; speed: boolean; pitch: boolean; voiceClone: boolean; streaming: boolean; subtitles: boolean };
  tags?: string[];           // the delivery tags offered in the menu, written exactly as the model reads them ([whispers] or (laughs))
  voiceOptional?: boolean;   // the model can speak without a chosen voice (Seed Audio: the script describes the voice)
  maxSeconds?: number;       // second-priced models: the longest result, used for the price hold
  deprecatedOn?: string;
  endsOn?: string;           // the provider stops serving it after this date (YYYY-MM-DD)
  note?: string;
};

// The provider names shown as groups in the model menu.
export const PROVIDER_LABEL: Record<AudioProviderId, string> = { elevenlabs: "ElevenLabs", fish: "Fish Audio", minimax: "MiniMax", qwen: "Qwen", seed: "Seed Audio", fake: "Test" };

const ELEVEN_TAGS = ["[whispers]", "[laughs]", "[sighs]", "[excited]", "[sarcastic]", "[crying]"];
// Fish S2: free-form bracket cues at the start of a sentence; NEVER (parenthesis) tags (docs/audio-providers/fish-audio.md section 4).
const FISH_TAGS = ["[happy]", "[sad]", "[whispering]", "[laughing]", "[sighing]", "[excited]", "[calm]", "[break]", "[long-break]"];
// MiniMax: interjection tags only on speech-2.8, in parentheses; <#1.5#> is a pause (docs/audio-providers/minimax.md section 4).
const MINIMAX_TAGS = ["(laughs)", "(chuckle)", "(sighs)", "(breath)", "(gasps)", "(clear-throat)", "(emm)", "<#1#>"];
const NO_EXTRAS = { pitch: false, voiceClone: false, streaming: false, subtitles: false } as const;

const TAGS_AND_SPEED = { emotionTags: true, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false } as const;

export const AUDIO_MODELS: AudioModel[] = [
  { id: "eleven_v4", provider: "elevenlabs", label: "Eleven v4", kinds: ["tts"], maxChars: 10000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { ...TAGS_AND_SPEED }, tags: ELEVEN_TAGS, note: "Flagship, 90+ languages, audio tags such as [whispers]" },
  // The reference gives no character limit for Turbo; 5,000 is a cautious guess (VERIFY).
  { id: "eleven_v4_turbo", provider: "elevenlabs", label: "Eleven v4 Turbo", kinds: ["tts"], maxChars: 5000, callChars: 5000, priceUnit: "char", price: 0.04, per: 1000, supports: { ...TAGS_AND_SPEED }, tags: ELEVEN_TAGS, note: "About 100 ms, audio tags" },
  { id: "eleven_v3", provider: "elevenlabs", label: "Eleven v3", kinds: ["tts"], maxChars: 5000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { ...TAGS_AND_SPEED }, tags: ELEVEN_TAGS },
  { id: "eleven_multilingual_v2", provider: "elevenlabs", label: "Multilingual v2", kinds: ["tts"], maxChars: 10000, callChars: 5000, priceUnit: "char", price: 0.08, per: 1000, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false }, note: "Most stable for long reads" },
  { id: "eleven_flash_v2_5", provider: "elevenlabs", label: "Flash v2.5", kinds: ["tts"], maxChars: 40000, callChars: 5000, priceUnit: "char", price: 0.04, per: 1000, supports: { emotionTags: false, speed: true, pitch: false, voiceClone: true, streaming: true, subtitles: false }, note: "About 75 ms, 32 languages" },

  // Fish Audio (docs/audio-providers/fish-audio.md). Priced and limited in UTF-8 bytes. The reference states no maximum text length: 10,000 chars per job and
  // 2,000 bytes per call are cautious (VERIFY). drama-3 is not registered (price not stated); s1 retires 2026-12-31 and is not registered.
  { id: "s2.1-pro", provider: "fish", label: "Fish S2.1 Pro", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: FISH_TAGS, note: "83 languages, bracket cues such as [happy]" },
  // The free model still charges Eclipse credits (at the Pro price) and is switched off with AUDIO_FISH_FREE_ENABLED=0 or after 2026-11-30.
  { id: "s2.1-pro-free", provider: "fish", label: "Fish S2.1 Pro (free tier)", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: FISH_TAGS, endsOn: "2026-11-30", note: "Same model, fair use, no latency guarantee" },
  { id: "s2-pro", provider: "fish", label: "Fish S2 Pro", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: FISH_TAGS },

  // MiniMax sync TTS (docs/audio-providers/minimax.md section 4): under 10,000 chars per request; calls kept to 3,000 so each answers quickly. Long async TTS is phase 6.
  { id: "speech-2.8-hd", provider: "minimax", label: "MiniMax Speech 2.8 HD", kinds: ["tts"], maxChars: 10000, callChars: 3000, priceUnit: "char", price: 100, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: MINIMAX_TAGS, note: "40 languages, interjections such as (laughs)" },
  { id: "speech-2.8-turbo", provider: "minimax", label: "MiniMax Speech 2.8 Turbo", kinds: ["tts"], maxChars: 10000, callChars: 3000, priceUnit: "char", price: 60, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: MINIMAX_TAGS },
  { id: "speech-2.6-hd", provider: "minimax", label: "MiniMax Speech 2.6 HD", kinds: ["tts"], maxChars: 10000, callChars: 3000, priceUnit: "char", price: 100, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },
  { id: "speech-2.6-turbo", provider: "minimax", label: "MiniMax Speech 2.6 Turbo", kinds: ["tts"], maxChars: 10000, callChars: 3000, priceUnit: "char", price: 60, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },

  // Qwen (docs/audio-providers/qwen3-tts.md): 600 chars per request, so a job of up to 6,000 is split into calls and the WAV pieces joined. No speed control is
  // documented. qwen3-tts-instruct-flash waits until its instruction field is verified.
  { id: "qwen3-tts-flash", provider: "qwen", label: "Qwen3 TTS Flash", kinds: ["tts"], maxChars: 6000, callChars: 600, priceUnit: "char", price: 0.1, per: 10_000, supports: { emotionTags: false, speed: false, ...NO_EXTRAS }, note: "10 languages, set automatically" },

  // Seed Audio 1.0 (docs/audio-providers/seed-audio.md): speech with sound and ambience from one prompt, up to 120 s, billed by the seconds made. The direct BytePlus
  // price is NOT STATED: $0.00263 per second is a third-party price used as a PROVISIONAL placeholder.
  { id: "seed-audio-1.0", provider: "seed", label: "Seed Audio 1.0", kinds: ["tts"], maxChars: 3000, callChars: 3000, priceUnit: "second", price: 0.00263, per: 1, maxSeconds: 120, voiceOptional: true, supports: { emotionTags: false, speed: true, ...NO_EXTRAS }, note: "Speech plus sound and ambience, up to 120 s" },
];

// A stand-in model for tests and local runs (AUDIO_FAKE=1): talks to a fake server, never to a real provider.
export const FAKE_MODEL: AudioModel = { id: "fake-tts", provider: "fake", label: "Test voice", kinds: ["tts"], maxChars: 2000, callChars: 80, priceUnit: "char", price: 0.08, per: 1000, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: false, streaming: false, subtitles: false }, tags: ELEVEN_TAGS };

export const fakeEnabled = () => process.env.AUDIO_FAKE === "1";

// AUDIO_FISH_FREE_ENABLED (Config value): 0 turns the free Fish model off at once; it also goes away by itself after its end date.
const fishFreeOn = () => process.env.AUDIO_FISH_FREE_ENABLED !== "0" && process.env.AUDIO_FISH_FREE_ENABLED !== "false";
const live = (m: AudioModel, today = new Date().toISOString().slice(0, 10)) => (!m.endsOn || today <= m.endsOn) && (m.id !== "s2.1-pro-free" || fishFreeOn());

export function audioModels(): AudioModel[] {
  const list = AUDIO_MODELS.filter((m) => live(m));
  return fakeEnabled() ? [...list, FAKE_MODEL] : list;
}

export const findAudioModel = (id: unknown): AudioModel | undefined => (typeof id === "string" ? audioModels().find((m) => m.id === id) : undefined);
export const ttsModels = () => audioModels().filter((m) => m.kinds.includes("tts"));
