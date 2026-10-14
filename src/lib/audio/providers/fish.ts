import { forSample, mapFishError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type CloneInput, type ProviderCtx, type Voice } from "../types";
import { EMPTY_AUDIO, NEEDS_VOICE, send } from "./http";

// Fish Audio over plain fetch (docs/audio-providers/fish-audio.md). The `model` HEADER picks the model: a missing or unknown one silently falls back to s2.1-pro,
// so it is always sent. Bracket cues only ([happy]); (parenthesis) tags are never sent to S2 models.
const MODELS = new Set(["s2.1-pro", "s2.1-pro-free", "s2-pro"]);

export function fishBody(req: AudioRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { text: req.text, reference_id: req.voiceId, format: "mp3", mp3_bitrate: 128, sample_rate: 44100 };
  if (req.speed != null && req.speed !== 1) body.prosody = { speed: req.speed };
  return body;
}

// S2 reads (happy) aloud as words: refuse it before spending anything.
export const hasParenTag = (text: string) => /\((?:happy|sad|angry|excited|calm|whisper(?:ing)?|laugh(?:ing|s)?|sigh(?:ing|s)?|nervous|surprised)\)/i.test(text);

export const fish: AudioProvider = {
  id: "fish",
  supports: (kind, modelId) => kind === "tts" && MODELS.has(modelId),
  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    if (!req.voiceId) throw new ProviderFailure(NEEDS_VOICE);
    if (hasParenTag(req.text)) throw new ProviderFailure({ retryable: false, code: "paren_tag", userMessage: "Fish models read cues in square brackets, like [happy]. Change the round brackets and try again." });
    const res = await send("fish", ctx, `${ctx.baseUrl}/v1/tts`, { method: "POST", headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json", model: req.modelId }, body: JSON.stringify(fishBody(req)) }, mapFishError);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new ProviderFailure(EMPTY_AUDIO);
    return { bytes, mime: "audio/mpeg", usage: { bytes: Buffer.byteLength(req.text, "utf8") } };
  },
  // The public voice library (GET /model). Field names beyond `_id` and `title` are read defensively (VERIFY with a real key).
  async listVoices(ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]> {
    const p = new URLSearchParams({ page_size: "60", page_number: "1", sort_by: "score" });
    if (q.search) p.set("title", q.search);
    const res = await send("fish", ctx, `${ctx.baseUrl}/model?${p}`, { method: "GET", headers: { Authorization: `Bearer ${ctx.apiKey}` } }, mapFishError, 30_000);
    const j = (await res.json().catch(() => null)) as { items?: Array<Record<string, unknown>> } | null;
    return (j?.items ?? []).filter((v) => typeof v._id === "string" && typeof v.title === "string" && (v.type == null || v.type === "tts")).map((v) => {
      const langs = Array.isArray(v.languages) ? (v.languages as unknown[]).filter((x) => typeof x === "string").join(", ") : undefined;
      const tags = Array.isArray(v.tags) ? (v.tags as unknown[]).filter((x) => typeof x === "string").slice(0, 3).join(", ") : undefined;
      const sample = Array.isArray(v.samples) ? (v.samples as Array<Record<string, unknown>>).find((s) => typeof s?.audio === "string")?.audio : undefined;
      return { voiceId: String(v._id), name: String(v.title).slice(0, 60), language: langs || undefined, descriptive: tags || undefined, previewUrl: typeof sample === "string" && sample.startsWith("https://") ? sample : undefined };
    });
  },

  // Saved clone: POST /model (multipart), fast training, private. The new voice's `_id` is the reference_id for TTS. `state` "failed" is an error. Voice DESIGN is not
  // built for Fish: how a designed voice becomes a saved one is unexplained in its reference (docs/audio-providers/fish-audio.md section 6).
  async cloneVoice(input: CloneInput, ctx: ProviderCtx): Promise<{ voiceId: string }> {
    const fd = new FormData();
    fd.set("type", "tts");
    fd.set("title", input.name);
    fd.set("train_mode", "fast");
    fd.set("visibility", "private");
    fd.set("enhance_audio_quality", "true");
    if (input.description) fd.set("description", input.description);
    fd.append("voices", new Blob([Buffer.from(input.sample)], { type: input.mime }), input.fileName);
    const res = await send("fish", ctx, `${ctx.baseUrl}/model`, { method: "POST", headers: { Authorization: `Bearer ${ctx.apiKey}` }, body: fd }, forSample(mapFishError));
    const j = (await res.json().catch(() => null)) as { _id?: string; state?: string } | null;
    if (!j?._id) throw new ProviderFailure({ retryable: true, code: "empty_voice", userMessage: "The voice could not be created right now. Please try again in a moment." });
    if (j.state === "failed") {
      await fish.deleteVoice!(j._id, "cloned", ctx).catch(() => {});
      throw new ProviderFailure({ retryable: false, code: "clone_failed", userMessage: "The voice could not be created from that sample. Try a clearer recording." });
    }
    return { voiceId: j._id };
  },

  async deleteVoice(voiceId: string, _kind: "cloned" | "designed", ctx: ProviderCtx): Promise<void> {
    try { await send("fish", ctx, `${ctx.baseUrl}/model/${encodeURIComponent(voiceId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${ctx.apiKey}` } }, mapFishError, 30_000); }
    catch (err) { if (err instanceof ProviderFailure && err.error.code === "not_found") return; throw err; }
  },
};
