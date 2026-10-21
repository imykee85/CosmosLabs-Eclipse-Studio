import type { AudioKind } from "./types";

// The audio model registry: model ids, limits, prices and which controls a model supports live HERE (config), never in adapters.
// A control a model cannot use is greyed in the UI, not removed. Prices are USD: `price` per `per` units of `priceUnit`.
export type AudioProviderId = "elevenlabs" | "fish" | "minimax" | "qwen" | "seed" | "mirelo" | "fake";
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
  maxSeconds?: number;       // second-priced models: the longest result, used for the price hold; sfx and music: the longest clip
  minSeconds?: number;       // sfx and music: the shortest clip
  maxInputBytes?: number;    // speech to text: the largest file the model takes
  maxInputSeconds?: number;  // speech to text: the longest recording the model takes
  diarize?: boolean;         // speech to text: can tell speakers apart
  loop?: boolean;            // sfx: can make a clip that loops
  instrumental?: boolean;    // music: can leave vocals out
  asyncAbove?: number;       // text longer than this many characters runs as a long job on the provider's side (MiniMax)
  maxVariants?: number;      // sound effects and sound for video: how many alternatives one job can make (billed per variant)
  negativePrompt?: boolean;  // sfx: accepts "what to leave out"
  videoInput?: boolean;      // can make sound for a video ("Add sound")
  durationRequired?: boolean; // sfx: a length must be chosen (no Auto)
  formats?: string[];        // output formats offered (first is the default): wav, mp3
  asyncAlways?: boolean;     // always runs on the provider's side and is followed by polling (Mirelo)
  promo?: { price: number; until: string }; // a lower launch price until this date (YYYY-MM-DD, inclusive)
  priceEnv?: string;         // a Config value (USD per unit) that replaces the registry price
  needsEnv?: string;         // the model is listed only when this Config value is set (Fish drama-3's price)
  deprecatedOn?: string;
  endsOn?: string;           // the provider stops serving it after this date (YYYY-MM-DD)
  note?: string;
};

// The provider names shown as groups in the model menu.
// Providers kept in the code but not offered to people (Qwen and Seed Audio are V2, owner 2026-10-21; see docs/v2.md).
export const HIDDEN_PROVIDERS: AudioProviderId[] = ["qwen", "seed"];
export const PROVIDER_LABEL: Record<AudioProviderId, string> = { elevenlabs: "ElevenLabs", fish: "Fish Audio", minimax: "MiniMax", qwen: "Qwen", seed: "Seed Audio", mirelo: "Mirelo", fake: "Test" };

