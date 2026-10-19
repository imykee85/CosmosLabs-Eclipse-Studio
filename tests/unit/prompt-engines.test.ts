import test from "node:test";
import assert from "node:assert/strict";
import { PROMPT_ENGINES, engineById } from "../../src/lib/prompt-engines";

test("every prompt engine that is switched on carries its instructions", () => {
  for (const e of PROMPT_ENGINES) if (e.available) assert.ok(e.system.length > 1000, e.id);
});

test("Seedance 2.5 director: on, owner's instructions, knowledge and character sheet rules, Eclipse delivery rules", () => {
  const e = engineById("seedance");
  assert.ok(e && e.available && e.forModel === "video" && e.name === "Seedance 2.5");
  assert.match(e.system, /How many separate storyboard parts\/boards do you want in total\?/);
  assert.match(e.system, /Please review all storyboard boards\. Do you confirm these storyboards, or should I revise anything before character design\?/);
  assert.match(e.system, /Please confirm the character sheet prompts\. After your confirmation, I can prepare the Seedance 2\.5 prompts\./);
  assert.match(e.system, /This image is 16:9 widescreen format and contains ONLY Part X\./);
  assert.match(e.system, /Critical lock: Seedance prompts are forbidden until all storyboard and character-prompt approval gates are complete\./);
  assert.match(e.system, /Question 10[\s\S]*level of detail/);
  assert.match(e.system, /PART 3 — CHARACTER SHEET PROMPT UPDATE[\s\S]*Character Identity Summary/);
  assert.match(e.system, /YOUR DELIVERY RULES \(Seedance 2\.5 tab of the Prompts page\)/);
  assert.ok(!/Seedance 2\.0|custom GPT instructions|SD2/i.test(e.system.replace(/Eclipse version of the owner's "Seedance 2\.0[^\n]*/, "")));
  assert.ok(!e.system.includes("<!--"));
});

test("Kling is renamed Kling 4 UGC, rules unchanged", () => {
  const e = engineById("kling");
  assert.ok(e && e.name === "Kling 4 UGC" && /Kling 4/.test(e.system) && !/Kling 3/.test(e.system));
});
