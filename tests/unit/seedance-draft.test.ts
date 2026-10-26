import { test } from "node:test";
import assert from "node:assert/strict";
import { capsFor, findVideoModel, routeIdOf, PICKER_MODELS } from "../../src/lib/video-models";

test("Seedance 2.5 Draft is a 480p entry of Seedance 2.5 and is in the picker", () => {
  const draft = findVideoModel("seedance_2_5_draft")!;
  assert.equal(draft.draftOf, "seedance_2_5");
  assert.equal(routeIdOf(draft), "seedance_2_5", "prices and routes use the model it drafts");
  assert.deepEqual(capsFor(draft, "t2v").qualities, ["480p"]);
  assert.equal(capsFor(draft, "t2v").defaultQuality, "480p");
  assert.ok(capsFor(findVideoModel("seedance_2_5")!, "t2v").qualities.includes("1080p"), "the normal model keeps 1080p");
  assert.ok(PICKER_MODELS.some((m) => m.id === "seedance_2_5_draft"));
});
