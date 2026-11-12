// The ByteDance-cloud 3D models (Seed3D, Hyper3D, Hitem3D) against a throwaway Postgres, a fake task API, a fake R2 and a stubbed zip download. No real keys.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { zipSync } from "fflate";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_ark3d_a";
let ark: Server, r2: Server;
const sent: { method: string; path: string; auth: string; body: Record<string, unknown> }[] = [];
const stored = new Map<string, number>();
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
const GLB = Buffer.concat([Buffer.from("glTF"), Buffer.from([2, 0, 0, 0, 12, 0, 0, 0])]);
const ZIP = Buffer.from(zipSync({ "model/readme.txt": new Uint8Array([1]), "model/chair.glb": new Uint8Array(GLB) }));
let taskAnswer: Record<string, unknown> = { status: "running" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const realFetch = globalThis.fetch;

before(async () => {
  if (skip) return;
  ark = createServer(async (req, res) => {
    sent.push({ method: req.method ?? "", path: req.url ?? "", auth: String(req.headers.authorization ?? ""), body: JSON.parse((await body(req)) || "{}") });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") return res.end(JSON.stringify({ id: `cgt-${sent.length}` }));
    res.end(JSON.stringify(taskAnswer));
  });
  r2 = createServer(async (req, res) => { const b = await body(req); if (req.method === "PUT") stored.set(req.url ?? "", b.length); res.statusCode = req.method === "DELETE" ? 204 : 200; res.end(); });
  const ap = await new Promise<number>((r) => ark.listen(0, "127.0.0.1", () => r((ark.address() as { port: number }).port)));
  const rp = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { ARK_API_KEY: "ark-test-key", ARK_BASE_URL: `http://127.0.0.1:${ap}`, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "1", HIGGSFIELD_API_KEY: "id:secret" });
  delete process.env.ENABLED_MODELS;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.startsWith("https://ark-files.test/")) return new Response(u.endsWith("empty.zip") ? Buffer.from(zipSync({ "a.txt": new Uint8Array([1]) })) : ZIP, { status: 200 });
    return realFetch(input, init);
  }) as typeof fetch;
  lib = { jobs: await import("../../src/lib/design/jobs3d"), m: await import("../../src/lib/design/models3d"), cr: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db };
  await clean();
  await lib.cr.grantCredits(A, 10000, { reason: "GRANT", provider: "test", externalId: "ark3d-a" });
  await lib.db.upload.create({ data: { id: "ark3dpic", userId: A, kind: "asset", name: "chair", storageKey: "u/a/chair.png", contentType: "image/png", sizeBytes: 10 } });
});
after(async () => { if (skip) return; globalThis.fetch = realFetch; await clean(); await lib.db.$disconnect(); ark.close(); r2.close(); });
async function clean() { await lib.db.model3D.deleteMany({ where: { userId: A } }); await lib.db.upload.deleteMany({ where: { userId: A } }); await lib.db.creditLedger.deleteMany({ where: { userId: A } }); await lib.db.usageEvent.deleteMany({ where: { userId: A } }); }
const go = (model: string, over: Record<string, unknown> = {}) => lib.jobs.start3D({ userId: A, model, mode: "image", prompt: "", refs: [{ type: "upload", id: "ark3dpic" }], options: {}, ...over });

test("the models are off until switched on, then listed", { skip }, async () => {
  assert.equal((await go("seed3d_2_0")).ok, false);
  assert.ok(!lib.m.visible3D().some((m: { id: string }) => m.id === "seed3d_2_0"));
  process.env.ENABLED_MODELS = "seed3d_2_0,hyper3d_gen2,hitem3d_2_0";
  assert.ok(["seed3d_2_0", "hyper3d_gen2", "hitem3d_2_0"].every((id) => lib.m.visible3D().some((m: { id: string }) => m.id === id)));
  const key = process.env.ARK_API_KEY; delete process.env.ARK_API_KEY;
  assert.ok(!lib.m.visible3D().some((m: { id: string }) => m.id === "seed3d_2_0"), "no key, no model");
  process.env.ARK_API_KEY = key;
});

