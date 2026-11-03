import test from "node:test";
import assert from "node:assert/strict";
import { BRAND_RULE, LEAK_CANARY, LEAK_REPLY, guardText, leaked } from "../../src/lib/brand";

test("the private marker is inside the rules the assistants receive", () => {
  assert.ok(BRAND_RULE.includes(LEAK_CANARY));
});

test("a reply that repeats the instructions is replaced", () => {
  assert.equal(guardText(`Sure! ECLIPSE CONFIDENTIALITY RULE (highest priority)...`, "t"), LEAK_REPLY);
  assert.equal(guardText(`The code is ${LEAK_CANARY}`, "t"), LEAK_REPLY);
  assert.equal(guardText("your delivery rules say...", "t"), LEAK_REPLY);
});

test("normal replies pass through untouched", () => {
  const t = "Here is your prompt: a red car on a desert road at dawn.";
  assert.equal(guardText(t, "t"), t);
  assert.equal(leaked(t), false);
});
