import test from "node:test";
import assert from "node:assert/strict";
import { composeRetouch } from "../../src/lib/edit/composite";
import { wandSelect } from "../../src/lib/edit/wand";
import { openaiMask } from "../../src/lib/edit/mask";
import { openaiRequest } from "../../src/lib/providers/openai";
import { promptEdit, visualEdit, retouchEdit, problem } from "../../src/lib/edit/prompt";

async function solid(w: number, h: number, c: [number, number, number], fmt: "png" | "jpeg" = "png") {
  const sharp = (await import("sharp")).default;
  const s = sharp({ create: { width: w, height: h, channels: 3, background: { r: c[0], g: c[1], b: c[2] } } });
  return new Uint8Array(await (fmt === "png" ? s.png() : s.jpeg({ quality: 100 })).toBuffer());
}
// a transparent picture with an opaque square: the selection
async function squareMask(w: number, h: number, x: number, y: number, s: number) {
  const sharp = (await import("sharp")).default;
  const sq = await sharp({ create: { width: s, height: s, channels: 4, background: { r: 59, g: 130, b: 246, alpha: 1 } } }).png().toBuffer();
  return new Uint8Array(await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: sq, left: x, top: y }]).png().toBuffer());
}

test("retouch: outside the selection the picture is pixel-identical, inside it is the new result", async () => {
  const sharp = (await import("sharp")).default;
  const original = await solid(200, 200, [200, 30, 30]);
  const result = await solid(200, 200, [10, 20, 220]);
  const mask = await squareMask(200, 200, 80, 80, 40);
  const out = await composeRetouch({ original, result, mask, dilate: 2, feather: 1 });
  assert.equal(out.width, 200); assert.equal(out.height, 200);
  const { data, info } = await sharp(Buffer.from(out.bytes)).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
  assert.deepEqual(px(100, 100), [10, 20, 220]); // inside: the result
  assert.deepEqual(px(5, 5), [200, 30, 30]); // far outside: the original, exactly
  assert.deepEqual(px(190, 100), [200, 30, 30]);
  assert.deepEqual(px(100, 60), [200, 30, 30]); // 20 px above the square
  let changed = 0;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) { const [r] = px(x, y); if (r !== 200) changed++; }
  assert.ok(changed >= 40 * 40 && changed < 60 * 60, `changed pixels ${changed}`); // the square plus a thin soft edge, nothing else
});

test("retouch: a result of another size is fitted, and the mask can be a different size too", async () => {
  const out = await composeRetouch({ original: await solid(300, 200, [1, 2, 3], "jpeg"), result: await solid(150, 100, [9, 9, 9]), mask: await squareMask(30, 20, 0, 0, 10) });
  assert.equal(out.width, 300); assert.equal(out.height, 200);
});

test("click select grows over a flat area and stops at an edge", () => {
  const w = 10, h = 10, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const left = x < 5; px[o] = left ? 200 : 20; px[o + 1] = left ? 200 : 20; px[o + 2] = left ? 200 : 20; px[o + 3] = 255; }
  const m = wandSelect(px, w, h, 2, 2, 20);
  assert.equal(m[0], 1); assert.equal(m[4], 1);
  assert.equal(m[5], 0); assert.equal(m[9 * w + 9], 0);
});

test("prompts keep what must not change, and number the pins", () => {
  assert.match(promptEdit("change the time of day to night"), /Change only what is asked/);
  assert.match(promptEdit("change the seat", 1), /second picture is a reference/);
  const v = visualEdit([{ x: 0.42, y: 0.61, text: "body yellow" }, { x: 0.1, y: 0.9, text: "" }, { x: 0.8, y: 0.2, text: "seats black" }]);
  assert.match(v, /1\. At the point 42% from the left and 61% from the top: body yellow\./);
  assert.match(v, /2\. At the point 80%/);
  assert.match(retouchEdit("erase", ""), /Remove everything inside the blue area/);
  assert.match(retouchEdit("replace", "black glass"), /Inside the blue area: black glass\./);
});

test("what blocks Generate", () => {
  assert.match(problem("prompt", " ", [], false), /Write what/);
  assert.match(problem("visual", "", [{ x: 0, y: 0, text: "" }], false), /Click on the picture/);
  assert.match(problem("erase", "", [], false), /Draw a selection to erase/);
  assert.match(problem("replace", "", [], true), /Describe what should replace/);
  assert.equal(problem("replace", "black", [], true), "");
});


test("OpenAI mask: transparent where the person selected, opaque elsewhere, the picture's own size", async () => {
  const sharp = (await import("sharp")).default;
  const picture = await solid(400, 300, [10, 10, 10]);
  const selection = await squareMask(100, 75, 25, 20, 20); // a small selection picture, a quarter of the size
  const mask = await openaiMask(selection, picture);
  const meta = await sharp(Buffer.from(mask)).metadata();
  assert.equal(meta.width, 400); assert.equal(meta.height, 300); assert.equal(meta.format, "png"); assert.equal(meta.hasAlpha, true);
  const { data, info } = await sharp(Buffer.from(mask)).raw().toBuffer({ resolveWithObject: true });
  const a = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
  assert.equal(a(140, 110), 0); // inside the selection (25..45 x 20..40 at a quarter scale = 100..180 x 80..160): editable
  assert.equal(a(10, 10), 255); // outside: kept
  assert.equal(a(390, 290), 255);
});

test("the OpenAI edit request carries the mask next to the pictures", () => {
  const png = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };
  const withMask = openaiRequest({ apiModel: "gpt-image-2", prompt: "x", references: [png], mask: { bytes: new Uint8Array([9, 9]), contentType: "image/png" }, aspectRatio: "1:1", sizing: "custom16", resolution: "1k" });
  assert.equal(withMask.path, "/images/edits");
  assert.equal((withMask.body.images as { image_url: string }[]).length, 1);
  assert.match((withMask.body.mask as { image_url: string }).image_url, /^data:image\/png;base64,/);
  const without = openaiRequest({ apiModel: "gpt-image-2", prompt: "x", references: [png], aspectRatio: "1:1", sizing: "custom16", resolution: "1k" });
  assert.equal("mask" in without.body, false);
});
