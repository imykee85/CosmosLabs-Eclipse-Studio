import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AD_DIRECTOR, CINEMA_CRAFT, wantsAds, wantsCinema } from "../../src/lib/craft-knowledge";

test("the ad director and cinema craft in code match their docs and name no outside service", () => {
  assert.equal(AD_DIRECTOR, readFileSync("docs/prompt-engines/knowledge/ad-creative-director.md", "utf8").trim());
  assert.equal(CINEMA_CRAFT, readFileSync("docs/prompt-engines/knowledge/cinema-craft.md", "utf8").trim());
  for (const t of [AD_DIRECTOR, CINEMA_CRAFT]) assert.ok(!/higgsfield|scenario|marketingskills/i.test(t) && t.includes("suggest_prompt"));
  assert.ok(readFileSync("docs/prompt-engines/knowledge/original/ad-creative/SKILL.md", "utf8").length > 5000 && readFileSync("docs/prompt-engines/knowledge/original/cinema-craft/SKILL.md", "utf8").length > 5000);
});
test("they load only on their own topics", () => {
  assert.equal(wantsAds([{ content: "make me a cute cat picture" }], ""), false);
  assert.equal(wantsAds([{ content: "write five headlines for my TikTok ad" }], ""), true);
  assert.equal(wantsAds([{ content: [{ type: "text", text: "a UGC hook" }] }], ""), true);
  assert.equal(wantsCinema([{ content: "a portrait of my dog" }], ""), false);
  assert.equal(wantsCinema([{ content: "give it a cinematic anamorphic look" }], ""), true);
  assert.equal(wantsCinema([{ content: "hi" }], "Prompt: slow dolly in, color grading"), true);
});

test("Cinema Craft carries the 34 shot types and loads on shot-type talk", () => {
  for (const t of ["Wide:", "Macro:", "Dutch angle", "Worm's-eye view", "Over-the-shoulder", "Inside-the-fridge", "Magnifying glass", "Lens flare", "Foreground occlusion", "Hoop-level"]) assert.ok(CINEMA_CRAFT.includes(t), t);
  assert.ok(wantsCinema([{ role: "user", content: "give me a fisheye close-up and a dutch angle" }] as never, ""));
});
