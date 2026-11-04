import test from "node:test";
import assert from "node:assert/strict";
import { cameraPrompt, DEFAULT_CAM, elevationWords, azimuthWords, moveCams, startCams, wrap360, clampVertical, FEATURE_NAME } from "../../src/lib/camera/prompt";

test("angles wrap and clamp", () => {
  assert.equal(wrap360(360), 0); assert.equal(wrap360(-10), 350); assert.equal(wrap360(359), 359);
  assert.equal(clampVertical(-90), -60); assert.equal(clampVertical(120), 80);
  assert.equal(Math.min(Math.abs(359 - 0), 360 - 359), 1); // 359 and 0 are neighbours
  assert.equal(azimuthWords(359), azimuthWords(0));
});

test("angles become words", () => {
  assert.match(azimuthWords(180), /back view/);
  assert.match(azimuthWords(90), /side profile.*right/);
  assert.match(azimuthWords(270), /left/);
  assert.match(elevationWords(-30), /low angle/);
  assert.match(elevationWords(0), /eye-level/);
  assert.match(elevationWords(35), /high angle/);
  assert.match(elevationWords(75), /top-down/);
});

test("the prompt is fixed for fixed inputs and always keeps everything else identical", () => {
  const p = cameraPrompt({ rotate: 175, vertical: -30, zoom: "initial" });
  assert.equal(p, cameraPrompt({ rotate: 175, vertical: -30, zoom: "initial" }));
  assert.match(p, /back view/); assert.match(p, /low angle/); assert.match(p, /175 degrees/); assert.match(p, /exactly the same as image 1/);
  assert.match(cameraPrompt({ rotate: 309, vertical: 35, zoom: "closer" }, "keep the sunglasses on"), /close-up[\s\S]*sunglasses/);
  assert.equal(FEATURE_NAME, "Change Camera");
});

test("cameras spread round the ring and move together when locked", () => {
  const cams = startCams(4);
  assert.deepEqual(cams.map((c) => c.rotate), [45, 135, 225, 315]);
  const moved = moveCams(cams, 0, { ...cams[0], rotate: 65, vertical: 10 }, true);
  assert.deepEqual(moved.map((c) => c.rotate), [65, 155, 245, 335]);
  assert.ok(moved.every((c) => c.vertical === 10));
  const alone = moveCams(cams, 1, { ...cams[1], rotate: 100 }, false);
  assert.deepEqual(alone.map((c) => c.rotate), [45, 100, 225, 315]);
  assert.equal(startCams(1)[0].rotate, DEFAULT_CAM.rotate);
  assert.equal(startCams(9).length, 4);
});

test("the quick chips set sensible numbers", async () => {
  const { PRESETS, cleanCam } = await import("../../src/lib/camera/prompt");
  const get = (id: string) => PRESETS.find((p) => p.id === id)!.patch;
  assert.deepEqual(cleanCam({ ...DEFAULT_CAM, ...get("back") }).rotate, 180);
  assert.equal(cleanCam({ ...DEFAULT_CAM, ...get("low") }).vertical, -30);
  assert.equal(cleanCam({ ...DEFAULT_CAM, ...get("wide") }).zoom, "far");
  assert.equal(cleanCam({ ...DEFAULT_CAM, ...get("close") }).zoom, "closer");
});
