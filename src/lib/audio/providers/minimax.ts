import { randomUUID } from "node:crypto";
import { forSample, mapMiniMaxError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type CloneInput, type DesignInput, type DesignPreview, type ProviderCtx, type Voice } from "../types";
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
const safeJson = (t: string): BaseResp | null => { try { return JSON.parse(t) as BaseResp; } catch { return null; } };
const DESIGN_PREVIEW_TEXT = "Hello! This is how my voice sounds. I hope you like it.";

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

  // Clone (docs/audio-providers/minimax.md section 7): upload the sample (purpose voice_clone), then POST /v1/voice_clone with a voice_id WE choose (a letter first,
  // letters/digits/-/_). MiniMax bills $1.50 at the voice's first use and deletes a clone that is not used within 7 days. `file_id` is a large integer: it is read
  // from the raw text and sent back as text so no digit is lost (VERIFY with a real key).
  async cloneVoice(input: CloneInput, ctx: ProviderCtx): Promise<{ voiceId: string }> {
    const fd = new FormData();
    fd.set("purpose", "voice_clone");
    fd.append("file", new Blob([Buffer.from(input.sample)], { type: input.mime }), input.fileName);
    const up = await send("minimax", ctx, `${ctx.baseUrl}/v1/files/upload`, { method: "POST", headers: { Authorization: `Bearer ${ctx.apiKey}` }, body: fd }, forSample(httpMap));
    const text = await up.text();
    check(safeJson(text));
    const fileId = /"file_id"\s*:\s*"?(\d{1,24})"?/.exec(text)?.[1];
    if (!fileId) throw new ProviderFailure({ retryable: true, code: "empty_voice", userMessage: "The sample could not be uploaded right now. Please try again in a moment." });
    const voiceId = `e${randomUUID().replace(/-/g, "")}`;
    const res = await send("minimax", ctx, `${ctx.baseUrl}/v1/voice_clone`, { method: "POST", headers: auth(ctx), body: `{"file_id":${fileId},"voice_id":"${voiceId}","need_noise_reduction":true,"need_volume_normalization":true}` }, forSample(httpMap));
    const j = (await res.json().catch(() => null)) as (BaseResp & { input_sensitive?: boolean }) | null;
    check(j);
    return { voiceId };
  },

  // Design: POST /v1/voice_design returns the voice (usable at once) and a trial clip. One preview; "saving" is already done. $3 per voice at first synthesis.
  async designVoice(input: DesignInput, ctx: ProviderCtx): Promise<DesignPreview[]> {
    const res = await send("minimax", ctx, `${ctx.baseUrl}/v1/voice_design`, { method: "POST", headers: auth(ctx), body: JSON.stringify({ prompt: input.description, preview_text: DESIGN_PREVIEW_TEXT }) }, httpMap);
    const j = (await res.json().catch(() => null)) as (BaseResp & { voice_id?: string; trial_audio?: string }) | null;
    check(j);
    if (!j?.voice_id || !j.trial_audio) throw new ProviderFailure({ retryable: true, code: "empty_design", userMessage: "No voice could be designed from that description. Try different words." });
    return [{ token: j.voice_id, audio: hexToBytes(j.trial_audio), mime: "audio/mpeg" }];
  },
  async saveDesign(token: string): Promise<{ voiceId: string }> { return { voiceId: token }; },

  async deleteVoice(voiceId: string, kind: "cloned" | "designed", ctx: ProviderCtx): Promise<void> {
    const res = await send("minimax", ctx, `${ctx.baseUrl}/v1/delete_voice`, { method: "POST", headers: auth(ctx), body: JSON.stringify({ voice_type: kind === "cloned" ? "voice_cloning" : "voice_generation", voice_id: voiceId }) }, httpMap, 30_000);
    const j = (await res.json().catch(() => null)) as BaseResp | null;
    // A voice MiniMax already removed (an unused clone expires after 7 days) is gone: nothing left to delete.
    if (Number(j?.base_resp?.status_code ?? -1) === 0 || [2042, 20132].includes(Number(j?.base_resp?.status_code))) return;
    check(j);
  },
};
