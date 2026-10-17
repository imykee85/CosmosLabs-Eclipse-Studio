import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { clockTime, segmentsFromWords, speakerLabel, toPlainText, toSrt } from "../../src/lib/audio/transcript";
import { estimateSeconds, holdUnitsFor, pagePricing, usdFor } from "../../src/lib/audio/pricing";
import { elevenlabs, musicBody, sfxBody, sttFields } from "../../src/lib/audio/providers/elevenlabs";
import { fish } from "../../src/lib/audio/providers/fish";
import { asyncBody, minimax } from "../../src/lib/audio/providers/minimax";
import { audioModels, findAudioModel, modelsOfKind, musicMaxSeconds } from "../../src/lib/audio/registry";
import { ProviderFailure, type AudioRequest } from "../../src/lib/audio/types";

const input = (bytes = "ID3 fake audio bytes") => ({ url: "https://signed.example/in.mp3", name: "talk.mp3", mime: "audio/mpeg", bytes: async () => new Uint8Array(Buffer.from(bytes)) });
const stt = (extra: Partial<AudioRequest> = {}): AudioRequest => ({ kind: "stt", modelId: "scribe_v2", text: "", input: input(), ...extra });

test("words become readable lines: a new line at a sentence end, a speaker change, a pause or a long run", () => {
  const w = (text: string, start: number, end: number, speaker?: string) => ({ text, start, end, speaker });
  const segs = segmentsFromWords([w("Hello", 0, 0.4, "Speaker 1"), w("there.", 0.5, 0.9, "Speaker 1"), w("Hi", 1.0, 1.2, "Speaker 2"), w("back", 1.3, 1.6, "Speaker 2"), w("later", 5, 5.4, "Speaker 2")]);
  assert.deepEqual(segs.map((s) => [s.text, s.speaker, s.start]), [["Hello there.", "Speaker 1", 0], ["Hi back", "Speaker 2", 1.0], ["later", "Speaker 2", 5]]);
  const long = segmentsFromWords(Array.from({ length: 30 }, (_, i) => w(`w${i}`, i * 0.3, i * 0.3 + 0.2)), { maxWords: 10 });
  assert.equal(long.length, 3);
});

test("subtitles, plain text with speakers, clock times and speaker names", () => {
  const t = { text: "Hello there. Hi back later", segments: [{ text: "Hello there.", start: 0, end: 0.9, speaker: "Speaker 1" }, { text: "Hi back", start: 3725.5, end: 3727, speaker: "Speaker 2" }] };
  assert.equal(toSrt(t), "1\n00:00:00,000 --> 00:00:00,900\nSpeaker 1: Hello there.\n\n2\n01:02:05,500 --> 01:02:07,000\nSpeaker 2: Hi back\n");
  assert.equal(toPlainText(t), "Speaker 1: Hello there.\n\nSpeaker 2: Hi back");
  assert.equal(toPlainText({ text: "Just text", segments: [{ text: "Just text", start: 0, end: 1 }] }), "Just text");
  assert.equal(clockTime(125), "02:05");
  assert.equal(speakerLabel("speaker_0"), "Speaker 1");
  assert.equal(speakerLabel("speaker_2"), "Speaker 3");
  assert.equal(speakerLabel(undefined), undefined);
});

test("golden request bodies: ElevenLabs STT, sound effects, music; MiniMax long text", () => {
  assert.deepEqual(sttFields(stt({ diarize: true, language: "en" })), { model_id: "scribe_v2", source_url: "https://signed.example/in.mp3", diarize: "true", timestamps_granularity: "word", tag_audio_events: "false", language_code: "en" });
  assert.deepEqual(sfxBody({ kind: "sfx", modelId: "eleven_text_to_sound_v2", text: "rain", durationSec: 4, loop: true }), { text: "rain", model_id: "eleven_text_to_sound_v2", duration_seconds: 4, loop: true });
  assert.deepEqual(sfxBody({ kind: "sfx", modelId: "eleven_text_to_sound_v2", text: "rain" }), { text: "rain", model_id: "eleven_text_to_sound_v2" });
  assert.deepEqual(musicBody({ kind: "music", modelId: "music_v2_5", text: "calm piano", durationSec: 30, instrumental: true }), { prompt: "calm piano", model_id: "music_v2_5", force_instrumental: true, music_length_ms: 30000 });
  assert.deepEqual(asyncBody({ kind: "tts", modelId: "speech-2.8-hd", text: "long", voiceId: "v", speed: 1.1 }), { model: "speech-2.8-hd", text: "long", voice_setting: { voice_id: "v", speed: 1.1 }, audio_setting: { audio_sample_rate: 44100, bitrate: 128000, format: "mp3", channel: 1 }, language_boost: "auto" });
});

