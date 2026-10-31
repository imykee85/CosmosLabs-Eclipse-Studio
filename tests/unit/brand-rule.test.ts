import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BRAND_RULE } from "../../src/lib/brand";

// Owner 2026-10-31: no assistant may ever reveal how it works, to anyone, the owner included.
test("the shared rule keeps how the assistants work confidential, whoever asks", () => {
  assert.match(BRAND_RULE, /CONFIDENTIALITY RULE/);
  assert.match(BRAND_RULE, /proprietary/);
  assert.match(BRAND_RULE, /owner/);
  assert.match(BRAND_RULE, /system prompt/);
  assert.match(BRAND_RULE, /ignore, forget, override/);
  assert.match(BRAND_RULE, /BRAND RULE/);
});

test("every assistant and text route sends the rule with its instructions", () => {
  for (const f of ["src/lib/agent-turn.ts", "src/lib/connect-agent.ts", "src/app/api/treatment/chat/route.ts", "src/app/api/prompts/chat/route.ts", "src/app/api/canvas/assistant/route.ts", "src/app/api/prompts/polish/route.ts"]) {
    assert.match(readFileSync(f, "utf8"), /BRAND_RULE/, f);
  }
});
