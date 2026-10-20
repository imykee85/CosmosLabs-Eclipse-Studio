// Qwen Image direct route: request body, size rule, error mapping. Built from docs/image-providers/qwen-image.md; no live call.
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { qwen, qwenRequest, qwenSize } from "../../src/lib/providers/qwen";
import { ProviderError } from "../../src/lib/providers/types";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

const base = { apiModel: "qwen-image-3.0", prompt: "a red fox", aspectRatio: "1:1", resolution: "1k", references: [] as { bytes: Uint8Array; contentType: string }[] };

test("sizes are WIDTH*HEIGHT with an asterisk, inside the 512*512 to 2048*2048 area", () => {
  for (const ratio of ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"]) for (const tier of ["1k", "2k"]) {
    const [w, h] = qwenSize(ratio, tier).split("*").map(Number);
    assert.ok(w > 0 && h > 0, `${ratio} ${tier}`);
    assert.ok(w * h >= 512 * 512 && w * h <= 2048 * 2048, `${ratio} ${tier} area ${w * h}`);
    assert.equal(w % 16, 0); assert.equal(h % 16, 0);
  }
  assert.ok(!qwenSize("1:1", "1k").includes("x"));
});

test("request body: one text, pictures first, n 1, no prompt extension, no watermark", () => {
  const b = qwenRequest({ ...base, references: [{ bytes: new Uint8Array([1, 2, 3]), contentType: "image/PNG" }] } as never) as { model: string; input: { messages: { role: string; content: Record<string, string>[] }[] }; parameters: Record<string, unknown> };
  assert.equal(b.model, "qwen-image-3.0");
  const c = b.input.messages[0].content;
  assert.equal(b.input.messages[0].role, "user");
  assert.match(c[0].image, /^data:image\/png;base64,AQID$/);
  assert.equal(c[1].text, "a red fox"); assert.equal(c.length, 2);
  assert.deepEqual(b.parameters, { n: 1, size: "1024*1024", prompt_extend: false, watermark: false });
});

async function withServer(handler: (url: string, body: string) => { status?: number; json?: unknown; raw?: Buffer }, fn: (seen: { path: string; auth: string; body: string }[]) => Promise<void>) {
  const seen: { path: string; auth: string; body: string }[] = [];
  const srv = createServer((req, res) => {
    let s = ""; req.on("data", (d) => (s += d));
    req.on("end", () => {
      seen.push({ path: req.url ?? "", auth: String(req.headers.authorization), body: s });
      const r = handler(req.url ?? "", s); res.statusCode = r.status ?? 200;
      if (r.raw) { res.setHeader("Content-Type", "image/png"); return res.end(r.raw); }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(r.json ?? {}));
    });
  });
  const port = await new Promise<number>((r) => srv.listen(0, "127.0.0.1", () => r((srv.address() as { port: number }).port)));
  process.env.DASHSCOPE_BASE_URL = `http://127.0.0.1:${port}`; process.env.DASHSCOPE_API_KEY = "k-test";
  try { await fn(seen); } finally { srv.close(); }
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const gen = () => qwen.generate({ ...base } as never);

test("a good answer: posts to the sync path with the key and downloads the picture", async () => {
  await withServer((url) => url.startsWith("/pic") ? { raw: PNG } : { json: { output: { choices: [{ message: { content: [{ image: `${process.env.DASHSCOPE_BASE_URL}/pic.png` }] } }] }, usage: { image_count: 1 } } }, async (seen) => {
    const r = await gen();
    assert.equal(seen[0].path, "/api/v1/services/aigc/multimodal-generation/generation");
    assert.equal(seen[0].auth, "Bearer k-test");
    assert.equal(r.contentType, "image/png"); assert.equal(r.bytes.length, PNG.length);
  });
});

test("errors: safety does not fall back, busy and key problems do", async () => {
  const cases: [number, string, boolean | undefined][] = [[400, "DataInspectionFailed", false], [429, "Throttling.RateQuota", true], [401, "InvalidApiKey", true], [502, "InternalError", true], [400, "InvalidParameter", false]];
  for (const [status, code, fallback] of cases) {
    await withServer(() => ({ status, json: { code, message: "x" } }), async () => {
      await assert.rejects(gen(), (e: unknown) => e instanceof ProviderError && !!e.fallback === !!fallback, `${status} ${code}`);
    });
  }
});

test("an answer without a picture link, and a missing key, are errors", async () => {
  await withServer(() => ({ json: { output: { choices: [{ message: { content: [] } }] } } }), async () => { await assert.rejects(gen(), ProviderError); });
  delete process.env.DASHSCOPE_API_KEY;
  await assert.rejects(gen(), (e: unknown) => e instanceof ProviderError && !!e.fallback);
});