test("pricing by the length of audio: hold ceilings, per-second credit price, size estimate", () => {
  const scribe = findAudioModel("scribe_v2")!, sfx = findAudioModel("eleven_text_to_sound_v2")!, music = findAudioModel("music_v2_5")!;
  assert.equal(estimateSeconds(16000), 1);
  assert.equal(estimateSeconds(1_600_000), 100);
  assert.equal(holdUnitsFor(scribe, { inputBytes: 16_000_000 }), 1000);
  assert.equal(holdUnitsFor(findAudioModel("asr-1.0")!, { inputBytes: 50_000_000 }), 500, "capped at the model's longest recording");
  assert.equal(holdUnitsFor(sfx, {}), 30);
  assert.equal(holdUnitsFor(sfx, { durationSec: 5 }), 5);
  assert.equal(holdUnitsFor(music, { durationSec: 120 }), 120);
  assert.ok(Math.abs(usdFor(music, 60) - 0.15) < 1e-9);
  assert.ok(Math.abs(usdFor(scribe, 3600) - 0.22) < 1e-9);
  assert.ok(Math.abs(usdFor(sfx, 30) - 0.06) < 1e-9);
  assert.equal(pagePricing(music)?.unit, "sec");
});

test("registry: every kind has models, drama-3 waits for its price, music length is capped", () => {
  assert.deepEqual(modelsOfKind("stt").map((m) => m.provider).sort(), ["elevenlabs", "fish", "minimax"]);
  assert.deepEqual(modelsOfKind("sfx").map((m) => m.id).sort(), ["eleven_text_to_sound_v2", "sfx-2.0"]); // ElevenLabs and Mirelo
  assert.deepEqual(modelsOfKind("vsfx").map((m) => m.id), ["sfx-2.0"]); // only Mirelo makes sound for a video
  assert.equal(modelsOfKind("music").length, 1);
  assert.ok(!audioModels().some((m) => m.id === "drama-3"));
  process.env.FISH_DRAMA3_PRICE_PER_MILLION_BYTES = "20";
  assert.ok(audioModels().some((m) => m.id === "drama-3"));
  assert.ok(Math.abs(usdFor(findAudioModel("drama-3")!, 1_000_000) - 20) < 1e-9, "the owner's price is used");
  delete process.env.FISH_DRAMA3_PRICE_PER_MILLION_BYTES;
  assert.equal(musicMaxSeconds(findAudioModel("music_v2_5")!), 240);
  process.env.AUDIO_MUSIC_MAX_SECONDS = "600";
  assert.equal(musicMaxSeconds(findAudioModel("music_v2_5")!), 600);
  delete process.env.AUDIO_MUSIC_MAX_SECONDS;
  assert.equal(findAudioModel("speech-2.8-hd")!.maxChars, 50000);
  assert.ok(findAudioModel("speech-02-hd"));
});

async function fakeServer(handler: (r: IncomingMessage, body: string, res: ServerResponse) => void) {
  const srv = createServer((r, res) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => handler(r, b, res)); });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, close: () => srv.close() };
}
const json = (res: ServerResponse, o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };

