import test from "node:test";
import assert from "node:assert/strict";
import { nearestRatio } from "../../src/lib/auto-ratio";

const ALL = ["1:1", "4:5", "3:4", "2:3", "9:16", "16:9", "3:2", "4:3", "21:9"];

test("auto picks the ratio closest to the reference", () => {
  assert.equal(nearestRatio(1584, 1980, ALL), "4:5");      // the owner's astronaut picture
  assert.equal(nearestRatio(1920, 1080, ALL), "16:9");
  assert.equal(nearestRatio(1080, 1920, ALL), "9:16");
  assert.equal(nearestRatio(1000, 1010, ALL), "1:1");
  assert.equal(nearestRatio(4000, 1500, ALL), "21:9");     // wider than anything offered: the widest
});

test("auto only chooses from what the model offers, and ignores 'auto' itself", () => {
  assert.equal(nearestRatio(1584, 1980, ["16:9", "9:16", "1:1"]), "1:1");
  assert.equal(nearestRatio(3000, 2000, ["auto", "16:9", "1:1"]), "16:9");
  assert.equal(nearestRatio(100, 100, []), null);
  assert.equal(nearestRatio(0, 100, ALL), null);
});
