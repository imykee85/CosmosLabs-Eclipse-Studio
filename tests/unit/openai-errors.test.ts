import test from "node:test";
import assert from "node:assert/strict";
import { openai } from "../../src/lib/providers/openai";
import { ProviderError } from "../../src/lib/providers/types";

async function blocked(references: number) {
  const real = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "moderation_blocked", message: "Your request was rejected by the safety system. safety_violations=[sexual]." } }), { status: 400 })) as typeof fetch;
  try {
    await openai.generate({ apiModel: "gpt-image-2", prompt: "x", aspectRatio: "9:16", resolution: "2k", sizing: "custom16", references: Array.from({ length: references }, () => ({ bytes: new Uint8Array([1]), contentType: "image/png" })) });
    assert.fail("should have thrown");
  } catch (e) {
    assert.ok(e instanceof ProviderError);
    return e.userMessage;
  } finally { globalThis.fetch = real; }
}

test("a blocked picture edit names what OpenAI flagged and says the pictures are checked too", async () => {
  const m = await blocked(2);
  assert.match(m, /flagged: sexual/);
  assert.match(m, /pictures as well as your words/);
});

test("a blocked text-only request does not blame pictures", async () => {
  const m = await blocked(0);
  assert.match(m, /flagged: sexual/);
  assert.doesNotMatch(m, /pictures/);
});
