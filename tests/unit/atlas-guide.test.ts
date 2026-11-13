import test from "node:test";
import assert from "node:assert/strict";
import { findModels, featureGuide, runGuideTool, SCREEN_GUIDES } from "../../src/lib/atlas-guide";

test("Seedance 2.5 lookup carries real registry facts and notes", () => {
  const r = runGuideTool({ topic: "Seedance 2.5" });
  assert.ok(!r.isError);
  assert.match(r.content, /4 to 30 s/);
  assert.match(r.content, /30 pictures/);
  assert.match(r.content, /Limits:/);
});
test("other model families are found by name", () => {
  assert.ok(findModels("kling 3.0 pro").length > 0);
  assert.ok(findModels("eleven v4").length > 0);
  assert.ok(findModels("hyper3d").length > 0);
});
test("features and screens resolve; unknown topics error", () => {
  assert.ok(featureGuide("Video Studio"));
  assert.ok(featureGuide("ShotMap"));
  assert.ok(runGuideTool({ topic: "zzzz nothing" }).isError);
  assert.ok(runGuideTool({}).isError);
});
test("every Atlas screen has a guide", () => {
  for (const k of ["create", "video", "voice", "design", "core", "treatment", "canvas"]) assert.ok(SCREEN_GUIDES[k], k);
});
