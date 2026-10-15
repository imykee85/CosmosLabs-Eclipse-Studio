import { mapQwenError } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";
import { EMPTY_AUDIO, NEEDS_VOICE, download, send } from "./http";

// Qwen3 TTS Flash over plain HTTP (docs/audio-providers/qwen3-tts.md section 3): 600 characters per request; the answer is a WAV address valid 24 hours, fetched
// at once so the orchestrator stores the bytes. The international host is the default (DASHSCOPE_BASE_URL, VERIFY which host the key works on).
const PATH = "/api/v1/services/aigc/multimodal-generation/generation";

export function qwenBody(req: AudioRequest): Record<string, unknown> {
  return { model: req.modelId, input: { text: req.text, voice: req.voiceId, language_type: req.languageCode || "Auto" } };
}

// System voices: there is no list endpoint in our reference and only "Cherry" is confirmed. More names (as the docs list them, case-sensitive) can be added with
// the Config value QWEN_TTS_VOICES, e.g. "Cherry,Ethan".
export function qwenVoices(): Voice[] {
  const extra = (process.env.QWEN_TTS_VOICES ?? "").split(",").map((v) => v.trim()).filter((v) => /^[A-Za-z0-9_-]{1,40}$/.test(v));
  return Array.from(new Set(["Cherry", ...extra])).map((name) => ({ voiceId: name, name }));
}

export const qwen: AudioProvider = {
  id: "qwen",
  supports: (kind, modelId) => kind === "tts" && modelId === "qwen3-tts-flash",
  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    if (!req.voiceId) throw new ProviderFailure(NEEDS_VOICE);
    const res = await send("qwen", ctx, `${ctx.baseUrl}${PATH}`, { method: "POST", headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(qwenBody(req)) }, mapQwenError);
    const j = (await res.json().catch(() => null)) as { code?: string; output?: { audio?: { url?: string } }; usage?: { characters?: number } } | null;
    if (j?.code) throw new ProviderFailure(mapQwenError(400, JSON.stringify({ code: j.code })));
    const url = j?.output?.audio?.url;
    if (typeof url !== "string" || !url) throw new ProviderFailure(EMPTY_AUDIO);
    const bytes = await download("qwen", ctx, url);
    const used = Number(j?.usage?.characters);
    return { bytes, mime: "audio/wav", usage: Number.isFinite(used) ? { usageCharacters: used } : undefined };
  },
  async listVoices(_ctx: ProviderCtx, q: { search?: string }): Promise<Voice[]> {
    const s = q.search?.toLowerCase();
    return qwenVoices().filter((v) => !s || v.name.toLowerCase().includes(s));
  },
};
