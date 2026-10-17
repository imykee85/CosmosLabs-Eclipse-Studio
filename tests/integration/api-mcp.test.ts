// API keys, the REST API and the MCP endpoint against a throwaway Postgres (no Clerk: these routes authenticate with the key).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_api_a";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any; let key = "";

before(async () => {
  if (skip) return;
  lib = { keys: await import("../../src/lib/api-keys"), db: (await import("../../src/lib/db")).db, mcp: await import("../../src/app/api/mcp/route"), renders: await import("../../src/app/api/v1/renders/[id]/route"), credits: await import("../../src/app/api/v1/credits/route"), models: await import("../../src/app/api/v1/models/route") };
  await clean();
  const k = await lib.keys.createKey(A, "Test");
  key = k.key;
  await lib.db.generation.create({ data: { id: "gapi1", userId: A, kind: "image", prompt: "a cat", status: "completed", imageUrl: "https://example.com/cat.png", model: "soul_v2" } });
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); });
const clean = async () => { await lib.db.apiKey.deleteMany({ where: { userId: A } }); await lib.db.generation.deleteMany({ where: { userId: A } }); await lib.db.usageEvent.deleteMany({ where: { userId: A } }); };
const req = (url: string, body?: unknown, k = key) => new Request(`http://x${url}`, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

test("only the hash is stored; a key starts with ecl_", { skip }, async () => {
  assert.match(key, /^ecl_[A-Za-z0-9]{40}$/);
  const rows = await lib.db.apiKey.findMany({ where: { userId: A } });
  assert.equal(rows.length, 1); assert.notEqual(rows[0].hash, key); assert.equal(rows[0].hash, lib.keys.hashKey(key)); assert.equal(rows[0].prefix, key.slice(0, 10));
});

test("REST: renders and credits answer for the key's owner; bad keys get 401", { skip }, async () => {
  const r = await lib.renders.GET(req("/api/v1/renders/gapi1"), { params: { id: "gapi1" } });
  assert.equal(r.status, 200); const d = await r.json();
  assert.equal(d.id, "gapi1"); assert.equal(d.status, "completed"); assert.equal(d.url, "https://example.com/cat.png");
  assert.equal((await lib.credits.GET(req("/api/v1/credits"))).status, 200);
  assert.equal((await lib.models.GET(req("/api/v1/models"))).status, 200);
  assert.equal((await lib.renders.GET(req("/api/v1/renders/gapi1", undefined, "ecl_wrongwrongwrongwrongwrongwrong"), { params: { id: "gapi1" } })).status, 401);
  assert.equal((await lib.renders.GET(new Request("http://x/api/v1/renders/gapi1"), { params: { id: "gapi1" } })).status, 401);
  assert.equal((await lib.renders.GET(req("/api/v1/renders/nope"), { params: { id: "nope" } })).status, 404);
});

test("MCP: initialize, tools/list, tools/call, notifications, unknown method", { skip }, async () => {
  const init = await (await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } }))).json();
  assert.equal(init.result.protocolVersion, "2025-06-18"); assert.equal(init.result.serverInfo.name, "eclipse-studio"); assert.ok(init.result.capabilities.tools);
  const note = await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }));
  assert.equal(note.status, 202);
  const list = await (await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" }))).json();
  assert.deepEqual(list.result.tools.map((t: { name: string }) => t.name), ["list_models", "generate_image", "generate_video", "get_render", "list_renders", "get_credits"]);
  const call = await (await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_render", arguments: { id: "gapi1" } } }))).json();
  assert.equal(call.result.structuredContent.id, "gapi1");
  const missing = await (await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_render", arguments: { id: "nope" } } }))).json();
  assert.equal(missing.result.isError, true);
  const bad = await (await lib.mcp.POST(req("/api/mcp", { jsonrpc: "2.0", id: 5, method: "resources/list" }))).json();
  assert.equal(bad.error.code, -32601);
  const batch = await (await lib.mcp.POST(req("/api/mcp", [{ jsonrpc: "2.0", id: 6, method: "ping" }, { jsonrpc: "2.0", method: "notifications/x" }]))).json();
  assert.equal(batch.length, 1); assert.equal(batch[0].id, 6);
  const noKey = await lib.mcp.POST(new Request("http://x/api/mcp", { method: "POST", body: "{}" }));
  assert.equal(noKey.status, 401);
});

test("a revoked key stops working", { skip }, async () => {
  await lib.db.apiKey.updateMany({ where: { userId: A }, data: { revokedAt: new Date() } });
  assert.equal((await lib.credits.GET(req("/api/v1/credits"))).status, 401);
});
