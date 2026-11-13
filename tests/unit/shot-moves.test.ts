import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MOVES, moveCamAt, movesToKeys } from "../../src/lib/shot/moves";
import { cameraAt, emptyWorld, makeItem, editCamera, cameraOf, setCameraKey, DEFAULT_CAMERA_KEY } from "../../src/lib/shot/world";

test("a move drives the camera by the engine's own maths and never blends keyframes", () => {
  const w = emptyWorld(), person = makeItem(w, { kind: "person" }, [2, 0, -1]);
  const m = { ...DEFAULT_MOVES, preset: "orbit-180" as const };
  const a = moveCamAt([person], m, 10, 0).key, b = moveCamAt([person], m, 10, 4).key, c = moveCamAt([person], m, 10, 8).key;
  assert.notDeepEqual(a.pos, b.pos); assert.notDeepEqual(b.pos, c.pos);
  const w2 = editCamera({ ...w, items: [person] }, cameraOf(w).id, { move: m, keys: movesToKeys([person], m, 10) });
  const via = cameraAt(w2, cameraOf(w2), 4).key;
  assert.deepEqual(via.pos, b.pos);
});
test("editing a keyframe hands the camera back to its keys; shake moves the camera", () => {
  const w = emptyWorld(), cam = cameraOf(w);
  const w2 = editCamera(w, cam.id, { move: DEFAULT_MOVES, keys: [DEFAULT_CAMERA_KEY(0)] });
  assert.ok(cameraOf(w2).move);
  assert.equal(cameraOf(setCameraKey(w2, cam.id, { ...DEFAULT_CAMERA_KEY(2) }).world).move, undefined);
  const still = moveCamAt([], { ...DEFAULT_MOVES, preset: "static" as const }, 8, 3).key.pos, shaky = moveCamAt([], { ...DEFAULT_MOVES, preset: "static" as const, shake: 1 }, 8, 3).key.pos;
  assert.notDeepEqual(still, shaky);
});
