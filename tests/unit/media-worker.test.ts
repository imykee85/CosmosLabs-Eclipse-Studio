import { test } from "node:test";
import assert from "node:assert/strict";
import { getWorkerJob, startWorkerJob, WORKER_TOOLS } from "../../src/lib/media-worker";

test("the worker accepts only the eight whitelisted tools", () => {
  assert.deepEqual([...WORKER_TOOLS], ["probe", "prep", "frame", "check", "finish", "versions", "split", "assemble"]);
});

test("without the worker address and secret the job is refused before anything is sent", async () => {
  const saved = { url: process.env.MEDIA_WORKER_URL, secret: process.env.MEDIA_WORKER_SECRET };
  delete process.env.MEDIA_WORKER_URL; delete process.env.MEDIA_WORKER_SECRET;
  try {
    await assert.rejects(startWorkerJob({ tool: "probe", args: [], inputs: {}, outputs: {} }, async () => { throw new Error("should not be called"); }), /worker-not-set-up/);
  } finally {
    if (saved.url) process.env.MEDIA_WORKER_URL = saved.url;
    if (saved.secret) process.env.MEDIA_WORKER_SECRET = saved.secret;
  }
});

test("job ids must be 32 hex characters", async () => {
  process.env.MEDIA_WORKER_URL = "http://worker.test"; process.env.MEDIA_WORKER_SECRET = "s";
  await assert.rejects(getWorkerJob("../etc", async () => new Response("{}")), /bad-job-id/);
});
