import test from "node:test";
import assert from "node:assert/strict";
import { actorAt, cameraAt, fovDeg, shakeAt, vehicleAt } from "../../src/lib/shot/engine";
import { parseScene, sceneSchema } from "../../src/lib/shot/schema";
import { TESTS, t3, t4, t5 } from "../../src/lib/shot/scenes";

test("every Phase 0 test scene is valid and round-trips", () => {
  for (const s of TESTS) { const r = parseScene(JSON.parse(JSON.stringify(s))); assert.ok(r.success, s.id + " " + (r.success ? "" : r.error.message)); }
});
test("a repeated colour or a bad time range is refused", () => {
  const dup = { ...t5, actors: t5.actors.map((a) => ({ ...a, color: "red" as const })) };
  assert.equal(sceneSchema.safeParse(dup).success, false);
  assert.equal(sceneSchema.safeParse({ ...t3, shots: [{ ...t3.shots[0], endS: 99 }] }).success, false);
});
test("field of view follows the lens and the sensor", () => {
  assert.ok(Math.abs(fovDeg(50, "FF", "16:9") - 22.9) < 0.2); // 36 mm wide, 16:9 crop
  assert.ok(fovDeg(15, "FF", "16:9") > fovDeg(35, "FF", "16:9"));
});
test("shake is seeded: same seed, same wobble; different seed, different", () => {
  assert.deepEqual(shakeAt(5, 2, 1.37), shakeAt(5, 2, 1.37));
  assert.notDeepEqual(shakeAt(5, 2, 1.37), shakeAt(6, 2, 1.37));
});
test("the same frame is identical every time, and the camera has no jump at a key", () => {
  const c = t5.cameras[0], a = cameraAt(t5, c, 3.3, "16:9"), b = cameraAt(t5, c, 3.3, "16:9");
  assert.deepEqual(a, b);
  const before = cameraAt(t5, { ...c, shake: { ...c.shake, amount: 0 } }, 4.999, "16:9"), after = cameraAt(t5, { ...c, shake: { ...c.shake, amount: 0 } }, 5.001, "16:9");
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(before.pos[i] - after.pos[i]) < 0.02);
});
test("a walking actor moves between marks, poses change on their action keys", () => {
  const w = t3.actors[0], p0 = actorAt(t3, w, 0), p8 = actorAt(t3, w, 8);
  assert.ok(p8.pos[2] > p0.pos[2] + 9);
  const red = t5.actors[0];
  assert.equal(actorAt(t5, red, 1).pose, "squatting"); assert.equal(actorAt(t5, red, 7).pose, "standing");
});
test("drivers ride with their vehicle", () => {
  const d = t4.actors[0], v = t4.vehicles[0];
  const a = actorAt(t4, d, 10), c = vehicleAt(v, 10);
  assert.ok(Math.hypot(a.pos[0] - c.pos[0], a.pos[2] - c.pos[2]) < 1.5);
  assert.equal(a.pose, "driving");
});

import { readFileSync, mkdirSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { SHOT_BUNDLE } from "../../src/lib/shot/render-bundle.generated";
import { RENDER_MJS, guideSize } from "../../src/lib/shot/render-script";

test("guide sizes: short side is the resolution, both sides even", () => {
  assert.deepEqual(guideSize("16:9", 720), { w: 1280, h: 720 });
  assert.deepEqual(guideSize("9:16", 480), { w: 480, h: 854 });
  assert.deepEqual(guideSize("1:1", 480), { w: 480, h: 480 });
});
test("the committed render bundle matches the page code", async () => {
  const { build } = await import("esbuild");
  const r = await build({ entryPoints: ["src/lib/shot/render-page.ts"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none" });
  assert.equal(r.outputFiles[0].text, SHOT_BUNDLE, "run: npm run shot:bundle");
});
test("the render script makes a real video from a scene (same video twice)", { skip: !existsSync("/opt/pw-browsers/chromium-1243/chrome-linux64/chrome") }, () => {
  const dir = path.join(tmpdir(), "shot-script-test"); mkdirSync(dir, { recursive: true });
  try { symlinkSync(path.resolve("node_modules"), path.join(dir, "node_modules")); } catch { /* exists */ }
  const scene = { ...t5, durationS: 1, shots: [{ ...t5.shots[0], endS: 1 }] };
  writeFileSync(path.join(dir, "scene.json"), JSON.stringify(scene)); writeFileSync(path.join(dir, "bundle.js"), SHOT_BUNDLE); writeFileSync(path.join(dir, "render.mjs"), RENDER_MJS);
  const ff = path.dirname(path.resolve("node_modules/@ffmpeg-installer/linux-x64/ffmpeg")), env = { ...process.env, SHOT_CHROME: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", PATH: `${ff}:${process.env.PATH}` };
  const sums: string[] = [];
  for (let i = 0; i < 2; i++) {
    const r = spawnSync("node", ["render.mjs", "scene.json", `out${i}.mp4`, "480"], { cwd: dir, env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    sums.push(readFileSync(path.join(dir, `out${i}.mp4`)).toString("base64"));
  }
  assert.equal(sums[0], sums[1]);
  assert.ok(sums[0].length > 1000);
});
