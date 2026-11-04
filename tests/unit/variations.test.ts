import test from "node:test";
import assert from "node:assert/strict";
import { cellPrompts, gridCount, initialState, parseScenes, problem, defaultPerspectives } from "../../src/lib/variations/prompt";

test("grid sizes", () => { assert.equal(gridCount("3x3"), 9); assert.equal(gridCount("1x2"), 2); assert.equal(gridCount("2x4"), 8); });

test("reframe needs exactly one view per cell, one instruction each", () => {
  const s = { ...initialState(), grid: "2x2" as const, perspectives: defaultPerspectives(3) };
  assert.match(problem(s, false), /Choose 4 perspectives/);
  const ok = { ...s, perspectives: defaultPerspectives(4) };
  assert.equal(problem(ok, false), "");
  const p = cellPrompts(ok);
  assert.equal(p.length, 4);
  assert.equal(new Set(p).size, 4);
});

test("storyboard scene count is checked unless Auto is on", () => {
  const s = { ...initialState(), mode: "storyboard" as const, grid: "2x2" as const, auto: false, narrative: "Scene 1: a\nScene 2: b\nScene 3: c" };
  assert.match(problem(s, false), /needs 4 scenes and you wrote 3/);
  assert.deepEqual(parseScenes(s.narrative), ["a", "b", "c"]);
  assert.equal(problem({ ...s, auto: true }, false), "");
  assert.equal(cellPrompts({ ...s, auto: true }).length, 4);
});

test("people mode needs consent; age stays adult; demographics follow the ticks", () => {
  const s = { ...initialState(), mode: "people" as const, grid: "2x2" as const, people: "age" as const };
  assert.match(problem(s, false), /own|agreed/);
  assert.equal(problem(s, true), "");
  for (const p of cellPrompts(s)) assert.match(p, /Adult ages only/);
  const d = { ...s, people: "demographics" as const, ethnicities: ["Japanese", "Korean", "Persian", "Arab"], gender: "both" as const };
  assert.equal(problem(d, true), "");
  assert.match(cellPrompts(d)[0], /male of Japanese/);
});

test("custom needs text and makes distinct cells", () => {
  const s = { ...initialState(), mode: "custom" as const, grid: "2x2" as const };
  assert.match(problem(s, false), /Describe/);
  const c = cellPrompts({ ...s, custom: "this street in spring, summer, autumn and winter" });
  assert.equal(new Set(c).size, 4);
});
