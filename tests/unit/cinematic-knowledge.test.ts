import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CINEMATIC_DIRECTOR, LOCATION_SCOUT, wantsCinematicDirector, wantsLocationScout } from "../../src/lib/cinematic-knowledge";
import { commandOf } from "../../src/lib/atlas-commands";

test("docs equal code", () => {
  assert.equal(CINEMATIC_DIRECTOR, readFileSync("docs/prompt-engines/knowledge/cinematic-director.md", "utf8").trim());
  assert.equal(LOCATION_SCOUT, readFileSync("docs/prompt-engines/knowledge/location-scout.md", "utf8").trim());
});
test("triggers", () => {
  assert.equal(wantsCinematicDirector([{ content: "the skin looks plastic, diagnose this take" }], ""), true);
  assert.equal(wantsCinematicDirector([{ content: "a red car at sunset" }], ""), false);
  assert.equal(wantsLocationScout([{ content: "where could we shoot a diner scene, scout locations" }], ""), true);
  assert.equal(wantsLocationScout([{ content: "a red car at sunset" }], ""), false);
});
test("commands", () => {
  assert.equal(commandOf("/direct a scene")?.force, "cinematicDirector");
  assert.equal(commandOf("/scout lisbon")?.force, "locationScout");
});
