import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { joinWav, splitForTts, wavDurationMs } from "../../src/lib/audio/chunk";
import { mapFishError, mapMiniMaxError, mapQwenError, mapSeedError } from "../../src/lib/audio/errors";
import { holdUnits, pagePricing, settledUnits } from "../../src/lib/audio/pricing";
import { fish, fishBody, hasParenTag } from "../../src/lib/audio/providers/fish";
import { hexToBytes, minimax, minimaxBody } from "../../src/lib/audio/providers/minimax";
import { qwen, qwenBody } from "../../src/lib/audio/providers/qwen";
import { seed, seedBody } from "../../src/lib/audio/providers/seed";
import { audioModels, findAudioModel } from "../../src/lib/audio/registry";
import { ProviderFailure, type AudioRequest } from "../../src/lib/audio/types";

const req = (modelId: string, extra: Partial<AudioRequest> = {}): AudioRequest => ({ kind: "tts", modelId, text: "Hello there.", voiceId: "v1", ...extra });

// A 16-bit mono 24 kHz WAV holding `samples` samples.
function wav(samples: number, fill = 1): Uint8Array {
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples * 2, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) b.writeInt16LE(fill, 44 + i * 2);
  return new Uint8Array(b);
}

test("golden request bodies: Fish, MiniMax, Qwen and Seed Audio", () => {
  assert.deepEqual(fishBody(req("s2.1-pro", { speed: 1.1 })), { text: "Hello there.", reference_id: "v1", format: "mp3", mp3_bitrate: 128, sample_rate: 44100, prosody: { speed: 1.1 } });
  assert.deepEqual(fishBody(req("s2.1-pro")), { text: "Hello there.", reference_id: "v1", format: "mp3", mp3_bitrate: 128, sample_rate: 44100 });
  assert.deepEqual(minimaxBody(req("speech-2.8-hd", { speed: 0.9 })), {
    model: "speech-2.8-hd", text: "Hello there.", stream: false, voice_setting: { voice_id: "v1", speed: 0.9 },
    audio_setting: { sample_rate: 44100, bitrate: 128000, format: "mp3", channel: 1, force_cbr: true }, language_boost: "auto", output_format: "hex",
  });
  assert.deepEqual(qwenBody(req("qwen3-tts-flash", { voiceId: "Cherry" })), { model: "qwen3-tts-flash", input: { text: "Hello there.", voice: "Cherry", language_type: "Auto" } });
  assert.deepEqual(seedBody(req("seed-audio-1.0", { voiceId: undefined })), { model: "seed-audio-1.0", text_prompt: "Hello there.", audio_config: { format: "mp3" } });
  assert.deepEqual(seedBody(req("seed-audio-1.0", { voiceId: "S_abc", speed: 1.2 })), { model: "seed-audio-1.0", text_prompt: "Hello there.", audio_config: { format: "mp3", speech_rate: 20 }, references: [{ speaker: "S_abc" }] });
});

test("error tables: retryable, owner alerts and user-facing refusals", () => {
  for (const c of [1000, 1001, 1002, 1013, 1024, 1033, 1039, 2045]) assert.equal(mapMiniMaxError(c).retryable, true, `minimax ${c}`);
  for (const c of [1004, 2049, 1008, 2038]) assert.equal(mapMiniMaxError(c).alert, true, `minimax ${c}`);
  for (const c of [1026, 1027]) assert.equal(mapMiniMaxError(c).code, "content_refused");
  assert.equal(mapMiniMaxError(2042).code, "voice_unavailable");
  assert.equal(mapFishError(429, "").retryable, true);
  assert.equal(mapFishError(503, "").retryable, true);
  assert.equal(mapFishError(402, '{"status":402,"message":"x"}').alert, true);
  assert.equal(mapFishError(401, "").alert, true);
  assert.equal(mapFishError(413, "").retryable, false);
  assert.equal(mapQwenError(429, '{"code":"Throttling.RateQuota"}').retryable, true);
  assert.equal(mapQwenError(400, '{"code":"DataInspectionFailed"}').code, "content_refused");
  assert.equal(mapQwenError(401, '{"code":"InvalidApiKey"}').alert, true);
  assert.equal(mapSeedError(401, '{"code":45000010}').alert, true);
  assert.equal(mapSeedError(200, '{"code":429}').retryable, true);
  assert.equal(mapSeedError(500, "").retryable, true);
});

test("Fish: (parenthesis) tags are refused for S2, [bracket] cues pass", () => {
  assert.equal(hasParenTag("(happy) What a day!"), true);
  assert.equal(hasParenTag("[happy] What a day! (and a note)"), false);
});

test("MiniMax hex decoding, and WAV joining keeps every sample with one header", () => {
  assert.deepEqual(Array.from(hexToBytes("49443304")), [0x49, 0x44, 0x33, 0x04]);
  assert.throws(() => hexToBytes("4g"), ProviderFailure);
  const joined = joinWav([wav(24000), wav(12000, 2)]);
  assert.equal(joined.length, 44 + 36000 * 2);
  assert.equal(wavDurationMs(joined), 1500);
  assert.equal(Buffer.from(joined).readInt16LE(44 + 24000 * 2), 2);
});

test("Fish counts UTF-8 bytes when splitting and pricing", () => {
  const m = findAudioModel("s2.1-pro")!;
  const text = "日本語の文章です。".repeat(200);
  for (const p of splitForTts(text, m.callChars, m.callUnit)) assert.ok(Buffer.byteLength(p, "utf8") <= m.callChars);
  assert.equal(holdUnits(m, "héllo"), 6);
  assert.deepEqual(pagePricing(m)?.unit, "byte");
});

