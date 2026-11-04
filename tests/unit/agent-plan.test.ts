import test from "node:test";
import assert from "node:assert/strict";
import { cleanPlan, cleanSpec, newPlan, MAX_SCENES } from "../../src/lib/agent-plan";
import { buildReply } from "../../src/lib/agent-reply";
import { planAllows } from "../../src/lib/access-table";

const good = { title: "Sneaker ad", hero_prompt: "A sneaker on a wet street at dusk", scenes: ["Close-up of the laces", "The sneaker mid-stride"], video_prompt: "Move through image 1 to 3", duration_seconds: 10, aspect_ratio: "9:16" };

test("a good plan is kept, a plan without a hero, scenes or video is refused", () => {
  const p = cleanPlan(good)!;
  assert.equal(p.scenes.length, 2); assert.equal(p.seconds, 10); assert.equal(p.ratio, "9:16");
  assert.equal(cleanPlan({ ...good, hero_prompt: "" }), null);
  assert.equal(cleanPlan({ ...good, scenes: [] }), null);
  assert.equal(cleanPlan({ ...good, video_prompt: " " }), null);
});

test("scenes are capped, the length and the ratio are made safe", () => {
  const many = cleanPlan({ ...good, scenes: Array.from({ length: 20 }, (_, i) => `scene ${i}`) })!;
  assert.equal(many.scenes.length, MAX_SCENES);
  assert.equal(cleanPlan({ ...good, duration_seconds: 500 })!.seconds, 30);
  assert.equal(cleanPlan({ ...good, duration_seconds: 1 })!.seconds, 4);
  assert.equal(cleanPlan({ ...good, aspect_ratio: "weird" })!.ratio, "16:9");
  assert.equal(cleanPlan({ ...good, duration_seconds: undefined })!.seconds, 8);
});

test("a new plan has the three steps, all waiting, and is ready", () => {
  const p = newPlan(cleanPlan(good)!);
  assert.deepEqual(p.steps.map((s) => s.kind), ["hero", "scenes", "video"]);
  assert.ok(p.steps.every((s) => s.state === "waiting")); assert.equal(p.status, "ready");
});

test("the reply carries the plan from the tool call", () => {
  const r = buildReply([{ type: "tool_use", id: "t", name: "propose_plan", input: good } as never], "tool_use");
  assert.equal(r.plan?.title, "Sneaker ad");
  assert.ok(r.text.length > 0);
});

test("plans are a Scale feature", () => {
  assert.equal(planAllows("scale", "plans"), true);
  for (const p of ["free", "starter", "growth"] as const) assert.equal(planAllows(p, "plans"), false);
});

test("pictures the person gave Atlas are used by number, and only ones that exist", () => {
  const pics = [{ type: "upload" as const, id: "u1" }, { type: "render" as const, id: "r2" }, { type: "upload" as const, id: "u3" }];
  const p = cleanPlan({ ...good, reference_pictures: [2, 1, 2, 9, 0, "x"] }, pics)!;
  assert.deepEqual(p.refs, [{ type: "render", id: "r2" }, { type: "upload", id: "u1" }], "listed order, no repeats, unknown numbers dropped");
  assert.equal(cleanPlan({ ...good }, pics)!.refs, undefined, "none unless Atlas names them");
  assert.equal(cleanPlan({ ...good, reference_pictures: [1, 2, 3, 1] }, [...pics, { type: "upload", id: "u4" }, { type: "upload", id: "u5" }])!.refs!.length, 3);
  assert.equal(newPlan(p).steps[0].label, "Hero image from your 2 pictures");
});
test("a plan from the browser keeps only well-formed references", () => {
  const spec = cleanSpec({ title: "t", hero: "h", scenes: ["a"], video: "v", seconds: 8, ratio: "16:9", refs: [{ type: "upload", id: "u1" }, { type: "bad", id: "x" }, { id: "y" }, { type: "render", id: "r1" }] })!;
  assert.deepEqual(spec.refs, [{ type: "upload", id: "u1" }, { type: "render", id: "r1" }]);
});
