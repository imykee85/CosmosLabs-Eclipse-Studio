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
