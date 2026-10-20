// Qwen Image direct route end to end against a throwaway Postgres, a fake DashScope, a fake picture host, a fake Higgsfield and a fake R2. No real keys.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_qwen_a", B = "user_qwen_b", C = "user_qwen_c", D = "user_qwen_d";
let ds: Server, hf: Server, r2: Server;
let dsMode: "ok" | "busy" | "safety" = "ok";
const dsSeen: { path: string; auth: string; body: Record<string, unknown> }[] = [];
const hfSeen: { path: string; body: Record<string, unknown> }[] = [];
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const port = (s: Server) => (s.address() as { port: number }).port;

before(async () => {
  if (skip) return;
  ds = createServer(async (req, res) => {
    const raw = await body(req);
    if (req.url?.startsWith("/pic")) { res.setHeader("Content-Type", "image/png"); return res.end(PNG); }
    dsSeen.push({ path: req.url ?? "", auth: String(req.headers.authorization), body: raw ? JSON.parse(raw) : {} });
    res.setHeader("Content-Type", "application/json");
    if (dsMode === "busy") { res.statusCode = 429; return res.end(JSON.stringify({ code: "Throttling.RateQuota", message: "slow down" })); }
    if (dsMode === "safety") { res.statusCode = 400; return res.end(JSON.stringify({ code: "DataInspectionFailed", message: "inappropriate content" })); }
    res.end(JSON.stringify({ output: { choices: [{ message: { content: [{ image: `http://127.0.0.1:${port(ds)}/pic.png` }] } }] }, usage: { image_count: 1 } }));
  });
  hf = createServer(async (req, res) => {
    const raw = await body(req); hfSeen.push({ path: req.url ?? "", body: raw ? JSON.parse(raw) : {} });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "queued", request_id: "rq-qwen", status_url: `http://127.0.0.1:${port(hf)}/requests/rq-qwen/status` }));
  });
  r2 = createServer(async (req, res) => { await body(req); res.end(); });
  for (const s of [ds, hf, r2]) await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  Object.assign(process.env, {
    DASHSCOPE_API_KEY: "k-qwen", DASHSCOPE_BASE_URL: `http://127.0.0.1:${port(ds)}`, ROUTE_QWEN_IMAGE_3: "direct",
    HIGGSFIELD_API_KEY: "id:secret", HIGGSFIELD_BASE_URL: `http://127.0.0.1:${port(hf)}`,
    R2_ENDPOINT: `http://127.0.0.1:${port(r2)}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "1",
  });
  lib = { start: await import("../../src/lib/start-render"), db: (await import("../../src/lib/db")).db, credits: await import("../../src/lib/credits"), models: await import("../../src/lib/models") };
  await clean();
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); ds.close(); hf.close(); r2.close(); });
const clean = async () => { for (const m of ["creditLedger", "generation", "freeRender", "usageEvent"]) await lib.db[m].deleteMany({ where: { userId: { in: [A, B, C, D] } } }); };

const model = () => lib.models.getModelById("qwen_image_3");
const direct2k = () => lib.models.chargeFor(model(), "2k", "direct");
const hf2k = () => lib.models.chargeFor(model(), "2k", "higgsfield");
async function waitFor(id: string, ok: (g: { status: string; params: unknown; creditsHeld: number | null; statusUrl: string | null; error: string | null }) => boolean) {
  for (let i = 0; i < 80; i++) { const g = await lib.db.generation.findUnique({ where: { id } }); if (g && ok(g)) return g; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("timed out waiting for the row");
}
const render = (userId: string) => lib.start.startRender({ userId, prompt: "a red fox on snow", model: "qwen_image_3", aspectRatio: "16:9", resolution: "2k" });

test("the direct price is below the Higgsfield price at 2k", { skip }, () => { assert.ok(direct2k() < hf2k(), `${direct2k()} vs ${hf2k()}`); });

test("direct success: one request to DashScope, picture saved, charged the direct price once", { skip }, async () => {
  dsMode = "ok"; await lib.credits.grantCredits(A, 1000, { reason: "GRANT", note: "test" });
  const before = await lib.credits.getBalance(A);
  const r = await render(A); assert.equal(r.ok, true, r.ok ? "" : r.error);
  const g = await waitFor(r.item.id, (x) => x.status === "completed");
  const sent = dsSeen.at(-1)!;
  assert.equal(sent.path, "/api/v1/services/aigc/multimodal-generation/generation"); assert.equal(sent.auth, "Bearer k-qwen");
  assert.equal((sent.body as { model: string }).model, "qwen-image-3.0");
  const p = (sent.body as { parameters: { size: string; n: number } }).parameters; assert.equal(p.n, 1); assert.match(p.size, /^\d+\*\d+$/);
  assert.equal((g.params as { route: string }).route, "direct");
  assert.equal(await lib.credits.getBalance(A), before - direct2k(), "charged the direct price, once");
  assert.equal(hfSeen.length, 0, "Higgsfield was not called");
});

test("busy DashScope falls back to Higgsfield at the Higgsfield price, same row", { skip }, async () => {
  dsMode = "busy"; await lib.credits.grantCredits(B, 1000, { reason: "GRANT", note: "test" });
  const r = await render(B); assert.equal(r.ok, true);
  const g = await waitFor(r.item.id, (x) => (x.params as { route?: string } | null)?.route === "higgsfield-fallback");
  assert.equal(g.status, "pending"); assert.equal(g.creditsHeld, hf2k(), "hold raised to the Higgsfield price");
  assert.match(g.statusUrl ?? "", /rq-qwen/); assert.ok(hfSeen.length >= 1, "Higgsfield was started");
  assert.equal(await lib.db.generation.count({ where: { userId: B } }), 1, "one row, no duplicate");
});

test("fallback without enough credits fails the render and charges nothing", { skip }, async () => {
  dsMode = "busy"; const hfBefore = hfSeen.length;
  await lib.credits.grantCredits(C, direct2k(), { reason: "GRANT", note: "test" }); // exactly the direct price, short of the Higgsfield price
  const r = await render(C); assert.equal(r.ok, true);
  const g = await waitFor(r.item.id, (x) => x.status === "failed");
  assert.ok(g.error);
  assert.equal(await lib.credits.getBalance(C), direct2k(), "nothing charged");
  assert.equal(hfSeen.length, hfBefore, "Higgsfield not called");
});

test("a safety refusal does not fall back and charges nothing", { skip }, async () => {
  dsMode = "safety"; const hfBefore = hfSeen.length;
  await lib.credits.grantCredits(D, 1000, { reason: "GRANT", note: "test" });
  const r = await render(D); assert.equal(r.ok, true);
  const g = await waitFor(r.item.id, (x) => x.status === "failed");
  assert.ok(g.error); assert.equal(hfSeen.length, hfBefore, "no fallback");
  assert.equal(await lib.credits.getBalance(D), 1000);
});
