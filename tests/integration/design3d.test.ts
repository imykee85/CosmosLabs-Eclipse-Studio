// Design Studio's 3D generator against a throwaway Postgres, a fake Higgsfield, a fake R2 and a stubbed status/download fetch (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_d3_a", B = "user_d3_b", POOR = "user_d3_poor";
let hf: Server, r2: Server;
const sent: { path: string; body: Record<string, unknown> }[] = [];
const stored = new Map<string, number>();
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
const GLB = Buffer.concat([Buffer.from("glTF"), Buffer.from([2, 0, 0, 0, 12, 0, 0, 0])]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
let answer: Record<string, unknown> = { status: "in_progress" };
const realFetch = globalThis.fetch;

before(async () => {
  if (skip) return;
  hf = createServer(async (req, res) => {
    sent.push({ path: req.url ?? "", body: JSON.parse((await body(req)) || "{}") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "queued", request_id: `rq${sent.length}`, status_url: `https://platform.higgsfield.ai/requests/rq${sent.length}/status` }));
  });
  r2 = createServer(async (req, res) => { const b = await body(req); if (req.method === "PUT") stored.set(req.url ?? "", b.length); res.statusCode = req.method === "DELETE" ? 204 : 200; res.end(); });
  const hp = await new Promise<number>((r) => hf.listen(0, "127.0.0.1", () => r((hf.address() as { port: number }).port)));
  const rp = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { HIGGSFIELD_API_KEY: "id:secret", HIGGSFIELD_BASE_URL: `http://127.0.0.1:${hp}`, HIGGSFIELD_VIDEO_BASE_URL: `http://127.0.0.1:${hp}`, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "1" });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.startsWith("https://platform.higgsfield.ai/requests/")) return new Response(JSON.stringify(answer), { status: 200 });
    if (u.startsWith("https://cdn.test/")) return new Response(u.endsWith("bad.glb") ? Buffer.from("not a model at all") : GLB, { status: 200 });
    return realFetch(input, init);
  }) as typeof fetch;
  lib = { jobs: await import("../../src/lib/design/jobs3d"), m: await import("../../src/lib/design/models3d"), cr: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db };
  await clean();
  await lib.cr.grantCredits(A, 10000, { reason: "GRANT", provider: "test", externalId: "d3-a" });
  await lib.db.upload.create({ data: { id: "d3poor", userId: POOR, kind: "asset", name: "boat", storageKey: "u/p/boat.png", contentType: "image/png", sizeBytes: 10 } });
  await lib.db.upload.create({ data: { id: "d3pic", userId: A, kind: "asset", name: "boat", storageKey: "u/a/boat.png", contentType: "image/png", sizeBytes: 10 } });
});
after(async () => { if (skip) return; globalThis.fetch = realFetch; await clean(); await lib.db.$disconnect(); hf.close(); r2.close(); });
async function clean() {
  for (const u of [A, B, POOR]) {
    await lib.db.model3D.deleteMany({ where: { userId: u } }); await lib.db.upload.deleteMany({ where: { userId: u } });
    await lib.db.creditLedger.deleteMany({ where: { userId: u } }); await lib.db.usageEvent.deleteMany({ where: { userId: u } });
  }
}
const price = () => lib.m.price3D(lib.m.find3D("meshy_v7_image_to_3d"));
const go = (over: Record<string, unknown> = {}) => lib.jobs.start3D({ userId: A, model: "meshy_v7_image_to_3d", mode: "image", prompt: "", refs: [{ type: "upload", id: "d3pic" }], options: {}, ...over });

test("start holds the price, sends the picture to the maker and returns a pending row", { skip }, async () => {
  const r = await go();
  assert.equal(r.ok, true, r.error);
  assert.equal(r.item.status, "pending");
  const last = sent[sent.length - 1];
  assert.match(last.path, /meshy_v7_image_to_3d$/);
  assert.ok(String(last.body.image_url).startsWith("http"), "a link to the picture");
  const row = await lib.db.model3D.findUnique({ where: { id: r.item.id } });
  assert.equal(row.creditsHeld, price()); assert.ok(row.statusUrl && row.idemKey);
  assert.equal(await lib.cr.getBalance(A), 10000, "nothing charged yet");
});

