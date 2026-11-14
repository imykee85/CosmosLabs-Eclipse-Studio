import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Atlas can see the ShotMap scene: the outline in words and a small snapshot ride with each message, and the server only accepts a small jpeg.
test("the agent turn reads the scene outline and a checked jpeg snapshot", () => {
  const src = readFileSync("src/lib/agent-turn.ts", "utf8");
  assert.match(src, /The 3D scene, in words/);
  assert.match(src, /data:image\\\/jpeg;base64/);
  assert.match(src, /< 400_000/);
});
test("ShotMap sends the outline and the snapshot as part of Atlas's context", () => {
  const src = readFileSync("src/components/shot/studio/ShotStudio.tsx", "utf8");
  assert.match(src, /sceneOutline: describeScene\(w, t\)/);
  assert.match(src, /sceneImage: snapshot\(\)/);
});