test("ElevenLabs: transcript from words with speakers, no speech refused, sound effect and music bytes, refused music prompt explained", async () => {
  const seen: Record<string, { body: string; url?: string }> = {};
  const s = await fakeServer((r, body, res) => {
    seen[r.url!.split("?")[0]] = { body, url: r.url };
    if (r.url === "/v1/speech-to-text") {
      if (body.includes("silence")) return json(res, { text: "", words: [] });
      return json(res, { language_code: "en", text: "Hello there. Hi back", words: [
        { text: "Hello", type: "word", start: 0, end: 0.4, speaker_id: "speaker_0" }, { text: " ", type: "spacing", start: 0.4, end: 0.5 }, { text: "there.", type: "word", start: 0.5, end: 0.9, speaker_id: "speaker_0" },
        { text: "Hi", type: "word", start: 1.0, end: 1.2, speaker_id: "speaker_1" }, { text: "back", type: "word", start: 1.3, end: 1.6, speaker_id: "speaker_1" }] });
    }
    if (r.url?.startsWith("/v1/sound-generation") || r.url?.startsWith("/v1/music")) {
      if (body.includes("Taylor")) return json(res, { detail: { code: "bad_prompt", message: "x" } }, 400);
      res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(Buffer.from("ID3audio"));
    }
    json(res, {}, 404);
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    const t = (await elevenlabs.generate(stt({ diarize: true }), ctx)).transcript!;
    assert.equal(t.language, "en");
    assert.equal(t.durationSec, 1.6);
    assert.deepEqual(t.segments.map((x) => [x.text, x.speaker]), [["Hello there.", "Speaker 1"], ["Hi back", "Speaker 2"]]);
    assert.match(seen["/v1/speech-to-text"].body, /name="source_url"[\s\S]*signed\.example/);
    assert.match(seen["/v1/speech-to-text"].body, /name="diarize"[\s\S]*true/);
    await assert.rejects(elevenlabs.generate(stt({ input: { ...input(), url: "https://signed.example/silence.mp3" } }), ctx), (e: unknown) => e instanceof ProviderFailure && e.error.code === "no_speech");
    const fx = await elevenlabs.generate({ kind: "sfx", modelId: "eleven_text_to_sound_v2", text: "rain", durationSec: 3 }, ctx);
    assert.equal(Buffer.from(fx.bytes!).toString(), "ID3audio");
    assert.match(seen["/v1/sound-generation"].url!, /output_format=mp3_44100_128/);
    const mu = await elevenlabs.generate({ kind: "music", modelId: "music_v2_5", text: "calm piano", durationSec: 30 }, ctx);
    assert.equal(mu.mime, "audio/mpeg");
    assert.equal(JSON.parse(seen["/v1/music"].body).model_id, "music_v2_5", "the model is always sent: the API default is music_v1");
    await assert.rejects(elevenlabs.generate({ kind: "music", modelId: "music_v2_5", text: "like Taylor" }, ctx), (e: unknown) => e instanceof ProviderFailure && /artists or include lyrics/.test(e.error.userMessage));
  } finally { s.close(); }
});

test("Fish: transcript from segments with a model header; designs return WAV previews and a signature saves one", async () => {
  const seen: { url?: string; headers: IncomingMessage["headers"]; body: string }[] = [];
  const s = await fakeServer((r, body, res) => {
    seen.push({ url: r.url, headers: r.headers, body });
    if (r.url === "/v1/asr") return json(res, { text: "Hello there", duration: 2.5, language: "en", segments: [{ text: "Hello there", start: 0, end: 2.5, speaker: 0 }] });
    if (r.url === "/v1/voice-design") return json(res, { candidates: [{ id: "sigA", audio_base64: Buffer.from("RIFFwav").toString("base64"), duration_ms: 4000 }, { id: "sigB", audio_base64: "" }] });
    if (r.url === "/model") return json(res, { _id: "m_designed", state: "trained" }, 201);
    json(res, {}, 404);
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    const t = (await fish.generate({ kind: "stt", modelId: "transcribe-1-pro", text: "", input: input(), diarize: true }, ctx)).transcript!;
    assert.equal(t.durationSec, 2.5);
    assert.equal(t.segments[0].speaker, "Speaker 1");
    assert.equal(seen[0].headers.model, "transcribe-1-pro");
    assert.match(seen[0].body, /name="diarize"[\s\S]*true/);
    const d = await fish.designVoice!({ description: "A warm calm narrator" }, ctx);
    assert.deepEqual(d.map((p) => [p.token, p.mime, p.durationMs]), [["sigA", "audio/wav", 4000]]);
    assert.equal(seen[1].headers.model, "voice-design-1");
    assert.equal((await fish.saveDesign!("sigA", { name: "Warm", description: "A warm calm narrator" }, ctx)).voiceId, "m_designed");
    assert.match(seen[2].body, /name="voice_design_signatures"[\s\S]*sigA/);
  } finally { s.close(); }
});

test("MiniMax: transcript, and a long text started, followed through Processing to Success, and fetched", async () => {
  let polls = 0;
  const seen: { url?: string; body: string }[] = [];
  const s = await fakeServer((r, body, res) => {
    seen.push({ url: r.url, body });
    res.setHeader("content-type", "application/json");
    if (r.url === "/v1/speech_to_text") return res.end(JSON.stringify({ text: "Hello there", duration: 3, segments: [{ text: "Hello there", start: 0, end: 3 }] }));
    if (r.url === "/v1/t2a_async_v2") return res.end('{"task_id":1234567890123456789,"file_id":99,"usage_characters":4000,"base_resp":{"status_code":0}}');
    if (r.url?.startsWith("/v1/query/t2a_async_query_v2")) { polls++; return res.end(polls < 2 ? '{"status":"Processing","base_resp":{"status_code":0}}' : '{"status":"Success","file_id":777888999000111222,"base_resp":{"status_code":0}}'); }
    if (r.url?.startsWith("/v1/files/retrieve_content")) { res.setHeader("content-type", "audio/mpeg"); return res.end(Buffer.from("ID3longaudio")); }
    res.statusCode = 404; res.end("{}");
  });
  try {
    const ctx = { apiKey: "k", baseUrl: s.base };
    const t = (await minimax.generate({ kind: "stt", modelId: "asr-1.0", text: "", input: input() }, ctx)).transcript!;
    assert.equal(t.text, "Hello there");
    assert.equal(t.durationSec, 3);
    const { taskId } = await minimax.start!({ kind: "tts", modelId: "speech-2.8-hd", text: "x".repeat(4000), voiceId: "v" }, ctx);
    assert.equal(taskId, "1234567890123456789", "a 19-digit id is kept exact");
    assert.equal((await minimax.poll!(taskId, ctx)).status, "running");
    const done = await minimax.poll!(taskId, ctx);
    assert.equal(done.status, "done");
    assert.equal(Buffer.from(done.result!.bytes!).toString(), "ID3longaudio");
    assert.match(seen.find((x) => x.url?.startsWith("/v1/files/retrieve_content"))!.url!, /file_id=777888999000111222$/);
    assert.equal((await minimax.poll!("abc", ctx)).status, "failed", "a task id that is not digits is never sent");
  } finally { s.close(); }
});
