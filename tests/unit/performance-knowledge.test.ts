import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PERFORMANCE_CRAFT, wantsPerformance } from "../../src/lib/performance-knowledge";
import { commandOf } from "../../src/lib/atlas-commands";

test("performance doc equals code", () => {
  assert.equal(PERFORMANCE_CRAFT, readFileSync("docs/prompt-engines/knowledge/performance-craft.md", "utf8").trim());
});
test("triggers on acting talk only", () => {
  assert.equal(wantsPerformance([{ content: "the acting feels stiff and robotic" }], ""), true);
  assert.equal(wantsPerformance([{ content: "a red sports car at sunset" }], ""), false);
});
test("slash command", () => assert.equal(commandOf("/performance a diner scene")?.force, "performance"));
