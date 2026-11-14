import { test } from "node:test";
import assert from "node:assert/strict";
import { ATLAS_COMMANDS, commandOf, matchCommands } from "../../src/lib/atlas-commands";

test("a message that starts with a command is recognised, others are not", () => {
  assert.equal(commandOf("/voicelock make my knight speak")?.force, "voiceLock");
  assert.equal(commandOf("  /UGC ad for socks")?.id, "ugc");
  assert.equal(commandOf("please /voicelock"), null);
  assert.equal(commandOf("/nothing"), null);
});
test("typing a slash lists commands and narrows as you type", () => {
  assert.equal(matchCommands("/").length, ATLAS_COMMANDS.length);
  assert.deepEqual(matchCommands("/voi").map((c) => c.id), ["voicelock"]);
  assert.equal(matchCommands("/voicelock hello").length, 0);
  assert.equal(matchCommands("hello").length, 0);
});
test("every command id is unique and forces a skill agent-turn knows", () => {
  assert.equal(new Set(ATLAS_COMMANDS.map((c) => c.id)).size, ATLAS_COMMANDS.length);
  const src = require("node:fs").readFileSync("src/lib/agent-turn.ts", "utf8");
  for (const c of ATLAS_COMMANDS) assert.ok(src.includes(`force.has("${c.force}")`), c.force);
});
