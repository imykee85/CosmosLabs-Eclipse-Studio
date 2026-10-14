// Voice Studio: the provider-neutral types (docs/audio-providers/build-brief.md section 2). Plain fetch adapters only; no provider SDKs.
export type AudioKind = "tts" | "stt" | "sfx" | "music";

export type AudioRequest = {
  kind: AudioKind;
  modelId: string;
  text: string;
  voiceId?: string;
  speed?: number;            // 1 = normal; only sent to models whose registry entry says `supports.speed`
  languageCode?: string;
  format?: "mp3";            // MP3 wherever the provider offers it (constant bitrate, so chunks can be joined); Qwen answers WAV
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

export type Voice = { voiceId: string; name: string; category?: string; language?: string; gender?: string; accent?: string; age?: string; descriptive?: string; previewUrl?: string; own?: boolean; ownId?: string; kind?: "cloned" | "designed" };

// Voice cloning and design (docs/audio-providers/build-brief.md section 5). A clone takes ONE short sample; a design returns previews to listen to, and one is kept.
export type CloneInput = { name: string; sample: Uint8Array; mime: string; fileName: string; description?: string };
export type DesignInput = { description: string };
export type DesignPreview = { token: string; audio: Uint8Array; mime: string; durationMs?: number };

export interface AudioProvider {
  id: string;
  supports(kind: AudioKind, modelId: string): boolean;
  generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult>; // throws ProviderFailure
  listVoices?(ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]>;
  cloneVoice?(input: CloneInput, ctx: ProviderCtx): Promise<{ voiceId: string }>;
  designVoice?(input: DesignInput, ctx: ProviderCtx): Promise<DesignPreview[]>;
  saveDesign?(token: string, input: { name: string; description: string }, ctx: ProviderCtx): Promise<{ voiceId: string }>; // makes a previewed design a voice
  deleteVoice?(voiceId: string, kind: "cloned" | "designed", ctx: ProviderCtx): Promise<void>;
}

// What adapters throw: a normalised ProviderError. Callers branch on `.error`, never on the provider's own text.
export class ProviderFailure extends Error {
  constructor(readonly error: ProviderError) { super(error.code); }
}
