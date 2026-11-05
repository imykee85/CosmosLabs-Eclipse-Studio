import test from "node:test";
import assert from "node:assert/strict";
import { imageFormFields, imageOutputSize, imageTopazCredits, topazConfigured, videoFilter, videoOutputSize, videoTopazCredits } from "../../src/lib/topaz/models";

test("image credits match the maker's price table", () => {
  const mp = (m: number) => { const w = Math.floor(Math.sqrt(m * 1e6)); return [w, w] as const; };
  const rows: [string, number, number][] = [["auto", 2.07, 1], ["auto", 8.29, 2], ["auto", 12, 2], ["auto", 24, 3], ["auto", 33, 5], ["auto", 100, 13]];
  for (const [p, m, want] of rows) assert.equal(imageTopazCredits(p as "auto", ...mp(m)), want, `auto ${m} MP`);
  for (const [m, want] of [[2.07, 2], [8.29, 5], [12, 6], [24, 12], [33, 17]] as const) assert.equal(imageTopazCredits("creative", ...mp(m)), want, `creative ${m} MP`);
  for (const [m, want] of [[8.29, 1], [24, 1], [33, 2], [100, 5]] as const) assert.equal(imageTopazCredits("faithful", ...mp(m)), want, `faithful ${m} MP`);
});

test("image output size follows the scale and refuses what is too large", () => {
  assert.deepEqual(imageOutputSize(1000, 500, 2), { ok: true, w: 2000, h: 1000 });
  assert.equal(imageOutputSize(0, 500, 2).ok, false);
  assert.equal(imageOutputSize(9000, 9000, 4).ok, false); // 36000 px side
  assert.equal(imageOutputSize(5000, 5000, 4).ok, false); // 400 MP
  assert.equal(imageOutputSize(100, 100, 3).ok, false);
});

test("the form for each style uses the maker's model names and settings", () => {
  assert.deepEqual(imageFormFields("auto", 4000, 3000), { model: "Wonder 4", output_format: "jpeg", output_width: "4000", output_height: "3000" });
  assert.equal(imageFormFields("faithful", 10, 10).model, "Upscale High Fidelity V3");
  const c = imageFormFields("creative", 10, 10, { creativity: 12 });
  assert.equal(c.model, "Bloom 2"); assert.equal(c.creativity, "9"); assert.equal(c.autoprompt, "true");
});

test("video sizes keep the shape, round to 4 and never shrink", () => {
  assert.deepEqual(videoOutputSize(1280, 720, "1080p"), { ok: true, w: 1920, h: 1080 });
  assert.deepEqual(videoOutputSize(720, 1280, "4k"), { ok: true, w: 2160, h: 3840 });
  assert.equal(videoOutputSize(1920, 1080, "1080p").ok, false);
  assert.equal(videoOutputSize(3840, 2160, "4k").ok, false);
  assert.equal(videoOutputSize(2560, 1080, "4k").ok, false); // 21:9 at 4K passes the 4096 limit
});

test("video credits follow the docs' worked examples", () => {
  // Starlight Precise 2.6: 24 fps, 10 s: 1080p = 10, 4K = 21
  assert.equal(videoTopazCredits("auto", { inW: 1280, inH: 720, outW: 1920, outH: 1080, seconds: 10, fps: 24 }), 10);
  assert.equal(videoTopazCredits("auto", { inW: 1280, inH: 720, outW: 3840, outH: 2160, seconds: 10, fps: 24 }), 21);
  assert.equal(videoTopazCredits("auto", { inW: 1280, inH: 720, outW: 3840, outH: 2160, seconds: 60, fps: 24 }), 121);
  // Astra 2: 30 fps, 10 s, 1080p = 30
  assert.equal(videoTopazCredits("creative", { inW: 1280, inH: 720, outW: 1920, outH: 1080, seconds: 10, fps: 30 }), 30);
  // Proteus: 30 fps 10 s: 720p to 1080p = 3, 1080p to 4K = 5
  assert.equal(videoTopazCredits("faithful", { inW: 1280, inH: 720, outW: 1920, outH: 1080, seconds: 10, fps: 30 }), 3);
  assert.equal(videoTopazCredits("faithful", { inW: 1920, inH: 1080, outW: 3840, outH: 2160, seconds: 10, fps: 30 }), 5);
});

test("the creative clip style passes its creativity, the others only the model", () => {
  assert.deepEqual(videoFilter("auto"), { model: "slp-2.6" });
  assert.deepEqual(videoFilter("faithful"), { model: "prob-4" });
  assert.deepEqual(videoFilter("creative", { creativity: 0.4 }), { model: "ast-2", creativity: 0.4, sharp: 0.5 });
});

test("the feature stays off until the key and the credit price are set", () => {
  const k = process.env.TOPAZ_API_KEY, u = process.env.TOPAZ_CREDIT_USD;
  try {
    delete process.env.TOPAZ_API_KEY; delete process.env.TOPAZ_CREDIT_USD; assert.equal(topazConfigured(), false);
    process.env.TOPAZ_API_KEY = "x"; assert.equal(topazConfigured(), false);
    process.env.TOPAZ_CREDIT_USD = "0.01"; assert.equal(topazConfigured(), true);
    process.env.TOPAZ_CREDIT_USD = "abc"; assert.equal(topazConfigured(), false);
  } finally { if (k === undefined) delete process.env.TOPAZ_API_KEY; else process.env.TOPAZ_API_KEY = k; if (u === undefined) delete process.env.TOPAZ_CREDIT_USD; else process.env.TOPAZ_CREDIT_USD = u; }
});
