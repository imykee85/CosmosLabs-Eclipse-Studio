// Voice Studio: the provider-neutral types (docs/audio-providers/build-brief.md section 2). Plain fetch adapters only; no provider SDKs.
export type AudioKind = "tts" | "stt" | "sfx" | "music";

export type AudioRequest = {
  kind: AudioKind;
  modelId: string;
  text: string;
  voiceId?: string;
  speed?: number;            // 1 = normal; only sent to models whose registry entry says `supports.speed`
  languageCode?: string;
  format?: "mp3";            // phase 1: MP3 only (ElevenLabs mp3_44100_128, constant bitrate, so chunks can be joined)
  seed?: number;
  previousText?: string;     // continuity between chunks of one long text
  nextText?: string;
};

export type ProviderCtx = { apiKey: string; baseUrl: string; signal?: AbortSignal };

export type AudioResult = {
  bytes?: Uint8Array;
  url?: string;
  mime: string;
  durationMs?: number;
  providerCost?: number;
  usage?: Record<string, number>;
  raw?: unknown;
  subtitles?: unknown;
};

// retryable: worth another try after a pause. alert: the owner must act (key, balance, plan), so the person sees only a generic message.
export type ProviderError = { retryable: boolean; code: string; userMessage: string; providerCode?: string | number; alert?: boolean };

export type Voice = { voiceId: string; name: string; category?: string; language?: string; gender?: string; accent?: string; age?: string; descriptive?: string; previewUrl?: string };

export interface AudioProvider {
  id: string;
  supports(kind: AudioKind, modelId: string): boolean;
  generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult>; // throws ProviderFailure
  listVoices?(ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]>;
}

// What adapters throw: a normalised ProviderError. Callers branch on `.error`, never on the provider's own text.
export class ProviderFailure extends Error {
  constructor(readonly error: ProviderError) { super(error.code); }
}
