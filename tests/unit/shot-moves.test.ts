import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MOVES, movesToKeys } from "../../src/lib/shot/moves";
import { emptyWorld, makeItem } from "../../src/lib/shot/world";

test("a move becomes camera keys that run the whole shot and aim at the subject", () => {
  const w = emptyWorld();
  const person = makeItem(w, { kind: "person" }, [2, 0, -1]);
  const keys = movesToKeys([person], { ...DEFAULT_MOVES, preset: "orbit-180" }, 8);
  assert.ok(keys.length >= 3);
  assert.equal(keys[0].t, 0);
  assert.ok(Math.abs(keys[keys.length - 1].t - 8) < 0.01);
  for (const k of keys) assert.ok(Math.abs(k.look[0] - 2) < 0.6 && Math.abs(k.look[2] + 1) < 0.6);
});
test("distance and the second move change the keys; a long follow stays inside the key limit", () => {
  const w = emptyWorld(), it = makeItem(w, { kind: "person" }, [0, 0, 0]);
  const near = movesToKeys([it], { ...DEFAULT_MOVES, distance: 2 }, 6), far = movesToKeys([it], { ...DEFAULT_MOVES, distance: 12 }, 6);
  assert.notDeepEqual(near[0].pos, far[0].pos);
  assert.notDeepEqual(movesToKeys([it], { ...DEFAULT_MOVES, preset: "push-in", preset2: "crane-up" }, 6), movesToKeys([it], DEFAULT_MOVES, 6));
  assert.ok(movesToKeys([it], { ...DEFAULT_MOVES, preset: "follow" }, 30).length <= 60);
});