test("Seed Audio: held at 120 s, settled on the reported seconds", () => {
  const m = findAudioModel("seed-audio-1.0")!;
  assert.equal(holdUnits(m, "x"), 120);
  assert.equal(settledUnits(m, "x", 33.4), 33.4);
  assert.equal(settledUnits(m, "x", 500), 120);
  assert.equal(settledUnits(m, "x"), 120);
  assert.equal(pagePricing(m)?.unit, "max");
});

test("registry: every provider is in the menu, drama-3 and s1 are not, the free Fish model has an off switch", () => {
  const ids = audioModels().map((m) => m.id);
  for (const id of ["eleven_v4", "s2.1-pro", "speech-2.8-hd", "qwen3-tts-flash", "seed-audio-1.0"]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes("drama-3") && !ids.includes("s1"));
  process.env.AUDIO_FISH_FREE_ENABLED = "0";
  assert.ok(!audioModels().some((m) => m.id === "s2.1-pro-free"));
  delete process.env.AUDIO_FISH_FREE_ENABLED;
  for (const m of audioModels()) if (m.supports.emotionTags) assert.ok(m.tags?.length, `${m.id} has tags`);
  for (const t of findAudioModel("s2.1-pro")!.tags!) assert.match(t, /^\[/);
  for (const t of findAudioModel("speech-2.8-hd")!.tags!) assert.match(t, /^[(<]/);
});

// One fake server that answers like each provider, so the adapters' real fetch paths are exercised.
async function fakeServer(handler: (req: IncomingMessage, body: string, res: ServerResponse, base: string) => void): Promise<{ base: string; close: () => void }> {
  const srv = createServer((r, res) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => handler(r, b, res, `http://127.0.0.1:${(srv.address() as AddressInfo).port}`)); });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, close: () => srv.close() };
}

test("adapters against fake servers: success paths and errors hidden in HTTP 200", async () => {
  const seen: Record<string, { headers: IncomingMessage["headers"]; body: string; url?: string }> = {};
  const s = await fakeServer((r, body, res, base) => {
    seen[r.url!.split("?")[0]] = { headers: r.headers, body, url: r.url };
    const json = (o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (r.url === "/v1/tts") { res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(Buffer.from("ID3fishaudio")); return; }
    if (r.url === "/v1/t2a_v2") {
      const j = JSON.parse(body);
      if (j.voice_setting.voice_id === "bad") return json({ data: null, base_resp: { status_code: 1026, status_msg: "sensitive" } });
      return json({ data: { audio: Buffer.from("ID3minimax").toString("hex"), status: 2 }, extra_info: { audio_length: 1200, usage_characters: 12 }, base_resp: { status_code: 0, status_msg: "success" } });
    }
    if (r.url === "/v1/get_voice") return json({ system_voice: [{ voice_id: "English_Narrator", voice_name: "Narrator", description: ["calm"] }], base_resp: { status_code: 0 } });
    if (r.url?.startsWith("/model")) return json({ total: 1, items: [{ _id: "abc123", title: "Warm", type: "tts", languages: ["en"] }], has_more: false });
    if (r.url === "/api/v1/services/aigc/multimodal-generation/generation") return json({ status_code: 200, output: { audio: { url: `${base.replace("http:", "https:")}/qwen.wav` } }, usage: { characters: 12 } });
    if (r.url === "/tts/create") {
      const j = JSON.parse(body);
      if (j.text_prompt === "fail") return json({ code: 429, message: "slow down" });
      return json({ code: 0, audio: Buffer.from("ID3seed").toString("base64"), duration: 4.2, original_duration: 4.2 });
    }
    json({}, 404);
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    const f = await fish.generate(req("s2.1-pro"), ctx);
    assert.equal(Buffer.from(f.bytes!).toString(), "ID3fishaudio");
    assert.equal(seen["/v1/tts"].headers.model, "s2.1-pro");
    assert.equal(seen["/v1/tts"].headers.authorization, "Bearer k");
    assert.deepEqual((await fish.listVoices!(ctx, { search: "warm" })).map((v) => v.voiceId), ["abc123"]);
    assert.match(seen["/model"].url!, /title=warm/);

    const m = await minimax.generate(req("speech-2.8-hd"), ctx);
    assert.equal(Buffer.from(m.bytes!).toString(), "ID3minimax");
    assert.equal(m.durationMs, 1200);
    await assert.rejects(minimax.generate(req("speech-2.8-hd", { voiceId: "bad" }), ctx), (e: unknown) => e instanceof ProviderFailure && e.error.code === "content_refused");
    assert.deepEqual((await minimax.listVoices!(ctx, {})).map((v) => v.name), ["Narrator"]);

    const sd = await seed.generate(req("seed-audio-1.0", { voiceId: undefined }), ctx);
    assert.equal(Buffer.from(sd.bytes!).toString(), "ID3seed");
    assert.equal(sd.usage?.seconds, 4.2);
    assert.equal(seen["/tts/create"].headers["x-api-key"], "k");
    assert.equal(seen["/tts/create"].headers.authorization, undefined);
    await assert.rejects(seed.generate(req("seed-audio-1.0", { text: "fail" }), ctx), (e: unknown) => e instanceof ProviderFailure && e.error.retryable);

    // Qwen hands back an https address; the fake server is plain http, so the download is refused before any request (only https is ever fetched).
    await assert.rejects(qwen.generate(req("qwen3-tts-flash", { voiceId: "Cherry" }), ctx), ProviderFailure);
    assert.equal(JSON.parse(seen["/api/v1/services/aigc/multimodal-generation/generation"].body).input.voice, "Cherry");
  } finally { s.close(); }
});
