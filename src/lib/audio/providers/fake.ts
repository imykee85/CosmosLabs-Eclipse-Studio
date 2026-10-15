import { mapElevenLabsError, NETWORK_ERROR } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type Voice } from "../types";

// A test provider: talks to a fake HTTP server at ctx.baseUrl (tests start one), never to a real service. Only registered when AUDIO_FAKE=1.
export const fake: AudioProvider = {
  id: "fake",
  supports: (kind, modelId) => kind === "tts" && modelId === "fake-tts",
  async generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult> {
    let res: Response;
    try { res = await fetch(`${ctx.baseUrl}/tts/${encodeURIComponent(req.voiceId ?? "v")}`, { method: "POST", headers: { "Content-Type": "application/json", "xi-api-key": ctx.apiKey }, body: JSON.stringify({ text: req.text }) }); }
    catch { throw new ProviderFailure(NETWORK_ERROR); }
    if (!res.ok) throw new ProviderFailure(mapElevenLabsError(res.status, await res.text().catch(() => "")));
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: "audio/mpeg" };
  },
  async listVoices(): Promise<Voice[]> { return [{ voiceId: "v1", name: "Test voice" }]; },
};
