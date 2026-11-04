import { test } from "node:test";
import assert from "node:assert/strict";
import { serverSecret } from "../../src/lib/server-secret";

test("a configured key is used, the first one that is set wins", () => {
  assert.equal(serverSecret(undefined, "b", "c"), "b");
  assert.equal(serverSecret("a", "b"), "a");
});

test("the development value exists only outside production", () => {
  const env = process.env as Record<string, string | undefined>, was = env.NODE_ENV;
  try {
    env.NODE_ENV = "test";
    assert.equal(serverSecret(undefined, ""), "dev-only-not-secret");
    env.NODE_ENV = "production";
    assert.throws(() => serverSecret(undefined, ""));
    assert.equal(serverSecret("real"), "real");
  } finally { env.NODE_ENV = was; }
});
