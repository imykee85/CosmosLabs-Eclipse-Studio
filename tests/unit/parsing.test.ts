import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImportLine } from "../../src/lib/memory";
import { parseReferenceRefs, parseVideoRefIds } from "../../src/lib/references";
import { safeText } from "../../src/lib/safe-text";

test("memory import files a labelled line under its topic and others under the fallback", () => {
  assert.deepEqual(parseImportLine("Style: warm film grain", "tastes"), { topic: "style", text: "warm film grain" });
  assert.deepEqual(parseImportLine("- I like quiet mornings", "tastes"), { topic: "tastes", text: "I like quiet mornings" });
  assert.equal(parseImportLine("   ", "tastes"), null);
});

test("picture references are ids only, deduplicated, and limited", () => {
  assert.deepEqual(parseReferenceRefs([{ type: "upload", id: "a" }, { type: "upload", id: "a" }, { type: "render", id: "b" }]), [{ type: "upload", id: "a" }, { type: "render", id: "b" }]);
  assert.equal(parseReferenceRefs([{ type: "url", id: "a" }]), null);
  assert.equal(parseReferenceRefs([{ type: "upload", id: "x".repeat(65) }]), null);
  assert.equal(parseReferenceRefs([{ type: "upload", id: "a" }, { type: "upload", id: "b" }], 1), null);
  assert.deepEqual(parseReferenceRefs(undefined), []);
});

test("reference clips are ids only and limited", () => {
  assert.deepEqual(parseVideoRefIds([{ id: "v1" }, { id: "v1" }, { id: "v2" }], 5), ["v1", "v2"]);
  assert.equal(parseVideoRefIds([{ id: "v1" }, { id: "v2" }], 1), null);
  assert.equal(parseVideoRefIds(["https://evil.test/x.mp4"], 5), null);
});

test("provider error text never shows a key, a token or a query string", () => {
  const out = safeText("failed for Bearer abcdef1234567890 at https://api.example.test/v1/x?key=SECRETVALUE and sk-abcdefghijklmnopqrstuvwxyz");
  assert.ok(!out.includes("abcdef1234567890"));
  assert.ok(!out.includes("SECRETVALUE"));
  assert.ok(!out.includes("sk-abcdefghijklmnopqrstuvwxyz"));
});
