import test from "node:test";
import assert from "node:assert/strict";
import { fish, fishBody, fishTtsHeaders, assertModelHeader } from "../../src/lib/audio/providers/fish";
import { AUDIO_MODELS } from "../../src/lib/audio/registry";
import { checkSpeakers } from "../../src/lib/audio/speakers";
import { holdUnits } from "../../src/lib/audio/pricing";

const ctx = { apiKey: "k", baseUrl: "https://fish.test" } as never;
const req = (extra: Record<string, unknown> = {}) => ({ kind: "tts" as const, modelId: "drama-3", text: "[calm] Hello.", voiceId: "v0", ...extra });

test("drama-3 registry entry: list price, directions, word tags, no S2 tags, off until switched on", () => {
  const m = AUDIO_MODELS.find((x) => x.id === "drama-3")!;
  assert.equal(m.price, 50); assert.equal(m.per, 1_000_000); assert.equal(m.priceUnit, "byte");
  assert.equal(m.directions, true); assert.equal(m.multiSpeaker, true); assert.equal(m.supports.emotionTags, false); assert.deepEqual(m.tags, []);
  assert.deepEqual(m.wordTags, ["whisper", "emphasis", "soft", "fast", "slow", "stress", "forceful"]);
  assert.equal(m.needsEnv, "FISH_DRAMA3_ENABLED"); assert.equal(m.supports.speed, false);
});

test("the model header is always sent and checked: a missing or wrong one is refused", () => {
  const h = fishTtsHeaders("drama-3", "k");
  assert.equal(h.model, "drama-3"); assert.equal(h.Authorization, "Bearer k");
  assert.doesNotThrow(() => assertModelHeader(h, "drama-3"));
  assert.throws(() => assertModelHeader({ Authorization: "Bearer k" }, "drama-3"), (e: { error?: { code?: string } }) => e.error?.code === "model_header");
  assert.throws(() => assertModelHeader({ model: "drama3" }, "drama-3"));
  assert.throws(() => assertModelHeader({ model: "drama-3" }, "drama3"));
});

test("golden bodies: one voice is a string, a scene is an array in speaker order", () => {
  assert.deepEqual(fishBody(req()), { text: "[calm] Hello.", reference_id: "v0", format: "mp3", mp3_bitrate: 128, sample_rate: 44100 });
  const scene = "<|speaker:0|>[calm] The ship was silent.<|speaker:1|>[low] Status report.<|speaker:2|>[fast] <emphasis>blow</emphasis>.";
  const b = fishBody(req({ text: scene, voiceIds: ["v1", "v2"] }));
  assert.deepEqual(b.reference_id, ["v0", "v1", "v2"]); assert.equal(b.text, scene);
  assert.equal("model" in b, false);
});

test("the request goes to /v1/tts with the drama-3 header and the scene array", async () => {
  const seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => { seen.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }); }) as never;
  try {
    const out = await fish.generate(req({ text: "<|speaker:0|>Hi<|speaker:1|>Yo", voiceIds: ["v1"] }), ctx);
    assert.equal(out.bytes!.length, 4);
    assert.equal(seen[0].url, "https://fish.test/v1/tts"); assert.equal(seen[0].headers.model, "drama-3"); assert.deepEqual(seen[0].body.reference_id, ["v0", "v1"]);
    // round brackets are ordinary text for Drama 3 but still refused for S2
    await fish.generate(req({ text: "(happy) hello" }), ctx);
    await assert.rejects(() => fish.generate(req({ modelId: "s2.1-pro", text: "(happy) hello" }), ctx));
  } finally { globalThis.fetch = real; }
});

test("billing counts UTF-8 bytes, directions and tags included", () => {
  const m = AUDIO_MODELS.find((x) => x.id === "drama-3")!;
  const t = "[whispers] Café <emphasis>très</emphasis>";
  assert.equal(holdUnits(m, t), Buffer.byteLength(t, "utf8"));
  assert.ok(Buffer.byteLength(t, "utf8") > t.length);
});

test("a scene needs a voice for every speaker it names", () => {
  const m = AUDIO_MODELS.find((x) => x.id === "drama-3")!, s2 = AUDIO_MODELS.find((x) => x.id === "s2.1-pro")!;
  const a = checkSpeakers(m, "<|speaker:0|>Hi<|speaker:1|>Yo", undefined);
  assert.equal(a.ok, false); assert.match((a as { error: string }).error, /speaker 1 but only 1 voice is chosen/);
  const b = checkSpeakers(m, "Hello there", ["v1"]);
  assert.equal(b.ok, false); assert.match((b as { error: string }).error, /speaker tag/);
  const c = checkSpeakers(m, "<|speaker:0|>Hi", ["a", "b", "c", "d", "e"]);
  assert.equal(c.ok, false); assert.match((c as { error: string }).error, /up to 5 voices/);
  assert.equal(checkSpeakers(s2, "Hi", ["v1"]).ok, false, "S2 models take one voice");
  assert.equal(checkSpeakers(m, "<|speaker:0|>Hi<|speaker:1|>Yo", ["v1"]).ok, true);
  assert.deepEqual((checkSpeakers(m, "Just one voice, no tags", undefined) as { extra: string[] }).extra, []);
  const long = checkSpeakers(m, "<|speaker:0|>" + "word ".repeat(500), undefined);
  assert.equal(long.ok, false); assert.match((long as { error: string }).error, /2,000 bytes/);
  assert.equal(checkSpeakers(m, "<|speaker:0|>Hi", ["bad id!"]).ok, false);
});
