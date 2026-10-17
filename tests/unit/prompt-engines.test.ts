import test from "node:test";
import assert from "node:assert/strict";
import { PROMPT_ENGINES, engineById } from "../../src/lib/prompt-engines";

test("every prompt engine that is switched on carries its instructions", () => {
  for (const e of PROMPT_ENGINES) if (e.available) assert.ok(e.system.length > 1000, e.id);
});

test("Seedance 2.0 director: on, owner's wording kept, Eclipse's text-only note added", () => {
  const e = engineById("seedance");
  assert.ok(e && e.available && e.forModel === "video");
  assert.match(e.system, /How many separate storyboard parts\/boards\/images do you want in total\?/);
  assert.match(e.system, /Please review all storyboard boards\. Do you confirm these storyboards, or should I revise anything before character design\?/);
  assert.match(e.system, /Please confirm the character sheet prompts\. After your confirmation, I can prepare the Seedance 2\.0 prompts\./);
  assert.match(e.system, /This image is 16:9 widescreen format and contains ONLY Part X\./);
  assert.match(e.system, /Critical lock: Seedance prompts are forbidden until all storyboard and character-prompt approval gates are complete\./);
  assert.match(e.system, /ECLIPSE ENVIRONMENT/);
  assert.ok(!e.system.includes("<!--"));
});
