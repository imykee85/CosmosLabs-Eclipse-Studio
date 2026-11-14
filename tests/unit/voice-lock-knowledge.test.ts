import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VOICE_LOCK_CRAFT, wantsVoiceLock } from "../../src/lib/voice-lock-knowledge";

test("Character Voice Lock in code matches its doc, uses Eclipse names and has the rules and templates", () => {
  assert.equal(VOICE_LOCK_CRAFT, readFileSync("docs/prompt-engines/knowledge/character-voice-lock.md", "utf8").trim());
  assert.ok(!/@Image|@Audio|dreamina|higgsfield/i.test(VOICE_LOCK_CRAFT));
  for (const t of ["NEVER recreate a real, identifiable person's voice", "never a shot", "2 to 3 times", "C2.", "E. TWO CHARACTERS", "suggest_prompt"]) assert.ok(VOICE_LOCK_CRAFT.includes(t), t);
});
test("it loads only on voice-lock talk", () => {
  assert.equal(wantsVoiceLock([{ content: "make a picture of a cat" }], ""), false);
  assert.equal(wantsVoiceLock([{ content: "my character's voice keeps changing between shots" }], ""), true);
  assert.equal(wantsVoiceLock([{ content: "I want to lock the character voice" }], ""), true);
  assert.equal(wantsVoiceLock([{ content: [{ type: "text", text: "the voice drifts and the accent slips" }] }], ""), true);
});

import { wantsVoiceLockOn } from "../../src/lib/voice-lock-knowledge";
test("in Audio Studio a character or video mention brings the method in", () => {
  assert.equal(wantsVoiceLockOn([{ content: "voice for my character in a Seedance video" }], "", "voice"), true);
  assert.equal(wantsVoiceLockOn([{ content: "read this ad script warmly" }], "", "voice"), false);
  assert.equal(wantsVoiceLockOn([{ content: "my character" }], "", "create"), false);
});
