import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// The upload scan against a small fake Anthropic server: what comes back decides whether a picture may be stored.
let server: http.Server;
let mode = "allow";
let calls = 0;
const answers: Record<string, unknown> = { allow: { verdict: "allow", category: "none" }, watermark: { verdict: "block", category: "stock_watermark" }, minor: { verdict: "block", category: "minor_sexual" }, garbled: { verdict: "maybe" } };
const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

before(async () => {
  server = http.createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      calls++;
      if (mode === "error") { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } })); return; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", id: "t", name: "report_scan", input: answers[mode] }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.ANTHROPIC_API_KEY = "test";
});
after(() => server.close());

test("scan answers decide the upload", async () => {
  const { scanUpload } = await import("../../src/lib/upload-scan");
  mode = "allow";
  assert.deepEqual(await scanUpload(png, "image/png"), { ok: true, scanned: true });
  mode = "watermark";
  const w = await scanUpload(png, "image/png");
  assert.equal(w.ok, false);
  if (!w.ok) { assert.equal(w.status, 422); assert.match(w.error, /watermark/i); }
  mode = "minor";
  assert.equal((await scanUpload(png, "image/png")).ok, false);
  mode = "garbled";
  const g = await scanUpload(png, "image/png");
  assert.equal(g.ok, false);
  if (!g.ok) assert.equal(g.status, 503); // an unreadable answer never lets a picture through
});

test("when the checker is down, uploads are blocked unless allowed by setting", async () => {
  const { scanUpload } = await import("../../src/lib/upload-scan");
  mode = "error";
  const blocked = await scanUpload(png, "image/png");
  assert.equal(blocked.ok, false);
  process.env.UPLOAD_SCAN_ON_ERROR = "allow";
  assert.deepEqual(await scanUpload(png, "image/png"), { ok: true, scanned: false });
  delete process.env.UPLOAD_SCAN_ON_ERROR;
});

test("the scan can be switched off and is skipped without a key", async () => {
  const { scanUpload } = await import("../../src/lib/upload-scan");
  const before = calls;
  process.env.UPLOAD_SCAN = "off";
  assert.deepEqual(await scanUpload(png, "image/png"), { ok: true, scanned: false });
  delete process.env.UPLOAD_SCAN;
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.deepEqual(await scanUpload(png, "image/png"), { ok: true, scanned: false });
  process.env.ANTHROPIC_API_KEY = key;
  assert.equal(calls, before);
});
