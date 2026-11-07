import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeLimit } from "@/lib/agent-turn";

test("a finished job returns its own answer", async () => {
  assert.equal(await withTimeLimit(Promise.resolve("done"), 1000, "late"), "done");
});

test("a job that hangs gives the fallback in time", async () => {
  const started = Date.now();
  const never = new Promise<string>(() => {});
  assert.equal(await withTimeLimit(never, 50, "late"), "late");
  assert.ok(Date.now() - started < 1000);
});

test("a job that fails still rejects (errors are not hidden as timeouts)", async () => {
  await assert.rejects(withTimeLimit(Promise.reject(new Error("boom")), 1000, "late"), /boom/);
});
