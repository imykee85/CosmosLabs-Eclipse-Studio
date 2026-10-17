import test from "node:test";
import assert from "node:assert/strict";
import { mapMireloError } from "../../src/lib/audio/errors";
import { collectItems, mireloBody } from "../../src/lib/audio/providers/mirelo";
import { AUDIO_MODELS, priceOf } from "../../src/lib/audio/registry";
import { holdUnitsFor, pagePricing } from "../../src/lib/audio/pricing";

test("request bodies are exactly what the reference shows", () => {
  assert.deepEqual(mireloBody({ kind: "sfx", modelId: "sfx-2.0", text: "footsteps on gravel", durationSec: 8, variants: 2, outputFormat: "wav", negativePrompt: "music" }),
    { model: "sfx-2.0", num_variants: 2, input: { prompt: "footsteps on gravel", negative_prompt: "music" }, output: { format: "wav" }, duration_ms: 8000 });
  assert.deepEqual(mireloBody({ kind: "vsfx", modelId: "sfx-2.0", text: "", durationSec: 5.04, variants: 1, videoUrl: "https://x/v.mp4", preserveSpeech: false, outputFormat: "mp3_192" }),
    { model: "sfx-2.0", num_variants: 1, input: { video: { type: "url", url: "https://x/v.mp4" } }, output: { format: "mp3_192" }, duration_ms: 5040, controls: { preserve_speech: false } });
  const kept = mireloBody({ kind: "vsfx", modelId: "sfx-2.0", text: "wind", videoUrl: "https://x/v.mp4" });
  assert.deepEqual(kept.controls, { preserve_speech: true }, "speech is kept unless the person turns it off");
  assert.equal("duration_ms" in kept, false, "no duration when the clip's length is unknown");
  assert.equal(((kept.input as Record<string, unknown>).prompt), "wind");
  // a negative prompt belongs to text sound effects only; variants are clamped to 1..4; the seed is never sent
  assert.equal("negative_prompt" in (mireloBody({ kind: "vsfx", modelId: "sfx-2.0", text: "", negativePrompt: "x", videoUrl: "https://x/v.mp4" }).input as object), false);
  assert.equal(mireloBody({ kind: "sfx", modelId: "sfx-2.0", text: "a", variants: 9 }).num_variants, 4);
  assert.equal(mireloBody({ kind: "sfx", modelId: "sfx-2.0", text: "a" }).num_variants, 1);
  assert.equal("seed" in mireloBody({ kind: "sfx", modelId: "sfx-2.0", text: "a" }), false);
});

test("audio addresses are found wherever the result keeps them, with each variant's own status", () => {
  const a = collectItems({ outputs: [{ status: "succeeded", url: "https://cdn/1.wav" }, { status: "failed", url: "https://cdn/2.wav" }] });
  assert.deepEqual(a.map((i) => [i.url, i.status]), [["https://cdn/1.wav", "succeeded"], ["https://cdn/2.wav", "failed"]]);
  assert.equal(collectItems({ variants: [{ audio: { url: "https://cdn/n.mp3", content_type: "audio/mpeg" } }] }).length, 1);
  assert.equal(collectItems({ url: "javascript:alert(1)" }).length, 0, "only http(s) addresses");
  assert.equal(collectItems(null).length, 0);
  assert.equal(collectItems({ a: { b: { c: { d: { e: { f: { url: "https://too/deep.wav" } } } } } } }).length, 0);
  assert.ok(collectItems(Array.from({ length: 20 }, (_, i) => ({ url: `https://cdn/${i}.wav` }))).length <= 8);
});

test("every Mirelo error code ends as the right kind of message", () => {
  const err = (status: number, code: string) => mapMireloError(status, JSON.stringify({ error: { code, message: "x", retryable: false } }));
  for (const [s, c] of [[402, "insufficient_credits"], [401, "invalid_api_key"], [403, "forbidden"], [200, "max_credits_exceeded"]] as const) { const e = err(s, c); assert.ok(e.alert && !e.retryable, `${s} ${c}`); assert.doesNotMatch(e.userMessage, /credit/i); }
  for (const [s, c] of [[429, "rate_limited"], [409, "asset_not_ready"], [422, "sync_too_long"], [503, ""], [500, "result_unreadable"]] as const) assert.ok(mapMireloError(s, JSON.stringify({ error: { code: c } })).retryable, `${s} ${c}`);
  assert.equal(err(400, "invalid_video").userMessage, "That video could not be read. Try another clip.");
  assert.equal(err(400, "capability_unsupported").retryable, false);
  assert.equal(err(409, "idempotency_conflict").code, "idempotency_conflict");
  assert.equal(err(404, "not_found").retryable, false);
  assert.equal(mapMireloError(500, "<html>").retryable, true, "a body that is not JSON still maps by status");
});

test("sfx-2.0 in the registry: list price, launch price until 2026-12-12, per variant", () => {
  const m = AUDIO_MODELS.find((x) => x.id === "sfx-2.0")!;
  assert.deepEqual(m.kinds, ["sfx", "vsfx"]);
  assert.equal(m.loop ?? false, false, "loop is refused by sfx-2.0, so the chip stays grey");
  assert.equal(m.maxVariants, 4); assert.equal(m.maxChars, 2000); assert.equal(m.maxSeconds, 600);
  assert.equal(priceOf(m, "2026-12-12"), 0.01);
  assert.equal(priceOf(m, "2026-12-13"), 0.015);
  process.env.MIRELO_PRICE_PER_SECOND = "0.02";
  assert.equal(priceOf(m, "2026-10-17"), 0.02, "a Config value replaces the registry price");
  delete process.env.MIRELO_PRICE_PER_SECOND;
  assert.equal(holdUnitsFor(m, { durationSec: 10, variants: 3 }), 30, "held per second per variant");
  assert.equal(holdUnitsFor(m, { durationSec: 10, variants: 99 }), 40);
  const p = pagePricing(m);
  assert.ok(p && p.unit === "sec" && p.perSec > 0);
});