const ELEVEN_TAGS = ["[whispers]", "[laughs]", "[sighs]", "[excited]", "[sarcastic]", "[crying]"];
// Fish S2: free-form bracket cues at the start of a sentence; NEVER (parenthesis) tags (docs/audio-providers/fish-audio.md section 4).
const FISH_TAGS = ["[happy]", "[sad]", "[whispering]", "[laughing]", "[sighing]", "[excited]", "[calm]", "[break]", "[long-break]"];
// MiniMax: interjection tags only on speech-2.8, in parentheses; <#1.5#> is a pause (docs/audio-providers/minimax.md section 4).
const MINIMAX_TAGS = ["(laughs)", "(chuckle)", "(sighs)", "(breath)", "(gasps)", "(clear-throat)", "(emm)", "<#1#>"];
const NO_EXTRAS = { pitch: false, voiceClone: false, streaming: false, subtitles: false } as const;
const NONE = { emotionTags: false, speed: false, ...NO_EXTRAS } as const;
const MB = 1024 * 1024;

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
  { id: "s2.1-pro-free", provider: "fish", label: "Fish S2.1 Pro (free tier)", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: FISH_TAGS, endsOn: "2026-11-30", note: "Same model, may be slower" },
  { id: "s2-pro", provider: "fish", label: "Fish S2 Pro", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: FISH_TAGS },
  // Drama 3 (plain-language direction, language switching experimental). Its price is NOT STATED, so it is listed only once the owner sets FISH_DRAMA3_PRICE_PER_MILLION_BYTES (USD).
  { id: "drama-3", provider: "fish", label: "Fish Drama 3", kinds: ["tts"], maxChars: 10000, callChars: 2000, callUnit: "byte", priceUnit: "byte", price: 15, per: 1_000_000, needsEnv: "FISH_DRAMA3_PRICE_PER_MILLION_BYTES", supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: ["[whispering]", "[laughing]", "[sighing]", "[excited]", "[calm]", "[break]"], note: "Plain-language direction in brackets" },

  // MiniMax sync TTS (docs/audio-providers/minimax.md section 4): under 10,000 chars per request; calls kept to 3,000 so each answers quickly. Long async TTS is phase 6.
  { id: "speech-2.8-hd", provider: "minimax", label: "MiniMax Speech 2.8 HD", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 100, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: MINIMAX_TAGS, note: "40 languages, interjections such as (laughs)" },
  { id: "speech-2.8-turbo", provider: "minimax", label: "MiniMax Speech 2.8 Turbo", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 60, per: 1_000_000, supports: { emotionTags: true, speed: true, ...NO_EXTRAS }, tags: MINIMAX_TAGS },
  { id: "speech-2.6-hd", provider: "minimax", label: "MiniMax Speech 2.6 HD", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 100, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },
  { id: "speech-2.6-turbo", provider: "minimax", label: "MiniMax Speech 2.6 Turbo", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 60, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },
  { id: "speech-02-hd", provider: "minimax", label: "MiniMax Speech 02 HD", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 100, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },
  { id: "speech-02-turbo", provider: "minimax", label: "MiniMax Speech 02 Turbo", kinds: ["tts"], maxChars: 50000, callChars: 3000, asyncAbove: 3000, priceUnit: "char", price: 60, per: 1_000_000, supports: { emotionTags: false, speed: true, ...NO_EXTRAS } },

  // Qwen (docs/audio-providers/qwen3-tts.md): 600 chars per request, so a job of up to 6,000 is split into calls and the WAV pieces joined. No speed control is
  // documented. qwen3-tts-instruct-flash waits until its instruction field is verified.
  { id: "qwen3-tts-flash", provider: "qwen", label: "Qwen3 TTS Flash", kinds: ["tts"], maxChars: 6000, callChars: 600, priceUnit: "char", price: 0.1, per: 10_000, supports: { emotionTags: false, speed: false, ...NO_EXTRAS }, note: "10 languages, set automatically" },

  // Seed Audio 1.0 (docs/audio-providers/seed-audio.md): speech with sound and ambience from one prompt, up to 120 s, billed by the seconds made. The direct BytePlus
  // price is NOT STATED: $0.00263 per second is a third-party price used as a PROVISIONAL placeholder.
  // Speech to text, sound effects and music (docs/audio-providers: elevenlabs.md sections 6 to 8, fish-audio.md section 9, minimax.md section 9). Prices are per HOUR or
  // MINUTE of audio; `per` is in seconds so the same price maths works for every kind.
  { id: "scribe_v2", provider: "elevenlabs", label: "ElevenLabs Scribe v2", kinds: ["stt"], maxChars: 0, callChars: 0, priceUnit: "hour", price: 0.22, per: 3600, supports: NONE, diarize: true, maxInputBytes: 200 * MB, maxInputSeconds: 36000, note: "Speakers and timestamps" },
  { id: "transcribe-1-pro", provider: "fish", label: "Fish Transcribe 1 Pro", kinds: ["stt"], maxChars: 0, callChars: 0, priceUnit: "hour", price: 0.36, per: 3600, supports: NONE, diarize: true, maxInputBytes: 50 * MB, maxInputSeconds: 3600, note: "Up to 60 minutes; beta" },
  { id: "asr-1.0", provider: "minimax", label: "MiniMax ASR 1.0", kinds: ["stt"], maxChars: 0, callChars: 0, priceUnit: "hour", price: 0.38, per: 3600, supports: NONE, maxInputBytes: 50 * MB, maxInputSeconds: 500, note: "Up to 500 seconds" },
  { id: "eleven_text_to_sound_v2", provider: "elevenlabs", label: "ElevenLabs Sound Effects", kinds: ["sfx"], maxChars: 1000, callChars: 1000, priceUnit: "minute", price: 0.12, per: 60, supports: NONE, minSeconds: 0.5, maxSeconds: 30, loop: true, note: "0.5 to 30 seconds" },
  { id: "music_v2_5", provider: "elevenlabs", label: "ElevenLabs Music", kinds: ["music"], maxChars: 4100, callChars: 4100, priceUnit: "minute", price: 0.15, per: 60, supports: NONE, minSeconds: 3, maxSeconds: 600, instrumental: true, note: "No artist names or lyrics" },
  // Mirelo (docs/audio-providers/mirelo.md): sound effects from text and sound made for a VIDEO, billed per second per variant. List price $0.015 per second per variant
  // (15 credits a second) with a launch price of $0.010 until 2026-12-12; both are from a partner listing and PROVISIONAL until Mirelo's own credit price is read from its
  // Studio (override with MIRELO_PRICE_PER_SECOND). sfx-1.6 (extend, inpaint, stems) is not registered. Loop is refused by sfx-2.0, so `loop` stays off.
  { id: "sfx-2.0", provider: "mirelo", label: "Mirelo SFX 2.0", kinds: ["sfx", "vsfx"], maxChars: 2000, callChars: 2000, priceUnit: "second", price: 0.015, per: 1, promo: { price: 0.01, until: "2026-12-12" }, priceEnv: "MIRELO_PRICE_PER_SECOND", supports: NONE, minSeconds: 0.1, maxSeconds: 600, maxVariants: 4, negativePrompt: true, videoInput: true, durationRequired: true, formats: ["wav", "mp3"], asyncAlways: true, note: "Sound for video, or from text; keeps speech" },
  { id: "seed-audio-1.0", provider: "seed", label: "Seed Audio 1.0", kinds: ["tts"], maxChars: 3000, callChars: 3000, priceUnit: "second", price: 0.00263, per: 1, maxSeconds: 120, voiceOptional: true, supports: { emotionTags: false, speed: true, ...NO_EXTRAS }, note: "Speech plus sound and ambience, up to 120 s" },
];

