import test from "node:test";
import assert from "node:assert/strict";
import { joinMp3, mp3DurationMs, splitForTts } from "../../src/lib/audio/chunk";
import { mapElevenLabsError } from "../../src/lib/audio/errors";
import { Limiter } from "../../src/lib/audio/limiter";
import { creditsFor, ttsCredits, usdFor } from "../../src/lib/audio/pricing";
import { ttsBody } from "../../src/lib/audio/providers/elevenlabs";
import { AUDIO_MODELS, findAudioModel } from "../../src/lib/audio/registry";
import { withRetry } from "../../src/lib/audio/retry";
import { ProviderFailure } from "../../src/lib/audio/types";

const err = (status: number, code?: string) => mapElevenLabsError(status, code ? JSON.stringify({ detail: { code, message: "x", status: code } }) : "");

test("chunker: short text stays whole, long text splits at sentence ends under the limit", () => {
  assert.deepEqual(splitForTts("Hello there.", 100), ["Hello there."]);
  const text = "First sentence here. Second sentence is a bit longer. Third one! Fourth? Fifth sentence ends it.";
  const parts = splitForTts(text, 40);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 40, `"${p}" is over 40`);
  for (const p of parts) assert.match(p, /[.!?]$/, `"${p}" does not end at a sentence end`);
  assert.equal(parts.join(" "), text);
});

test("chunker: a sentence longer than the limit is cut at commas or spaces, never beyond the limit", () => {
  const long = "alpha beta gamma, delta epsilon zeta, eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau";
  const parts = splitForTts(long, 30);
  for (const p of parts) assert.ok(p.length <= 30);
  assert.equal(parts.join(" ").replace(/\s+/g, " "), long);
  const nospace = "x".repeat(95);
  const hard = splitForTts(nospace, 30);
  assert.equal(hard.join(""), nospace);
  for (const p of hard) assert.ok(p.length <= 30);
});

test("chunker: byte counting for Fish-style limits (CJK is 3 bytes a character)", () => {
  const text = "你好世界。今天天气很好。我们去公园散步吧。";
  const parts = splitForTts(text, 30, "byte");
  for (const p of parts) assert.ok(Buffer.byteLength(p, "utf8") <= 30);
  assert.equal(parts.join(""), text);
  assert.deepEqual(splitForTts("   ", 10), []);
});

test("chunker: does not split a surrogate pair", () => {
  const emoji = "😀".repeat(20);
  for (const p of splitForTts(emoji, 7)) assert.doesNotMatch(p, /[\uD800-\uDBFF]$/);
});

test("mp3 join and duration", () => {
  const joined = joinMp3([new Uint8Array([1, 2]), new Uint8Array([3])]);
  assert.deepEqual([...joined], [1, 2, 3]);
  assert.equal(mp3DurationMs(16000, 128), 1000);
});

test("ElevenLabs error mapper: every documented code", () => {
  for (const c of ["system_busy", "concurrent_limit_exceeded", "rate_limit_exceeded"]) { const e = err(429, c); assert.equal(e.retryable, true, c); assert.equal(e.code, c); }
  assert.equal(err(429).retryable, true);
  assert.equal(err(500).retryable, true);
  assert.equal(err(503, "maintenance").retryable, true);
  assert.equal(err(503, "service_unavailable").retryable, true);
  assert.deepEqual([err(402, "insufficient_credits").retryable, err(402, "insufficient_credits").alert], [false, true]);
  assert.deepEqual([err(401, "authentication_error").retryable, err(401, "authentication_error").alert], [false, true]);
  for (const c of ["feature_not_available", "subscription_required", "model_access_denied"]) assert.equal(err(403, c).alert, true, c);
  const denied = err(403, "voice_access_denied");
  assert.deepEqual([denied.alert, denied.retryable], [undefined, false]); // the person can fix it: pick another voice
  assert.match(denied.userMessage, /another voice/i);
  assert.match(err(404, "voice_not_found").userMessage, /another voice/i);
  assert.match(err(400, "invalid_voice_id").userMessage, /another voice/i);
  assert.match(err(400, "text_too_long").userMessage, /too long/i);
  assert.match(err(400, "bad_prompt").userMessage, /refused/i);
  assert.equal(err(400, "unsupported_model").alert, true);
  assert.equal(err(400, "invalid_output_format").alert, true);
  assert.equal(err(422).retryable, false);
  // Validation errors come as an array in `detail`; and plain text bodies must not throw.
  assert.equal(mapElevenLabsError(422, JSON.stringify({ detail: [{ msg: "field required" }] })).code, "validation_error");
  assert.equal(mapElevenLabsError(502, "<html>bad gateway</html>").retryable, true);
  assert.doesNotMatch(JSON.stringify(err(500)), /xi-api-key/i);
});

