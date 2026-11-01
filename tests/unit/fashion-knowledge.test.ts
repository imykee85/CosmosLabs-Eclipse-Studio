import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FASHION_DIRECTOR, wantsFashion } from "../../src/lib/fashion-knowledge";

test("the fashion director in code matches its doc, keeps the owner's parts and names no outside service", () => {
  assert.equal(FASHION_DIRECTOR, readFileSync("docs/prompt-engines/knowledge/fashion-campaign-director.md", "utf8").trim());
  for (const part of ["PART 1 — THE SKILL", "PART 2 — VISUAL LANGUAGE", "PART 3 — WORKED EXAMPLE", "Find the controlling idea", "Salt Court", "No text, logos or watermarks.", "YOUR DELIVERY RULES (Atlas, Fashion Campaign Director)", "suggest_prompt"]) {
    assert.ok(FASHION_DIRECTOR.includes(part), part);
  }
  assert.ok(!/higgsfield/i.test(FASHION_DIRECTOR) && !FASHION_DIRECTOR.includes("references/visual-language.md") && !FASHION_DIRECTOR.startsWith("---"));
});

test("the owner's original files are kept unchanged beside it", () => {
  for (const f of ["SKILL.md", "references/visual-language.md", "references/example-campaign.md"]) {
    assert.ok(readFileSync(`docs/prompt-engines/knowledge/original/fashion-campaign-director/${f}`, "utf8").length > 1000, f);
  }
});

test("Atlas carries the fashion director only when the talk is about fashion", () => {
  assert.equal(wantsFashion([{ content: "make me a cute cat picture" }], "Model: Nano Banana Pro"), false);
  assert.equal(wantsFashion([{ content: "rooftop in Lisbon, two models, a fashion campaign" }], ""), true);
  assert.equal(wantsFashion([{ content: [{ type: "text", text: "build me a lookbook" }] }], ""), true);
  assert.equal(wantsFashion([{ content: "hi" }], "Prompt: editorial shoot on a salt flat"), true);
  assert.equal(wantsFashion([{ content: [{ type: "image" }] }], ""), false);
});
