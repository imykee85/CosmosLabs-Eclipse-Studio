import { mapMiniMaxError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";
import { EMPTY_AUDIO, NEEDS_VOICE, send } from "./http";

// MiniMax sync TTS over plain fetch (docs/audio-providers/minimax.md section 4). Every answer is HTTP 200 with base_resp: status_code 0 is the only success.
// Audio comes back as hex and is decoded here; it is never kept as hex. Constant bitrate MP3 so pieces of a long text can be joined.
const MODELS = new Set(["speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo"]);

export function minimaxBody(req: AudioRequest): Record<string, unknown> {
  const voice: Record<string, unknown> = { voice_id: req.voiceId };
  if (req.speed != null && req.speed !== 1) voice.speed = req.speed;
  return {
    model: req.modelId, text: req.text, stream: false, voice_setting: voice,
    audio_setting: { sample_rate: 44100, bitrate: 128000, format: "mp3", channel: 1, force_cbr: true },
    language_boost: "auto", output_format: "hex",
  };
}

type BaseResp = { base_resp?: { status_code?: number } };
const check = (j: BaseResp | null) => {
  const code = Number(j?.base_resp?.status_code ?? -1);
  if (code !== 0) throw new ProviderFailure(mapMiniMaxError(code === -1 ? 1000 : code));
};

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new ProviderFailure(EMPTY_AUDIO);
  return new Uint8Array(Buffer.from(clean, "hex"));
}

const auth = (ctx: ProviderCtx) => ({ Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" });
const httpMap = (status: number) => mapMiniMaxError(0, status);

export const minimax: AudioProvider = {
  id: "minimax",
  supports: (kind, modelId) => kind === "tts" && MODELS.has(modelId),
  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    if (!req.voiceId) throw new ProviderFailure(NEEDS_VOICE);
    const res = await send("minimax", ctx, `${ctx.baseUrl}/v1/t2a_v2`, { method: "POST", headers: auth(ctx), body: JSON.stringify(minimaxBody(req)) }, httpMap);
    const j = (await res.json().catch(() => null)) as (BaseResp & { data?: { audio?: string } | null; extra_info?: { audio_length?: number; usage_characters?: number } }) | null;
    check(j);
    const hex = j?.data?.audio;
    if (typeof hex !== "string" || !hex) throw new ProviderFailure(EMPTY_AUDIO);
    const bytes = hexToBytes(hex);
    const ms = Number(j?.extra_info?.audio_length);
    const used = Number(j?.extra_info?.usage_characters);
    return { bytes, mime: "audio/mpeg", durationMs: Number.isFinite(ms) && ms > 0 ? ms : undefined, usage: Number.isFinite(used) ? { usageCharacters: used } : undefined };
  },
  // POST /v1/get_voice {voice_type:"system"}. The answer's list field is not in our reference: `system_voice` with voice_id / voice_name / description is read
  // defensively (VERIFY with a real key). Search is done here, on the names.
  async listVoices(ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]> {
    const res = await send("minimax", ctx, `${ctx.baseUrl}/v1/get_voice`, { method: "POST", headers: auth(ctx), body: JSON.stringify({ voice_type: "system" }) }, httpMap, 30_000);
    const j = (await res.json().catch(() => null)) as (BaseResp & { system_voice?: Array<Record<string, unknown>> }) | null;
    check(j);
    const s = q.search?.toLowerCase();
    return (j?.system_voice ?? []).filter((v) => typeof v.voice_id === "string").map((v) => {
      const desc = Array.isArray(v.description) ? (v.description as unknown[]).filter((x) => typeof x === "string").join(" ") : typeof v.description === "string" ? v.description : undefined;
      return { voiceId: String(v.voice_id), name: typeof v.voice_name === "string" && v.voice_name ? v.voice_name : String(v.voice_id).replace(/_/g, " "), descriptive: desc?.slice(0, 120) || undefined };
    }).filter((v) => !s || `${v.name} ${v.voiceId} ${v.descriptive ?? ""}`.toLowerCase().includes(s)).slice(0, 200);
  },
};
