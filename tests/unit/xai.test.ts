// xAI Grok Imagine direct route: request bodies and error mapping against a fake server. Built from docs/image-providers/xai-imagine.md; no live call.
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { xai, xaiRequest } from "../../src/lib/providers/xai";
import { ProviderError } from "../../src/lib/providers/types";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });
const base = { apiModel: "grok-imagine-image-2.0", prompt: "a fox", aspectRatio: "16:9", resolution: "2k", references: [] as { bytes: Uint8Array; contentType: string }[] };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

test("generate body: n 1, quality low, ratio and resolution; edit body: one image, no ratio", () => {
  assert.deepEqual(xaiRequest(base as never), { model: "grok-imagine-image-2.0", prompt: "a fox", n: 1, quality: "low", resolution: "2k", aspect_ratio: "16:9" });
  assert.equal((xaiRequest({ ...base, aspectRatio: "7:5" } as never) as { aspect_ratio: string }).aspect_ratio, "auto");
  const e = xaiRequest({ ...base, resolution: "1k", references: [{ bytes: new Uint8Array([1, 2, 3]), contentType: "image/PNG" }] } as never) as { image: { url: string; type: string }; aspect_ratio?: string; resolution: string };
  assert.deepEqual(e.image, { url: "data:image/png;base64,AQID", type: "image_url" }); assert.equal(e.aspect_ratio, undefined); assert.equal(e.resolution, "1k");
});

async function withServer(handler: (url: string) => { status?: number; json?: unknown; raw?: Buffer }, fn: (seen: { path: string; auth: string }[]) => Promise<void>) {
  const seen: { path: string; auth: string }[] = [];
  const srv = createServer((req, res) => {
    req.on("data", () => {}); req.on("end", () => {
      seen.push({ path: req.url ?? "", auth: String(req.headers.authorization) });
      const r = handler(req.url ?? ""); res.statusCode = r.status ?? 200;
      if (r.raw) { res.setHeader("Content-Type", "image/png"); return res.end(r.raw); }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(r.json ?? {}));
    });
  });
  const port = await new Promise<number>((r) => srv.listen(0, "127.0.0.1", () => r((srv.address() as { port: number }).port)));
  process.env.XAI_BASE_URL = `http://127.0.0.1:${port}`; process.env.XAI_API_KEY = "k-x";
  try { await fn(seen); } finally { srv.close(); }
}
const gen = (extra = {}) => xai.generate({ ...base, ...extra } as never);

test("url answer: posts to generations with the key and downloads the picture; b64 works too", async () => {
  await withServer((u) => u.startsWith("/pic") ? { raw: PNG } : { json: { data: [{ url: `${process.env.XAI_BASE_URL}/pic.png` }] } }, async (seen) => {
    const r = await gen(); assert.equal(seen[0].path, "/v1/images/generations"); assert.equal(seen[0].auth, "Bearer k-x"); assert.equal(r.bytes.length, PNG.length);
  });
  await withServer(() => ({ json: { data: [{ b64_json: PNG.toString("base64"), mime_type: "image/png" }] } }), async () => { assert.equal((await gen()).bytes.length, PNG.length); });
});

test("one reference uses the edits path; several are sent to Higgsfield (fallback)", async () => {
  const ref = { bytes: new Uint8Array([1]), contentType: "image/png" };
  await withServer(() => ({ json: { data: [{ b64_json: PNG.toString("base64") }] } }), async (seen) => { await gen({ references: [ref] }); assert.equal(seen[0].path, "/v1/images/edits"); });
  await assert.rejects(gen({ references: [ref, ref] }), (e: unknown) => e instanceof ProviderError && !!e.fallback);
});

test("errors: moderation does not fall back; busy, key and server errors do", async () => {
  const cases: [number, unknown, boolean][] = [[400, { error: "Content violates moderation policy" }, false], [429, { error: "rate" }, true], [401, { error: "bad key" }, true], [503, { error: "down" }, true], [400, { error: "bad field" }, false]];
  for (const [status, json, fb] of cases) await withServer(() => ({ status, json }), async () => { await assert.rejects(gen(), (e: unknown) => e instanceof ProviderError && !!e.fallback === fb, `${status}`); });
  await withServer(() => ({ json: { data: [{ respect_moderation: false }] } }), async () => { await assert.rejects(gen(), (e: unknown) => e instanceof ProviderError && !e.fallback); });
});
