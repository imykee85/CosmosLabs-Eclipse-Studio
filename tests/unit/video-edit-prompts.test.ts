import { test } from "node:test";
import assert from "node:assert/strict";
import fixtures from "../fixtures/video-edit-prompts.json";
import { buildEditPrompt, EditPromptError, editRunParams, findPreset, PRESETS } from "../../src/lib/video-edit/prompts";

// The expected prompts were produced by the original scenario-alter script (alter_prompt.py) on the same inputs.
test("golden: the same prompt text as the tested script for each sample preset", () => {
  for (const c of fixtures) {
    const out = buildEditPrompt({ preset: c.preset, who: c.who, values: c.values as unknown as Record<string, string>, extra: c.extra, imageCount: c.images });
    assert.equal(out.prompt, c.expected, c.preset);
  }
});

test("every preset has a mode, a change line and a check mode", () => {
  assert.equal(PRESETS.length, 36);
  for (const p of PRESETS) {
    assert.ok(["O", "M", "R"].includes(p.mode), p.name);
    assert.ok(p.change.length > 0, p.name);
    assert.ok(["swap", "recast", "motion", "restyle"].includes(p.check), p.name);
  }
});

test("a missing slot is an error that names the slot", () => {
  assert.throws(() => buildEditPrompt({ preset: "product-swap", who: "the man" }), (e: unknown) => e instanceof EditPromptError && /object|product/.test(e.problems.join(" ")));
});

test("a restyle that asks to keep the light or everything is refused", () => {
  assert.throws(() => buildEditPrompt({ preset: "anime", who: "the man", extra: "keep the lighting the same" }), EditPromptError);
});

test("a prompt that names @image1 with no picture is refused", () => {
  assert.ok(findPreset("product-swap"));
  assert.throws(() => buildEditPrompt({ preset: "product-swap", who: "the man", values: { object: "cup", product: "can" }, imageCount: 0 }), EditPromptError);
});

test("run parameters: source as the only reference video, draft at 480p, no new sound by default", () => {
  const params = editRunParams({ prompt: "p", sourceVideoId: "v1", imageIds: ["i1"], resolution: "480p", newAudio: false });
  assert.deepEqual(params, { prompt: "p", referenceVideos: ["v1"], referenceImages: ["i1"], duration: -1, generateAudio: false, draft: true });
  const final = editRunParams({ prompt: "p", sourceVideoId: "v1", imageIds: [], resolution: "1080p", newAudio: true });
  assert.deepEqual(final, { prompt: "p", referenceVideos: ["v1"], duration: -1, generateAudio: true, resolution: "1080p" });
});