test("ElevenLabs request body is exactly what the reference file says", () => {
  assert.deepEqual(ttsBody({ kind: "tts", modelId: "eleven_v4", text: "Hi [whispers] there.", voiceId: "abc" }), { text: "Hi [whispers] there.", model_id: "eleven_v4" });
  assert.deepEqual(
    ttsBody({ kind: "tts", modelId: "eleven_flash_v2_5", text: "B", voiceId: "abc", speed: 1.1, languageCode: "en", seed: 7, previousText: "A", nextText: "C" }),
    { text: "B", model_id: "eleven_flash_v2_5", voice_settings: { speed: 1.1 }, language_code: "en", seed: 7, previous_text: "A", next_text: "C" },
  );
});

test("retry: transient failures retry with growing pauses, refusals and billing errors never retry", async () => {
  const waits: number[] = [];
  let n = 0;
  const ok = await withRetry(async () => { if (++n < 3) throw new ProviderFailure(err(429, "system_busy")); return "done"; }, { sleep: async (ms) => { waits.push(ms); }, random: () => 0.5 });
  assert.equal(ok, "done");
  assert.deepEqual(waits, [1000, 2000]);
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new ProviderFailure(err(400, "bad_prompt")); }, { sleep: async () => {} }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new ProviderFailure(err(402, "insufficient_credits")); }, { sleep: async () => {} }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new ProviderFailure(err(503)); }, { sleep: async () => {}, tries: 3 }));
  assert.equal(calls, 3); // at most three tries
  await assert.rejects(withRetry(async () => { throw new Error("not a provider failure"); }, { sleep: async () => {} }), /not a provider failure/);
});

test("limiter: at most N at once, the rest wait their turn", async () => {
  const l = new Limiter(2, 0);
  let running = 0, peak = 0;
  const work = async () => { const release = await l.acquire(); running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 20)); running--; release(); };
  await Promise.all(Array.from({ length: 6 }, work));
  assert.equal(peak, 2);
});

test("limiter: the per-minute window holds back the extra request", async () => {
  let t = 0;
  const slept: number[] = [];
  const l = new Limiter(0, 2, () => t, async (ms) => { slept.push(ms); t += ms; });
  (await l.acquire())(); (await l.acquire())();
  assert.equal(slept.length, 0);
  (await l.acquire())();
  assert.ok(slept.length >= 1);
  assert.ok(t >= 60_000);
});

test("pricing: provider cost from the registry and credits rounded up", () => {
  const v4 = findAudioModel("eleven_v4")!;
  assert.equal(usdFor(v4, 1000), 0.08);
  assert.equal(usdFor(findAudioModel("eleven_flash_v2_5")!, 1000), 0.04);
  assert.equal(creditsFor(0.08), Math.ceil((0.08 * 2.5) / 0.01)); // 20 ledger units = 2 credits
  assert.equal(creditsFor(0), 1); // never free
  assert.equal(ttsCredits(v4, 1000), creditsFor(0.08));
});

test("registry: the required models exist with the documented limits, and no deprecated model is registered", () => {
  assert.equal(findAudioModel("eleven_v4")!.maxChars, 10000);
  assert.equal(findAudioModel("eleven_flash_v2_5")!.maxChars, 40000);
  assert.equal(findAudioModel("eleven_flash_v2_5")!.price, 0.04);
  assert.equal(findAudioModel("eleven_v4")!.supports.emotionTags, true);
  assert.equal(findAudioModel("eleven_flash_v2_5")!.supports.emotionTags, false);
  assert.equal(findAudioModel("s1"), undefined);
  for (const m of AUDIO_MODELS) assert.ok(m.callChars <= m.maxChars, m.id);
  assert.equal(findAudioModel("fake-tts"), undefined); // only with AUDIO_FAKE=1
});

test("credits per character matches what the server holds (never less than one credit)", async () => {
  const { creditsPerChar } = await import("../../src/lib/audio/pricing");
  const v4 = findAudioModel("eleven_v4")!;
  for (const chars of [1, 28, 1000, 4321]) assert.equal(Math.max(1, Math.ceil(chars * creditsPerChar(v4)!)), creditsFor(usdFor(v4, chars)), `${chars} chars`);
});
