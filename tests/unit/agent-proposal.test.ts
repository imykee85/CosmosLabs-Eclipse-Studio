import test from "node:test";
import assert from "node:assert/strict";
import { buildProposal, diffWords, thinkingLines, THINKING_GENERAL } from "../../src/lib/agent-proposal";

test("a new prompt and box settings become one proposal with the old values beside the new", () => {
  const p = buildProposal("studio", { ratio: "4:5", model: "nano_banana_pro", prompt: "A lone motorcycle, low camera" }, [{ kind: "reply" }], { prompt: "A motorcycle", ratio: "1:1", model: "Auto", qty: 1 });
  assert.ok(p);
  assert.equal(p!.prompt, "A lone motorcycle, low camera");
  assert.equal(p!.before, "A motorcycle");
  assert.deepEqual(p!.settings.map((s) => [s.label, s.from, s.to]), [["Aspect ratio", "1:1", "4:5"], ["Model", "Auto", "nano_banana_pro"]]);
  assert.equal((p!.controls as Record<string, unknown>).prompt, undefined); // the prompt travels apart from the settings
});

test("a prompt that came as a button (use this prompt or generate) is folded into the proposal, with its count", () => {
  const p = buildProposal("studio", undefined, [{ kind: "generate", prompt: "Sunrise over the sea", count: 3 }], { prompt: "" });
  assert.equal(p!.prompt, "Sunrise over the sea");
  assert.equal(p!.count, 3);
});

test("nothing to propose gives no card, and unknown or empty settings are ignored", () => {
  assert.equal(buildProposal("studio", {}, [{ kind: "reply" }], { prompt: "x" }), null);
  assert.equal(buildProposal("studio", { bogus: 1 } as never, [], { prompt: "x" }), null);
});

test("a setting that is already the same shows no old value", () => {
  const p = buildProposal("video", { sound: true, duration: 5 }, [], { prompt: "", ratio: "16:9" });
  assert.deepEqual(p!.settings.map((s) => s.to), ["On", "5 s"]);
});

test("the added words are marked and the unchanged ones are not", () => {
  const d = diffWords("A red desert road, lone motorcycle", "A lone motorcycle on a red desert road, low camera, long shadows");
  const added = d.filter((x) => x.added).map((x) => x.text.trim());
  assert.ok(added.some((t) => t.includes("low camera")));
  assert.ok(added.some((t) => t.includes("long shadows")));
  assert.ok(!d.filter((x) => !x.added).map((x) => x.text).join("").includes("shadows"));
  assert.equal(d.map((x) => x.text).join(""), "A lone motorcycle on a red desert road, low camera, long shadows"); // nothing lost
});

test("the thinking lines are the agreed creative list, with more for the studio in use", () => {
  assert.equal(THINKING_GENERAL.length, 7);
  assert.ok(thinkingLines("video").includes("Cutting the sequence"));
  assert.ok(thinkingLines("studio").includes("Picking the palette"));
  assert.deepEqual(thinkingLines("core"), THINKING_GENERAL);
});
