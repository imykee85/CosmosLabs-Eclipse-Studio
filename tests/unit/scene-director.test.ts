import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCENE_DIRECTOR, wantsSceneDirector } from "../../src/lib/scene-director-knowledge";

test("the Scene Director in code matches its document", () => {
  const doc = readFileSync(join(process.cwd(), "docs/prompt-engines/knowledge/scene-director.md"), "utf8").trim();
  assert.ok(SCENE_DIRECTOR.startsWith(doc), "the code copy must start with the document; edit both");
  assert.ok(SCENE_DIRECTOR.includes("ATLAS DELIVERY"), "Atlas delivery rules are present");
});

test("the director is carried for media or talk about shots, not for other chat", () => {
  const plain = [{ content: "what should I name my bakery" }];
  assert.equal(wantsSceneDirector(plain, false), false);
  assert.equal(wantsSceneDirector(plain, true), true, "an attached picture or clip always brings it");
  assert.equal(wantsSceneDirector([{ content: "break down this shot" }], false), true);
  assert.equal(wantsSceneDirector([{ content: [{ type: "text", text: "camera angle for the scene?" }] }], false), true);
});
