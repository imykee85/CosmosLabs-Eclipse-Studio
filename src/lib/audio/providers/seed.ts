import { mapSeedError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";
import { EMPTY_AUDIO, send } from "./http";

// Seed Audio 1.0 (BytePlus Seed Speech, docs/audio-providers/seed-audio.md section 1). Its own key and header: X-Api-Key (NOT Bearer, NOT the ModelArk key).
// One call makes up to 120 s of speech with sound; the script itself can describe the voice, so a speaker is optional. The audio comes back as base64 (the
// 2-hour `url` is ignored). Billed by `original_duration` seconds.

// speed 0.7..1.2 maps onto speech_rate -50..100 (0 = normal) as (speed - 1) x 100.
export function seedBody(req: AudioRequest): Record<string, unknown> {
  const audio: Record<string, unknown> = { format: "mp3" };
  if (req.speed != null && req.speed !== 1) audio.speech_rate = Math.round((req.speed - 1) * 100);
  const body: Record<string, unknown> = { model: "seed-audio-1.0", text_prompt: req.text, audio_config: audio };
  if (req.voiceId) body.references = [{ speaker: req.voiceId }];
  return body;
}

// Speakers: no list endpoint is in our reference. The Config value SEED_AUDIO_SPEAKERS adds ids from the Seed Speech console as "id:Name,id:Name".
export function seedVoices(): Voice[] {
  return (process.env.SEED_AUDIO_SPEAKERS ?? "").split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
    const [id, ...rest] = p.split(":");
    return { voiceId: id.trim(), name: rest.join(":").trim() || id.trim() };
  }).filter((v) => /^[A-Za-z0-9_.-]{1,128}$/.test(v.voiceId));
}

export const seed: AudioProvider = {
  id: "seed",
  supports: (kind, modelId) => kind === "tts" && modelId === "seed-audio-1.0",
  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    const res = await send("seed", ctx, `${ctx.baseUrl}/tts/create`, { method: "POST", headers: { "X-Api-Key": ctx.apiKey, "Content-Type": "application/json", "X-Api-Request-Id": crypto.randomUUID() }, body: JSON.stringify(seedBody(req)) }, mapSeedError, 150_000);
    const logId = res.headers.get("x-tt-logid");
    const j = (await res.json().catch(() => null)) as { code?: unknown; audio?: string; duration?: number; original_duration?: number } | null;
    if (typeof j?.audio !== "string" || !j.audio) {
      if (logId) console.warn("seed audio log id", logId);
      throw new ProviderFailure(j?.code != null ? mapSeedError(200, JSON.stringify({ code: j.code })) : EMPTY_AUDIO);
    }
    const bytes = new Uint8Array(Buffer.from(j.audio, "base64"));
    if (!bytes.length) throw new ProviderFailure(EMPTY_AUDIO);
    const secs = Number(j.original_duration ?? j.duration);
    const shown = Number(j.duration);
    return { bytes, mime: "audio/mpeg", durationMs: Number.isFinite(shown) && shown > 0 ? Math.round(shown * 1000) : undefined, usage: Number.isFinite(secs) && secs > 0 ? { seconds: secs } : undefined, raw: logId ? { logId } : undefined };
  },
  async listVoices(_ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]> {
    const s = q.search?.toLowerCase();
    return seedVoices().filter((v) => !s || v.name.toLowerCase().includes(s));
  },
};