test("a finished model is saved privately and charged once, however often it is asked", { skip }, async () => {
  const row = await lib.db.model3D.findFirst({ where: { userId: A }, orderBy: { createdAt: "desc" } });
  answer = { status: "in_progress" };
  assert.equal((await lib.jobs.finalize3D(row)).status, "pending");
  answer = { status: "completed", result: { model: { url: "https://cdn.test/boat.glb" } } };
  const fresh = await lib.db.model3D.findUnique({ where: { id: row.id } });
  const [x, y] = await Promise.all([lib.jobs.finalize3D(fresh), lib.jobs.finalize3D(fresh)]);
  assert.ok([x.status, y.status].includes("completed"));
  const done = await lib.db.model3D.findUnique({ where: { id: row.id } });
  assert.equal(done.status, "completed"); assert.equal(done.storageKey, `models3d/${A}/${row.id}.glb`); assert.equal(done.sizeBytes, GLB.length);
  assert.ok([...stored.keys()].some((k) => k.includes(`${row.id}.glb`)), `the file reached storage: ${[...stored.keys()].join(",")}`);
  assert.equal(await lib.cr.getBalance(A), 10000 - price(), "charged exactly once");
  await lib.jobs.finalize3D(done);
  assert.equal(await lib.cr.getBalance(A), 10000 - price());
});

test("a failed, refused or fake-file model charges nothing and releases the hold", { skip }, async () => {
  const before = await lib.cr.getBalance(A);
  for (const [ans, what] of [[{ status: "failed", error: "boom" }, /could not be made/], [{ status: "nsfw" }, /refused/], [{ status: "completed", result: { url: "https://cdn.test/bad.glb" } }, /could not be saved/]] as const) {
    answer = ans as Record<string, unknown>;
    const r = await go(); assert.equal(r.ok, true);
    let row = await lib.db.model3D.findUnique({ where: { id: r.item.id } });
    for (let i = 0; i < 4 && row.status !== "failed"; i++) { await lib.jobs.finalize3D(row); row = await lib.db.model3D.findUnique({ where: { id: r.item.id } }); }
    assert.equal(row.status, "failed"); assert.match(row.error, what);
    assert.doesNotMatch(row.error, /boom|Higgsfield|Meshy/i, "no provider text for people");
  }
  assert.equal(await lib.cr.getBalance(A), before, "nothing charged");
});

test("refusals: no credits, wrong mode, missing pictures, other people's pictures, too many running", { skip }, async () => {
  const n = sent.length;
  const poor = await go({ userId: POOR, refs: [{ type: "upload", id: "d3poor" }] }); assert.equal(poor.ok, false); assert.equal(poor.status, 402);
  assert.equal((await go({ mode: "text", prompt: "a boat" })).status, 400, "that model cannot work from words");
  assert.equal((await go({ refs: [] })).status, 400);
  assert.equal((await go({ userId: B })).status, 404, "someone else's picture");
  assert.equal((await go({ model: "tripo_h3_1_multiview_to_3d" })).status, 400, "needs at least two views");
  assert.equal((await lib.jobs.start3D({ userId: A, model: "meshy_v6_text_to_3d", mode: "text", prompt: "a naked child", refs: [], options: {} })).status, 422);
  assert.equal(sent.length, n, "nothing reached the maker");
  await lib.db.model3D.deleteMany({ where: { userId: A, status: "pending" } });
  assert.equal((await go()).ok, true); assert.equal((await go()).ok, true);
  assert.equal((await go()).status, 429);
});

test("deleting works on a finished model only, and removes the file", { skip }, async () => {
  const running = await lib.db.model3D.findFirst({ where: { userId: A, status: "pending" } });
  assert.equal(await lib.jobs.delete3D(A, running.id), false, "still being made");
  const done = await lib.db.model3D.findFirst({ where: { userId: A, status: "completed" } });
  assert.equal(await lib.jobs.delete3D(B, done.id), false, "not theirs");
  assert.equal(await lib.jobs.delete3D(A, done.id), true);
  assert.equal(await lib.db.model3D.findUnique({ where: { id: done.id } }), null);
});
