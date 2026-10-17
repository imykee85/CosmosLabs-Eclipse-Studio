// Voice Studio: the provider-neutral types (docs/audio-providers/build-brief.md section 2). Plain fetch adapters only; no provider SDKs.
export type AudioKind = "tts" | "stt" | "sfx" | "music" | "vsfx"; // vsfx: sound made for a video ("Add sound")

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
  // sound effects and music
  durationSec?: number;      // sfx 0.5 to 30 (unset = the model decides); music 3 to 600
  loop?: boolean;            // sfx: a clip that loops cleanly
  instrumental?: boolean;    // music: no vocals
  // speech to text: the input lives in private storage. `url` is a short-lived signed link, `bytes()` loads it for providers that need the file itself.
  input?: { url: string; name: string; mime: string; bytes: () => Promise<Uint8Array> };
  // Mirelo (docs in docs/audio-providers/mirelo.md): sound for a video, or sound effects from text with several variants.
  videoUrl?: string;         // vsfx: a short-lived signed link to the video in private storage
  negativePrompt?: string;   // sfx: what the sound should not contain (experimental)
  variants?: number;         // 1 to 4 alternatives made in one job
  preserveSpeech?: boolean;  // vsfx: keep the speech that is in the video
  outputFormat?: "wav" | "flac" | "mp3_128" | "mp3_192" | "mp3_256" | "mp3_320";
  idempotencyKey?: string;   // the same key and body on a retry returns the original job instead of making (and billing) a second one
  diarize?: boolean;         // speech to text: tell speakers apart
  language?: string;         // speech to text: a language code when the person knows it
};

// A transcript: the whole text plus timed segments (one sentence or turn each; speakers when the provider told them apart).
export type TranscriptSegment = { text: string; start: number; end: number; speaker?: string };
export type Transcript = { text: string; language?: string; durationSec?: number; segments: TranscriptSegment[] };

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
  transcript?: Transcript;
  variants?: { bytes: Uint8Array; mime: string; durationMs?: number }[]; // several alternatives (Mirelo); `bytes` is the first one
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
  // Long jobs the provider runs on its side (MiniMax long text): start returns a task id, poll is asked until it is done.
  // `pollUrl` is the address the provider gave for following the job (Mirelo `urls.self`); only an address on the provider's own host is ever followed.
  start?(req: AudioRequest, ctx: ProviderCtx): Promise<{ taskId: string; pollUrl?: string }>;
  poll?(taskId: string, ctx: ProviderCtx, pollUrl?: string): Promise<{ status: "running" | "done" | "failed"; result?: AudioResult; error?: ProviderError }>;
  // The provider's own price quote for a request, in ITS credits (null when it cannot say). Used before a job is held.
  preflight?(req: AudioRequest, ctx: ProviderCtx): Promise<{ credits: number | null }>;
}

// What adapters throw: a normalised ProviderError. Callers branch on `.error`, never on the provider's own text.
export class ProviderFailure extends Error {
  constructor(readonly error: ProviderError) { super(error.code); }
}
