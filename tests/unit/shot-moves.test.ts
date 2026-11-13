import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MOVES, moveCamAt } from "../../src/lib/shot/moves";
import { cameraAt, emptyWorld, makeItem, editCamera, cameraOf, setCameraKey, DEFAULT_CAMERA_KEY } from "../../src/lib/shot/world";

test("a move drives the camera by the engine's own maths and never blends keyframes", () => {
  const w = emptyWorld(), person = makeItem(w, { kind: "person" }, [2, 0, -1]);
  const m = { ...DEFAULT_MOVES, preset: "orbit-180" as const };
  const a = moveCamAt([person], m, 10, 0).key, b = moveCamAt([person], m, 10, 4).key, c = moveCamAt([person], m, 10, 8).key;
  assert.notDeepEqual(a.pos, b.pos); assert.notDeepEqual(b.pos, c.pos);
  const w2 = editCamera({ ...w, items: [person] }, cameraOf(w).id, { move: m, useMove: true });
  const via = cameraAt(w2, cameraOf(w2), 4).key;
  assert.deepEqual(via.pos, b.pos);
});
test("Moves and Keyframes are separate: neither changes the other", () => {
  const w = emptyWorld(), cam = cameraOf(w);
  const keysBefore = JSON.stringify(cam.keys);
  const w2 = editCamera(w, cam.id, { move: { ...DEFAULT_MOVES, preset: "orbit-360" }, useMove: true });
  assert.equal(JSON.stringify(cameraOf(w2).keys), keysBefore); // choosing a move leaves the keyframes alone
  const w3 = setCameraKey(w2, cam.id, { ...DEFAULT_CAMERA_KEY(2), lensMm: 85 }).world;
  assert.equal(cameraOf(w3).move?.preset, "orbit-360"); assert.equal(cameraOf(w3).useMove, true); // keyframe edits leave the move alone
  const w4 = editCamera(w3, cam.id, { useMove: false });
  assert.equal(cameraAt(w4, cameraOf(w4), 2).key.lensMm, 85); // back on Keyframes the camera follows its own keys
  const still = moveCamAt([], { ...DEFAULT_MOVES, preset: "static" as const }, 8, 3).key.pos, shaky = moveCamAt([], { ...DEFAULT_MOVES, preset: "static" as const, shake: 1 }, 8, 3).key.pos;
  assert.notDeepEqual(still, shaky);
});
