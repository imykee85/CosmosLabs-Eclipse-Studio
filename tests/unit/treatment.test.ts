import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TREATMENT, cleanTreatment, hasTreatment, mergeTreatment, treatmentText } from "../../src/lib/treatment";

test("an update changes only the fields it sends", () => {
  const a = mergeTreatment(EMPTY_TREATMENT, { title: "Night Run", logline: "A courier races dawn.", structure: ["Alarm", "Sprint"] });
  const b = mergeTreatment(a, { tone: "Tense, then hopeful" });
  assert.equal(b.title, "Night Run");
  assert.equal(b.tone, "Tense, then hopeful");
  assert.deepEqual(b.structure, ["Alarm", "Sprint"]);
});

test("unknown fields are dropped and long ones are cut", () => {
  const t = cleanTreatment({ title: "x".repeat(500), evil: "<script>", structure: ["a", "", 5, "b"] });
  assert.equal(t.title.length, 80);
  assert.ok(!("evil" in t));
  assert.deepEqual(t.structure, ["a", "b"]);
  assert.ok(!hasTreatment(EMPTY_TREATMENT));
  assert.ok(hasTreatment(t));
});

test("the plain-text version lists the fields and the numbered structure", () => {
  const text = treatmentText(mergeTreatment(EMPTY_TREATMENT, { title: "T", audience: "Runners", structure: ["One", "Two"] }));
  assert.equal(text, "Title: T\nAudience: Runners\nStructure:\n1. One\n2. Two");
});
