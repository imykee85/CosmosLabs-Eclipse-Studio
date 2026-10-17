// Soul ID: training request, status polling, charging once, and the fields a Soul render carries. Throwaway Postgres + fake Higgsfield + fake R2.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_soul_a", B = "user_soul_b";
let hf: Server, r2: Server; let state = "queued";
const seen: { method: string; path: string; body: Record<string, unknown> }[] = [];
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
before(async () => {
  if (skip) return;
  hf = createServer(async (req, res) => {
    const raw = await body(req); seen.push({ method: req.method ?? "", path: req.url ?? "", body: raw ? JSON.parse(raw) : {} });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/v1/custom-references") return res.end(JSON.stringify({ id: "cref_1", status: "queued" }));
    if (req.method === "GET" && req.url === "/v1/custom-references/cref_1") return res.end(JSON.stringify({ id: "cref_1", status: state }));
    if (req.method === "POST" && req.url?.startsWith("/files/")) { res.statusCode = 500; return res.end("{}"); }
    res.end(JSON.stringify({ status: "queued", request_id: "rq1", status_url: `http://127.0.0.1:${(hf.address() as { port: number }).port}/requests/rq1/status` }));
  });
  r2 = createServer((_q, res) => res.end("x"));
  const hp = await new Promise<number>((r) => hf.listen(0, "127.0.0.1", () => r((hf.address() as { port: number }).port)));
  const rp = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { HIGGSFIELD_API_KEY: "id:secret", HIGGSFIELD_BASE_URL: `http://127.0.0.1:${hp}`, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", HIGGSFIELD_REFERENCE_DELIVERY: "signed", CREDITS_ENABLED: "1", SOUL_ID_CREDITS: "50" });
  lib = { soul: await import("../../src/lib/soul-id"), db: (await import("../../src/lib/db")).db, credits: await import("../../src/lib/credits") };
  await clean();
  for (let i = 0; i < 5; i++) await lib.db.upload.create({ data: { id: `sup${i}`, userId: A, kind: "character", name: `p${i}`, storageKey: `u/a/p${i}.png`, contentType: "image/png", sizeBytes: 10 } });
  await lib.credits.grantCredits(A, 500, { reason: "GRANT", note: "test" });
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); hf.close(); r2.close(); });
const clean = async () => { for (const m of ["soulId", "upload", "usageEvent", "creditLedger", "generation"]) await lib.db[m].deleteMany({ where: { userId: { in: [A, B] } } }); };

test("fewer than 5 pictures, or someone else's, are refused", { skip }, async () => {
  assert.equal((await lib.soul.startSoulId(A, { name: "Maya", version: "v2", pictures: [{ type: "upload", id: "sup0" }] })).status, 400);
  assert.equal((await lib.soul.startSoulId(B, { name: "Maya", version: "v2", pictures: [0, 1, 2, 3, 4].map((i) => ({ type: "upload", id: `sup${i}` })) })).ok, false);
});

test("training is sent with the pictures and charged once when it completes", { skip }, async () => {
  const r = await lib.soul.startSoulId(A, { name: "Maya", version: "v2", pictures: [0, 1, 2, 3, 4].map((i) => ({ type: "upload", id: `sup${i}` })) });
  assert.equal(r.ok, true, r.error);
  const sent = seen.find((x) => x.path === "/v1/custom-references");
  assert.equal(sent?.body.name, "Maya"); assert.equal(sent?.body.model_version, "v2");
  assert.equal((sent?.body.input_images as { type: string }[]).length, 5); assert.equal((sent?.body.input_images as { type: string }[])[0].type, "image_url");
  const before = await lib.credits.getBalance(A);
  let row = await lib.db.soulId.findUnique({ where: { id: r.item.id } });
  row = await lib.soul.refreshSoulId(row); assert.equal(row.status, "pending");
  state = "completed";
  row = await lib.soul.refreshSoulId(row); assert.equal(row.status, "completed");
  await lib.soul.refreshSoulId(row);
  assert.equal(await lib.credits.getBalance(A), before - 50, "charged exactly once");
  const f = await lib.soul.soulIdFields(A, "soul_v2", row.id, 0.6);
  assert.deepEqual(f, { ok: true, fields: { custom_reference_id: "cref_1", custom_reference_strength: 0.6 } });
  assert.equal((await lib.soul.soulIdFields(A, "soul_cinema", row.id, 1)).ok, false, "trained for Soul 2 only");
  assert.equal((await lib.soul.soulIdFields(B, "soul_v2", row.id, 1)).ok, false, "not someone else's");
  assert.equal((await lib.soul.soulIdFields(A, "grok_image_2", row.id, 1)).ok, false);
});

test("a Soul 2 render with a Soul ID sends custom_reference_id and strength", { skip }, async () => {
  const { startRender } = await import("../../src/lib/start-render");
  const row = await lib.db.soulId.findFirst({ where: { userId: A, status: "completed" } });
  const r = await startRender({ userId: A, prompt: "Maya on a rooftop", model: "soul_v2", aspectRatio: "3:4", soulId: row.id, soulStrength: 0.8 });
  assert.equal(r.ok, true, r.error);
  const sent = seen.filter((x) => x.path.includes("soul/v2")).at(-1);
  assert.equal(sent?.body.custom_reference_id, "cref_1");
  assert.equal(sent?.body.custom_reference_strength, 0.8);
  const bad = await startRender({ userId: A, prompt: "x", model: "grok_image_2", soulId: row.id });
  assert.equal(bad.ok, false);
});
