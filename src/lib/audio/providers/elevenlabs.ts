import { mapElevenLabsError, NETWORK_ERROR, TIMEOUT_ERROR } from "../errors";
import { ProviderFailure, type AudioKind, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";

// ElevenLabs over plain fetch (docs/audio-providers/elevenlabs.md). Phase 1: text to speech and the voice list.
// The orchestrator, not this adapter, stores the audio and creates signed links.
const TTS_MODELS = new Set(["eleven_v4", "eleven_v4_turbo", "eleven_v3", "eleven_multilingual_v2", "eleven_flash_v2_5"]);
const OUTPUT = "mp3_44100_128"; // constant bitrate, so chunks can be joined
const TIMEOUT_MS = 120_000;

async function call(ctx: ProviderCtx, url: string, init: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  ctx.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, headers: { ...(init.headers as Record<string, string>), "xi-api-key": ctx.apiKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = mapElevenLabsError(res.status, body);
      console.warn("elevenlabs error", res.status, error.code); // the raw body stays out of logs: it can echo input text
      throw new ProviderFailure(error);
    }
    return res;
  } catch (err) {
    if (err instanceof ProviderFailure) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new ProviderFailure(TIMEOUT_ERROR);
    throw new ProviderFailure(NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onAbort);
  }
}

// The exact JSON body of POST /v1/text-to-speech/{voice_id} for a request (a golden test pins it).
export function ttsBody(req: AudioRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { text: req.text, model_id: req.modelId };
  if (req.speed != null && req.speed !== 1) body.voice_settings = { speed: req.speed };
  if (req.languageCode) body.language_code = req.languageCode;
  if (req.seed != null) body.seed = req.seed;
  if (req.previousText) body.previous_text = req.previousText;
  if (req.nextText) body.next_text = req.nextText;
  return body;
}

export const elevenlabs: AudioProvider = {
  id: "elevenlabs",
  supports: (kind: AudioKind, modelId: string) => kind === "tts" && TTS_MODELS.has(modelId),

  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    if (req.kind !== "tts" || !req.voiceId) throw new ProviderFailure({ retryable: false, code: "invalid_request", userMessage: "Pick a voice first." });
    const url = `${ctx.baseUrl}/v1/text-to-speech/${encodeURIComponent(req.voiceId)}?output_format=${OUTPUT}`;
    const res = await call(ctx, url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify(ttsBody(req)) });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) throw new ProviderFailure({ retryable: true, code: "empty_audio", userMessage: "The voice could not be made right now. Please try again in a moment." });
    const cost = Number(res.headers.get("character-cost"));
    return { bytes, mime: "audio/mpeg", usage: Number.isFinite(cost) && res.headers.has("character-cost") ? { characterCost: cost } : undefined, raw: { requestId: res.headers.get("request-id") ?? undefined } };
  },

  async listVoices(ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]> {
    const params = new URLSearchParams({ page_size: "100" });
    if (q.search) params.set("search", q.search);
    const res = await call(ctx, `${ctx.baseUrl}/v2/voices?${params}`, { method: "GET" });
    const j = (await res.json().catch(() => null)) as { voices?: Array<{ voice_id?: string; name?: string; category?: string; preview_url?: string; labels?: Record<string, string> }> } | null;
    return (j?.voices ?? []).filter((v) => v.voice_id && v.name).map((v) => ({
      voiceId: String(v.voice_id), name: String(v.name), category: v.category, previewUrl: v.preview_url,
      language: v.labels?.language, gender: v.labels?.gender, accent: v.labels?.accent, age: v.labels?.age, descriptive: v.labels?.descriptive ?? v.labels?.description,
    }));
  },
};
