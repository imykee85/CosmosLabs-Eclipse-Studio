import test from "node:test";
import assert from "node:assert/strict";
import { cellPrompts, gridCount, initialState, parseScenes, problem, defaultPerspectives } from "../../src/lib/variations/prompt";

test("grid sizes", () => { assert.equal(gridCount("3x3"), 9); assert.equal(gridCount("1x2"), 2); assert.equal(gridCount("2x4"), 8); });

test("reframe needs exactly one view per cell, one instruction each", () => {
  const s = { ...initialState(), grid: "2x2" as const, perspectives: defaultPerspectives(3) };
  assert.match(problem(s, false), /Choose 4 perspectives/);
  const ok = { ...s, perspectives: defaultPerspectives(4) };
  assert.equal(problem(ok, false), "");
  const p = cellPrompts(ok);
  assert.equal(p.length, 4);
  assert.equal(new Set(p).size, 4);
});

test("storyboard scene count is checked unless Auto is on", () => {
  const s = { ...initialState(), mode: "storyboard" as const, grid: "2x2" as const, auto: false, narrative: "Scene 1: a\nScene 2: b\nScene 3: c" };
  assert.match(problem(s, false), /needs 4 scenes and you wrote 3/);
  assert.deepEqual(parseScenes(s.narrative), ["a", "b", "c"]);
  assert.equal(problem({ ...s, auto: true }, false), "");
  assert.equal(cellPrompts({ ...s, auto: true }).length, 4);
});

test("people mode needs consent; age stays adult; demographics follow the ticks", () => {
  const s = { ...initialState(), mode: "people" as const, grid: "2x2" as const, people: "age" as const };
  assert.match(problem(s, false), /own|agreed/);
  assert.equal(problem(s, true), "");
  for (const p of cellPrompts(s)) assert.match(p, /Adult ages only/);
  const d = { ...s, people: "demographics" as const, ethnicities: ["Japanese", "Korean", "Persian", "Arab"], gender: "both" as const };
  assert.equal(problem(d, true), "");
  assert.match(cellPrompts(d)[0], /male of Japanese/);
});

test("custom needs text and makes distinct cells", () => {
  const s = { ...initialState(), mode: "custom" as const, grid: "2x2" as const };
  assert.match(problem(s, false), /Describe/);
  const c = cellPrompts({ ...s, custom: "this street in spring, summer, autumn and winter" });
  assert.equal(new Set(c).size, 4);
});

import { composeSheet } from "../../src/lib/variations/sheet";
import { crc32, zipStore } from "../../src/lib/zip";
import { pixelsFor, ratioChoices } from "../../src/lib/variations/prompt";
import { inPortsOf, isEditor, makesPicture } from "../../src/lib/canvas-flow";

async function solid(w: number, h: number, rgb: [number, number, number]) {
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer());
}

test("the contact sheet puts every cell in its place and carries no metadata", async () => {
  const sharp = (await import("sharp")).default;
  const imgs = [await solid(200, 100, [255, 0, 0]), await solid(200, 100, [0, 255, 0]), await solid(200, 100, [0, 0, 255]), await solid(200, 100, [255, 255, 0])];
  const sheet = await composeSheet({ images: imgs, cols: 2, rows: 2, gap: 10 });
  assert.equal(sheet.cellW, 200); assert.equal(sheet.cellH, 100);
  assert.equal(sheet.width, 200 * 2 + 10 * 3); assert.equal(sheet.height, 100 * 2 + 10 * 3);
  const { data, info } = await sharp(Buffer.from(sheet.bytes)).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]].map((v) => (v > 128 ? 1 : 0)).join(""); };
  assert.equal(px(60, 50), "100"); // cell 1 red, top left
  assert.equal(px(290, 50), "010"); // cell 2 green, top right
  assert.equal(px(60, 170), "001"); // cell 3 blue, bottom left
  assert.equal(px(290, 170), "110"); // cell 4 yellow, bottom right
  const meta = await sharp(Buffer.from(sheet.bytes)).metadata();
  assert.equal(meta.exif, undefined);
});

test("a sheet with fewer pictures than cells leaves the rest empty, and a bad layout is refused", async () => {
  const one = await composeSheet({ images: [await solid(100, 100, [10, 10, 10]), await solid(100, 100, [20, 20, 20])], cols: 3, rows: 3 });
  assert.ok(one.width > 0);
  const tiny = await solid(10, 10, [0, 0, 0]);
  await assert.rejects(() => composeSheet({ images: [tiny], cols: 0, rows: 1 }));
});

test("zip: a stored archive has the right signatures, names and checksums", () => {
  const a = new TextEncoder().encode("hello"), b = new TextEncoder().encode("world!");
  assert.equal(crc32(a), 0x3610a686);
  const z = zipStore([{ name: "a.txt", data: a }, { name: "b.txt", data: b }]);
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(z.length - 22 + 10, true), 2);
  assert.match(new TextDecoder().decode(z), /a\.txt[\s\S]*hello[\s\S]*b\.txt[\s\S]*world!/);
});

test("pixel sizes and aspect ratio choices", () => {
  assert.equal(pixelsFor("2k", "3:2"), "2048 x 1365");
  assert.equal(pixelsFor("4k", "1:1"), "4096 x 4096");
  assert.equal(pixelsFor("2k", "auto"), "");
  assert.equal(pixelsFor("2k", "auto", { w: 1000, h: 500 }), "2048 x 1024");
  assert.deepEqual(ratioChoices(["1:1", "16:9", "7:3"]), ["auto", "1:1", "16:9"]);
});

test("the Canvas node takes a picture and a text, and gives pictures", () => {
  assert.ok(isEditor("variations") && makesPicture("variations"));
  assert.deepEqual(inPortsOf("variations").map((p) => p.id), ["description", "ingredients"]);
});
