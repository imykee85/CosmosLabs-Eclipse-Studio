import test from "node:test";
import assert from "node:assert/strict";
import { openaiRequest, openaiCostUsd, openaiSize } from "../../src/lib/providers/openai";
import { arkRequest } from "../../src/lib/providers/byteplus";
import { allImageModels, getModelById, enabledModels, imageCredits } from "../../src/lib/models";

const png = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };

test("GPT Image 2.6: medium quality, safety_identifier, complexity low on edits only", () => {
  const gen = openaiRequest({ apiModel: "gpt-image-2.6-sunburst", prompt: "x", references: [], aspectRatio: "16:9", resolution: "1k", sizing: "custom16", quality: "medium", complexity: "low", safetyId: true, user: "u_abc" });
  assert.equal(gen.path, "/images/generations");
  assert.deepEqual({ model: gen.body.model, quality: gen.body.quality, safety_identifier: gen.body.safety_identifier, user: gen.body.user, complexity: gen.body.complexity, n: gen.body.n }, { model: "gpt-image-2.6-sunburst", quality: "medium", safety_identifier: "u_abc", user: undefined, complexity: undefined, n: 1 });
  assert.equal(gen.body.size, "1024x576");
  const edit = openaiRequest({ apiModel: "gpt-image-2.6-sunburst", prompt: "x", references: [png], aspectRatio: "1:1", resolution: "1k", sizing: "custom16", quality: "medium", complexity: "low", safetyId: true, user: "u_abc" });
  assert.equal(edit.path, "/images/edits");
  assert.equal(edit.body.complexity, "low");
  assert.ok(Array.isArray(edit.body.images) && (edit.body.images as unknown[]).length === 1);
  assert.equal("response_format" in edit.body, false);
  assert.equal("input_fidelity" in edit.body, false);
});

test("older GPT models keep their request: no complexity, `user`, medium", () => {
  const r = openaiRequest({ apiModel: "gpt-image-2.5-sunburst", prompt: "x", references: [png], aspectRatio: "1:1", resolution: "1k", sizing: "custom16", user: "u_abc" });
  assert.equal(r.body.quality, "medium"); assert.equal(r.body.user, "u_abc"); assert.equal("complexity" in r.body, false); assert.equal("safety_identifier" in r.body, false);
});

test("2.6 sizes: every side a multiple of 16, within 1:3 to 3:1 and 3840x2160", () => {
  for (const ratio of ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"]) for (const tier of ["1k", "2k"]) {
    const [w, h] = openaiSize(ratio, tier, "custom16").split("x").map(Number);
    assert.equal(w % 16, 0); assert.equal(h % 16, 0); assert.ok(w / h <= 3.0001 && w / h >= 1 / 3.0001); assert.ok(w <= 3840 && h <= 2160 || h <= 3840 && w <= 2160);
  }
});

test("the real cost of a render comes from its usage numbers", () => {
  const price = { textIn: 5, imageIn: 8, imageOut: 30 };
  // 1024x1024 at medium: about 1,450 output tokens = $0.0435
  assert.equal(openaiCostUsd({ input_tokens: 100, output_tokens: 1450, input_tokens_details: { text_tokens: 100, image_tokens: 0 } }, price), 0.044);
  assert.equal(openaiCostUsd({ input_tokens: 1100, output_tokens: 1000, input_tokens_details: { text_tokens: 100, image_tokens: 1000 } }, price), 0.0385);
  assert.equal(openaiCostUsd({ output_tokens: 10 }, undefined), null);
  assert.equal(openaiCostUsd(null, price), null);
  assert.equal(openaiCostUsd({ input_tokens: 5 }, price), null);
});

test("registry: 2.6 Sunburst on, Flare off until a real call passes, Seedream 5.5 hidden without its id", () => {
  const sun = getModelById("gpt_image_2_6_sunburst")!, flare = getModelById("gpt_image_2_6_flare")!, s55 = getModelById("seedream_5_5")!;
  assert.equal(sun.apiModel, "gpt-image-2.6-sunburst"); assert.equal(flare.apiModel, "gpt-image-2.6-flare");
  assert.equal(sun.provider, "openai"); assert.equal(sun.seed.supported, false); assert.equal(sun.references.max, 16);
  assert.equal(flare.enabled, true); assert.equal(s55.enabled, false); assert.equal(s55.apiModel, undefined); assert.equal(s55.provider, "byteplus"); assert.equal(s55.seed.supported, false); assert.equal(s55.references.max, 10);
  const old = { O: process.env.OPENAI_API_KEY, A: process.env.ARK_API_KEY, M: process.env.ARK_MODEL_SEEDREAM_5_5, E: process.env.ENABLED_MODELS };
  process.env.OPENAI_API_KEY = "k"; process.env.ARK_API_KEY = "k"; delete process.env.ARK_MODEL_SEEDREAM_5_5; delete process.env.ENABLED_MODELS;
  try {
    const ids = enabledModels().map((m) => m.id);
    assert.ok(ids.includes("gpt_image_2_6_sunburst")); assert.ok(ids.includes("gpt_image_2_6_flare")); assert.ok(!ids.includes("seedream_5_5"));
    process.env.ARK_MODEL_SEEDREAM_5_5 = "seedream-5-5-261110"; process.env.ENABLED_MODELS = "gpt_image_2_6_flare,seedream_5_5";
    const on = enabledModels().map((m) => m.id);
    assert.ok(on.includes("gpt_image_2_6_flare")); assert.ok(on.includes("seedream_5_5"));
  } finally { for (const [k, v] of [["OPENAI_API_KEY", old.O], ["ARK_API_KEY", old.A], ["ARK_MODEL_SEEDREAM_5_5", old.M], ["ENABLED_MODELS", old.E]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  assert.ok(allImageModels().some((m) => m.id === "seedream_5_5"));
  assert.ok((imageCredits(sun, "1k") ?? 0) > 0);
});

test("Seedream 5.5 request: id from the console, size from the 5.0 pro table, watermark off, no seed, references as data URLs", () => {
  const s55 = getModelById("seedream_5_5")!;
  const body = arkRequest({ apiModel: "seedream-5-5-261110", prompt: "x", aspectRatio: "16:9", resolution: "2k", references: [png], sizeRule: s55.sizeRule }, s55.outputPng === true);
  assert.equal(body.model, "seedream-5-5-261110"); assert.equal(body.size, "2816x1584"); assert.equal(body.watermark, false); assert.equal(body.response_format, "b64_json"); assert.equal(body.output_format, "png");
  assert.ok(Array.isArray(body.image) && String((body.image as string[])[0]).startsWith("data:image/png;base64,")); assert.equal("seed" in body, false);
});
