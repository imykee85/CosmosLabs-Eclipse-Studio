import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEEDANCE_DIRECTOR, seedanceKnowledge, wantsSeedance } from "../../src/lib/seedance-knowledge";

test("the director in code matches its docs", () => {
  assert.equal(SEEDANCE_DIRECTOR, readFileSync("docs/prompt-engines/knowledge/seedance-director.md", "utf8").trim());
  assert.ok(readFileSync("docs/prompt-engines/knowledge/original/seedance-2-character-sheet-update.txt", "utf8").includes("CHARACTER SHEET IMAGE PROMPTS"));
});

test("each host gets its own delivery rules and not the other's", () => {
  const prompts = seedanceKnowledge("prompts");
  const atlas = seedanceKnowledge("atlas");
  assert.ok(prompts.includes("YOUR DELIVERY RULES (Seedance 2.5 tab of the Prompts page)") && !prompts.includes("YOUR DELIVERY RULES (Atlas, Seedance 2.5 director)"));
  assert.ok(atlas.includes("YOUR DELIVERY RULES (Atlas, Seedance 2.5 director)") && atlas.includes("suggest_prompt") && !atlas.includes("fenced code block"));
  for (const k of [prompts, atlas]) assert.ok(k.startsWith("SEEDANCE 2.5 STORYBOARD DIRECTOR") && k.includes("4 to 30 seconds") && !k.includes("\ufeff"));
});

test("Atlas carries the director only when the talk is about Seedance or a storyboard", () => {
  assert.equal(wantsSeedance([{ content: "make me a cute cat picture" }], "Model: Nano Banana Pro"), false);
  assert.equal(wantsSeedance([{ content: "help me with a Seedance storyboard" }], ""), true);
  assert.equal(wantsSeedance([{ content: [{ type: "text", text: "Part 2 storyboard please" }] }], ""), true);
  assert.equal(wantsSeedance([{ content: "hi" }], "Model: Seedance 2.5"), true);
  assert.equal(wantsSeedance([{ content: [{ type: "image" }] }], ""), false);
});
