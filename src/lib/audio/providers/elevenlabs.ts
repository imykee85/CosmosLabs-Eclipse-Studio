import { forSample, mapElevenLabsError, NETWORK_ERROR, TIMEOUT_ERROR } from "../errors";
import { segmentsFromWords, speakerLabel, type TimedWord } from "../transcript";
import { ProviderFailure, type AudioKind, type AudioProvider, type AudioRequest, type AudioResult, type CloneInput, type DesignInput, type DesignPreview, type ProviderCtx, type Voice } from "../types";

// ElevenLabs over plain fetch (docs/audio-providers/elevenlabs.md). Phase 1: text to speech and the voice list.
// The orchestrator, not this adapter, stores the audio and creates signed links.
const TTS_MODELS = new Set(["eleven_v4", "eleven_v4_turbo", "eleven_v3", "eleven_multilingual_v2", "eleven_flash_v2_5"]);
const OTHER_MODELS: Record<string, AudioKind> = { scribe_v2: "stt", eleven_text_to_sound_v2: "sfx", music_v2_5: "music" };
const OUTPUT = "mp3_44100_128"; // constant bitrate, so chunks can be joined
const TIMEOUT_MS = 120_000;
const LONG_TIMEOUT_MS = 280_000; // speech to text and music can take minutes; the function limit is 300 s

async function call(ctx: ProviderCtx, url: string, init: RequestInit, map: (status: number, body: string) => import("../types").ProviderError = mapElevenLabsError, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
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

// Speech to text (docs/audio-providers/elevenlabs.md section 6): the file is read by ElevenLabs from a signed link (never through our routes). Words come with times and
// speakers; they are grouped into readable lines. Audio events like (laughter) are left out of the text.
export function sttFields(req: AudioRequest): Record<string, string> {
  const f: Record<string, string> = { model_id: "scribe_v2", source_url: req.input?.url ?? "", diarize: req.diarize ? "true" : "false", timestamps_granularity: "word", tag_audio_events: "false" };
  if (req.language) f.language_code = req.language;
  return f;
}
async function transcribe(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
  if (!req.input) throw new ProviderFailure({ retryable: false, code: "invalid_request", userMessage: "Add a recording first." });
  const fd = new FormData();
  for (const [k, v] of Object.entries(sttFields(req))) fd.set(k, v);
  const res = await call(ctx, `${ctx.baseUrl}/v1/speech-to-text`, { method: "POST", body: fd }, mapElevenLabsError, LONG_TIMEOUT_MS);
  const j = (await res.json().catch(() => null)) as { text?: string; language_code?: string; words?: Array<{ text?: string; type?: string; start?: number; end?: number; speaker_id?: string }> } | null;
  const words: TimedWord[] = (j?.words ?? []).filter((w) => w.type === "word" && typeof w.text === "string" && Number.isFinite(w.start) && Number.isFinite(w.end)).map((w) => ({ text: w.text!, start: w.start!, end: w.end!, speaker: speakerLabel(w.speaker_id) }));
  const text = (j?.text ?? "").trim();
  if (!text && !words.length) throw new ProviderFailure({ retryable: false, code: "no_speech", userMessage: "No speech was found in that recording." });
  return { mime: "text/plain", transcript: { text: text || words.map((w) => w.text).join(" "), language: j?.language_code, durationSec: words.length ? words[words.length - 1].end : undefined, segments: segmentsFromWords(words) } };
}

// Sound effects: POST /v1/sound-generation (docs section 7). `duration_seconds` is left out when the model should decide; `loop` only on the v2 model.
export function sfxBody(req: AudioRequest): Record<string, unknown> {
  const b: Record<string, unknown> = { text: req.text, model_id: req.modelId };
  if (req.durationSec != null) b.duration_seconds = req.durationSec;
  if (req.loop) b.loop = true;
  return b;
}
async function soundEffect(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
  const res = await call(ctx, `${ctx.baseUrl}/v1/sound-generation?output_format=${OUTPUT}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify(sfxBody(req)) });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new ProviderFailure({ retryable: true, code: "empty_audio", userMessage: "The sound could not be made right now. Please try again in a moment." });
  return { bytes, mime: "audio/mpeg" };
}

// Music: POST /v1/music (docs section 8; paid plans only). `model_id` is ALWAYS sent: the API default is music_v1. A refused prompt (an artist's name, lyrics) says so.
export function musicBody(req: AudioRequest): Record<string, unknown> {
  const b: Record<string, unknown> = { prompt: req.text, model_id: req.modelId, force_instrumental: !!req.instrumental };
  if (req.durationSec != null) b.music_length_ms = Math.round(req.durationSec * 1000);
  return b;
}
const musicMap = (status: number, body: string) => {
  const e = mapElevenLabsError(status, body);
  return e.code === "bad_prompt" ? { ...e, userMessage: "Music prompts cannot name artists or include lyrics. Describe the style, mood and instruments instead." } : e;
};
async function music(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
  const res = await call(ctx, `${ctx.baseUrl}/v1/music?output_format=${OUTPUT}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify(musicBody(req)) }, musicMap, LONG_TIMEOUT_MS);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new ProviderFailure({ retryable: true, code: "empty_audio", userMessage: "The music could not be made right now. Please try again in a moment." });
  return { bytes, mime: "audio/mpeg" };
}

export const elevenlabs: AudioProvider = {
  id: "elevenlabs",
  supports: (kind: AudioKind, modelId: string) => (kind === "tts" && TTS_MODELS.has(modelId)) || OTHER_MODELS[modelId] === kind,

  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    if (req.kind === "stt") return transcribe(req, ctx);
    if (req.kind === "sfx") return soundEffect(req, ctx);
    if (req.kind === "music") return music(req, ctx);
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
