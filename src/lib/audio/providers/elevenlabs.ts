import { forSample, mapElevenLabsError, NETWORK_ERROR, TIMEOUT_ERROR } from "../errors";
import { ProviderFailure, type AudioKind, type AudioProvider, type AudioRequest, type AudioResult, type CloneInput, type DesignInput, type DesignPreview, type ProviderCtx, type Voice } from "../types";

// ElevenLabs over plain fetch (docs/audio-providers/elevenlabs.md). Phase 1: text to speech and the voice list.
// The orchestrator, not this adapter, stores the audio and creates signed links.
const TTS_MODELS = new Set(["eleven_v4", "eleven_v4_turbo", "eleven_v3", "eleven_multilingual_v2", "eleven_flash_v2_5"]);
const OUTPUT = "mp3_44100_128"; // constant bitrate, so chunks can be joined
const TIMEOUT_MS = 120_000;

async function call(ctx: ProviderCtx, url: string, init: RequestInit, map: (status: number, body: string) => import("../types").ProviderError = mapElevenLabsError): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  ctx.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, headers: { ...(init.headers as Record<string, string>), "xi-api-key": ctx.apiKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = map(res.status, body);
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

  // Instant clone: POST /v1/voices/add (multipart). Cloned voices cannot be shared publicly. `requires_verification` means ElevenLabs wants a check before the voice
  // can speak: that voice is removed again and the person is told (VERIFY with a real key what triggers it).
  async cloneVoice(input: CloneInput, ctx: ProviderCtx): Promise<{ voiceId: string }> {
    const fd = new FormData();
    fd.set("name", input.name);
    if (input.description) fd.set("description", input.description);
    fd.set("remove_background_noise", "true");
    fd.append("files", new Blob([Buffer.from(input.sample)], { type: input.mime }), input.fileName);
    const res = await call(ctx, `${ctx.baseUrl}/v1/voices/add`, { method: "POST", body: fd }, forSample(mapElevenLabsError));
    const j = (await res.json().catch(() => null)) as { voice_id?: string; requires_verification?: boolean } | null;
    if (!j?.voice_id) throw new ProviderFailure({ retryable: true, code: "empty_voice", userMessage: "The voice could not be created right now. Please try again in a moment." });
    if (j.requires_verification) {
      await elevenlabs.deleteVoice!(j.voice_id, "cloned", ctx).catch(() => {});
      throw new ProviderFailure({ retryable: false, code: "needs_verification", userMessage: "This voice needs to be verified by the voice service before it can be used, so it was not created." });
    }
    return { voiceId: j.voice_id };
  },

  // Voice design: previews to listen to (POST /v1/text-to-voice/design), then one is kept (POST /v1/text-to-voice). The preview text is generated by ElevenLabs.
  async designVoice(input: DesignInput, ctx: ProviderCtx): Promise<DesignPreview[]> {
    const res = await call(ctx, `${ctx.baseUrl}/v1/text-to-voice/design`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_description: input.description, auto_generate_text: true }) });
    const j = (await res.json().catch(() => null)) as { previews?: Array<{ audio_base_64?: string; generated_voice_id?: string; media_type?: string; duration_secs?: number }> } | null;
    const out: DesignPreview[] = [];
    for (const p of j?.previews ?? []) {
      if (!p.generated_voice_id || !p.audio_base_64) continue;
      const audio = new Uint8Array(Buffer.from(p.audio_base_64, "base64"));
      if (audio.length) out.push({ token: p.generated_voice_id, audio, mime: p.media_type || "audio/mpeg", durationMs: p.duration_secs ? Math.round(p.duration_secs * 1000) : undefined });
    }
    if (!out.length) throw new ProviderFailure({ retryable: true, code: "empty_design", userMessage: "No voices could be designed from that description. Try different words." });
    return out;
  },

  async saveDesign(token: string, input: { name: string; description: string }, ctx: ProviderCtx): Promise<{ voiceId: string }> {
    const res = await call(ctx, `${ctx.baseUrl}/v1/text-to-voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_name: input.name, voice_description: input.description, generated_voice_id: token }) });
    const j = (await res.json().catch(() => null)) as { voice_id?: string } | null;
    if (!j?.voice_id) throw new ProviderFailure({ retryable: true, code: "empty_voice", userMessage: "The voice could not be saved right now. Please try again in a moment." });
    return { voiceId: j.voice_id };
  },

  async deleteVoice(voiceId: string, _kind: "cloned" | "designed", ctx: ProviderCtx): Promise<void> {
    try { await call(ctx, `${ctx.baseUrl}/v1/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" }); }
    catch (err) { if (err instanceof ProviderFailure && err.error.code === "not_found") return; throw err; }
  },
};
