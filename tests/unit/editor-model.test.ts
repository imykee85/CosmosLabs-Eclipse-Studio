import { test } from "node:test";
import assert from "node:assert/strict";
import { activeVisual, clipDur, duplicateClip, fadeFactor, layout, newClip, reorderVisual, sizeFor, splitAt, totalDur, trimEnd, trimStart, emptyProject, type Project } from "../../src/lib/editor/model";

const base = (): Project => {
  const a = { ...newClip("video", "a", "A", 10), id: "a", out: 4 };
  const b = { ...newClip("video", "b", "B", 10), id: "b", out: 6 };
  const m = { ...newClip("audio", "m", "M", 20), id: "m", start: 2 };
  return { ...emptyProject(), clips: [a, b, m] };
};

test("visual clips play one after another, sound keeps its place", () => {
  const l = layout(base());
  assert.equal(l.clips[0].start, 0); assert.equal(l.clips[1].start, 4); assert.equal(l.clips[2].start, 2);
  assert.equal(totalDur(base()), 22);
});
test("active clip and source time respect trim and speed", () => {
  const p = base(); p.clips[1] = { ...p.clips[1], in: 2, speed: 2 };
  const a = activeVisual(p, 5)!;
  assert.equal(a.clip.id, "b"); assert.equal(a.src, 4);
});
test("split cuts in two and keeps total length", () => {
  const p = splitAt(base(), "a", 1.5);
  assert.equal(p.clips.length, 4);
  assert.equal(p.clips[0].out, 1.5); assert.equal(p.clips[1].in, 1.5);
  assert.equal(totalDur(p), totalDur(base()));
  assert.equal(splitAt(base(), "a", 0.05).clips.length, 3);
});
test("reorder moves a clip by where it is dropped", () => {
  const p = reorderVisual(base(), "b", 0.5);
  assert.deepEqual(p.clips.filter((c) => c.kind !== "audio").map((c) => c.id), ["b", "a"]);
});
test("trim never goes past the source or below the minimum", () => {
  const c = base().clips[0];
  assert.equal(trimEnd(c, 100).out, 10);
  assert.ok(trimEnd(c, -100).out >= 0.2);
  assert.equal(trimStart(c, 100).in < c.out, true);
  const m = base().clips[2]; assert.equal(trimStart(m, 1).start, 3);
});
test("fades ramp and duplicate keeps the sound after the original", () => {
  const c = { ...base().clips[0], fadeIn: 1, fadeOut: 1 };
  assert.equal(fadeFactor(c, 0), 0); assert.equal(fadeFactor(c, 2), 1); assert.equal(fadeFactor(c, clipDur(c)), 0);
  const p = duplicateClip(base(), "m"); assert.equal(p.clips[3].start, 22);
});
test("export sizes follow the aspect ratio", () => {
  assert.deepEqual(sizeFor("16:9"), { w: 1280, h: 720 });
  assert.deepEqual(sizeFor("9:16"), { w: 720, h: 1280 });
  assert.deepEqual(sizeFor("1:1"), { w: 720, h: 720 });
});
