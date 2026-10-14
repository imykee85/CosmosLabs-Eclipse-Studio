import { mapFishError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";
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
};
