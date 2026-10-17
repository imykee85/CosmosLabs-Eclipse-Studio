import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA, RELIGHT, toolModel, toolPrompt, toolTier } from "../../src/lib/picture-tools";
import type { PublicModel } from "../../src/lib/models";

const m = (id: string, maxReferences: number, resolutions: string[] = []): PublicModel => ({ id, label: id, blurb: "", ratios: ["1:1"], resolutions, maxBatch: 1, maxPrompt: 2000, verified: true, autoPick: true, seed: { supported: false, min: 0, max: 0 }, maxReferences, requiresReference: false, credits: null } as unknown as PublicModel);

test("tools pick the best editing model the account has", () => {
  const list = [m("soul_v2", 0), m("seedream_5_pro", 10, ["1k", "2k"]), m("nano_banana_pro", 6, ["1k", "2k", "4k"])];
  assert.equal(toolModel(list, "removebg")?.id, "nano_banana_pro");
  assert.equal(toolModel([m("soul_v2", 0), m("seedream_5_pro", 10, ["1k", "2k"])], "relight")?.id, "seedream_5_pro");
  assert.equal(toolModel([m("soul_v2", 0)], "camera"), null, "a model without pictures never edits");
  assert.equal(toolModel([m("gpt_image_2", 16, ["1k", "2k"]), m("x_4k", 4, ["4k"])], "upscale")?.id, "x_4k", "upscale prefers 4K");
});

test("tiers and prompts", () => {
  assert.equal(toolTier(m("a", 1, ["1k", "2k", "4k"]), "upscale"), "4k");
  assert.equal(toolTier(m("a", 1, ["1k", "2k", "4k"]), "relight"), "2k");
  assert.equal(toolTier(m("a", 1, []), "upscale"), "1k");
  assert.match(toolPrompt("removebg"), /white background/);
  assert.match(toolPrompt("relight", RELIGHT[0]), /golden-hour/);
  assert.match(toolPrompt("camera", CAMERA[2]), /low-angle/);
  for (const t of ["upscale", "removebg", "relight", "camera"] as const) assert.match(toolPrompt(t, CAMERA[0]), /image 1/);
});