// A stand-in model for tests and local runs (AUDIO_FAKE=1): talks to a fake server, never to a real provider.
export const FAKE_MODEL: AudioModel = { id: "fake-tts", provider: "fake", label: "Test voice", kinds: ["tts"], maxChars: 2000, callChars: 80, priceUnit: "char", price: 0.08, per: 1000, supports: { emotionTags: true, speed: true, pitch: false, voiceClone: false, streaming: false, subtitles: false }, tags: ELEVEN_TAGS };

export const fakeEnabled = () => process.env.AUDIO_FAKE === "1";

// AUDIO_FISH_FREE_ENABLED (Config value): 0 turns the free Fish model off at once; it also goes away by itself after its end date.
const fishFreeOn = () => process.env.AUDIO_FISH_FREE_ENABLED !== "0" && process.env.AUDIO_FISH_FREE_ENABLED !== "false";
const live = (m: AudioModel, today = new Date().toISOString().slice(0, 10)) => (!m.endsOn || today <= m.endsOn) && (m.id !== "s2.1-pro-free" || fishFreeOn()) && (!m.needsEnv || Number(process.env[m.needsEnv]) > 0);

// The price of a model whose price comes from Config (Fish drama-3), else the registry's.
export const priceOf = (m: AudioModel, today = new Date().toISOString().slice(0, 10)) => {
  if (m.needsEnv && Number(process.env[m.needsEnv]) > 0) return Number(process.env[m.needsEnv]);
  if (m.priceEnv && Number(process.env[m.priceEnv]) > 0) return Number(process.env[m.priceEnv]);
  return m.promo && today <= m.promo.until ? m.promo.price : m.price;
};
// The longest music clip allowed: the model's limit, or AUDIO_MUSIC_MAX_SECONDS (default 240, because a long clip must finish inside the 300 s function limit).
export const musicMaxSeconds = (m: AudioModel) => Math.min(m.maxSeconds ?? 240, Number(process.env.AUDIO_MUSIC_MAX_SECONDS) > 0 ? Number(process.env.AUDIO_MUSIC_MAX_SECONDS) : 240);
export const kindOf = (m: AudioModel): AudioKind => m.kinds[0];

export function audioModels(): AudioModel[] {
  const list = AUDIO_MODELS.filter((m) => live(m));
  return fakeEnabled() ? [...list, FAKE_MODEL] : list;
}

export const findAudioModel = (id: unknown): AudioModel | undefined => (typeof id === "string" ? audioModels().find((m) => m.id === id) : undefined);
export const ttsModels = () => audioModels().filter((m) => m.kinds.includes("tts"));
export const modelsOfKind = (k: AudioKind) => audioModels().filter((m) => m.kinds.includes(k));