test("a task is created with the model id and text flags, the price held, then saved from the zip and charged once", { skip }, async () => {
  const r = await go("seed3d_2_0", { options: { polycount: 120000 } });
  assert.equal(r.ok, true, r.error);
  const call = sent[sent.length - 1];
  assert.equal(call.method, "POST"); assert.equal(call.path, "/contents/generations/tasks"); assert.equal(call.auth, "Bearer ark-test-key");
  assert.equal(call.body.model, "doubao-seed3d-2-0-260328");
  const content = call.body.content as { type: string; text?: string; image_url?: { url: string } }[];
  assert.equal(content[0].text, "--subdivisionlevel low --fileformat glb"); assert.equal(content[1].type, "image_url");
  const row = await lib.db.model3D.findUnique({ where: { id: r.item.id } });
  assert.match(row.statusUrl, /^ark:cgt-/); assert.equal(row.creditsHeld, lib.m.price3D(lib.m.find3D("seed3d_2_0")));
  taskAnswer = { status: "queued" };
  assert.equal((await lib.jobs.finalize3D(row)).status, "pending");
  taskAnswer = { status: "succeeded", content: { file_url: "https://ark-files.test/out.zip" }, usage: { total_tokens: 30000 } };
  const fresh = await lib.db.model3D.findUnique({ where: { id: row.id } });
  await Promise.all([lib.jobs.finalize3D(fresh), lib.jobs.finalize3D(fresh)]);
  const done = await lib.db.model3D.findUnique({ where: { id: row.id } });
  assert.equal(done.status, "completed"); assert.equal(done.sizeBytes, GLB.length); assert.equal(done.params.usage.total_tokens, 30000);
  assert.ok([...stored.keys()].some((k) => k.includes(`${row.id}.glb`)));
  assert.equal(await lib.cr.getBalance(A), 10000 - lib.m.price3D(lib.m.find3D("seed3d_2_0")), "charged exactly once");
});

test("a failed task and a zip with no model charge nothing", { skip }, async () => {
  const before = await lib.cr.getBalance(A);
  const r = await go("seed3d_2_0");
  const row = await lib.db.model3D.findUnique({ where: { id: r.item.id } });
  taskAnswer = { status: "failed", error: { code: "InternalError", message: "boom" } };
  assert.equal((await lib.jobs.finalize3D(row)).status, "failed");
  const r2b = await go("seed3d_2_0");
  const row2 = await lib.db.model3D.findUnique({ where: { id: r2b.item.id } });
  taskAnswer = { status: "succeeded", content: { file_url: "https://ark-files.test/empty.zip" } };
  let cur = row2; for (let i = 0; i < 4; i++) cur = await lib.jobs.finalize3D(await lib.db.model3D.findUnique({ where: { id: row2.id } }));
  assert.equal((await lib.db.model3D.findUnique({ where: { id: row2.id } })).status, "failed");
  assert.equal(await lib.cr.getBalance(A), before, "nothing charged");
  const sensitive = await go("seed3d_2_0");
  taskAnswer = { status: "failed", error: { code: "InputImageSensitiveContentDetected", message: "sensitive" } };
  const s = await lib.jobs.finalize3D(await lib.db.model3D.findUnique({ where: { id: sensitive.item.id } }));
  assert.equal(s.status, "failed"); assert.match(s.error, /refused/);
});

test("Hyper3D by words and Hitem3D with several views send their own flags", { skip }, async () => {
  const h = await go("hyper3d_gen2", { mode: "text", prompt: "a small wooden chair", refs: [], options: { polycount: 20000, pbr: true } });
  assert.equal(h.ok, true, h.error);
  const hc = sent[sent.length - 1];
  assert.equal(hc.body.model, "hyper3d-gen2-260112");
  assert.equal((hc.body.content as { text: string }[])[0].text, "a small wooden chair --mesh_mode Quad --quality_override 20000 --material PBR --fileformat glb");
  assert.equal((hc.body.content as unknown[]).length, 1);
  await lib.db.upload.create({ data: { id: "ark3dpic2", userId: A, kind: "asset", name: "side", storageKey: "u/a/side.png", contentType: "image/png", sizeBytes: 10 } });
  const t = await go("hitem3d_2_0", { mode: "multi", refs: [{ type: "upload", id: "ark3dpic" }, { type: "upload", id: "ark3dpic2" }], options: { polycount: 150000, detailed: true } });
  assert.equal(t.ok, true, t.error);
  const tc = sent[sent.length - 1];
  assert.equal((tc.body.content as { text: string }[])[0].text, "--resolution 1536pro --face 150000 --fileformat 2 --request-type 3 --multi_images_bit 1100");
  assert.equal((tc.body.content as unknown[]).length, 3);
});
