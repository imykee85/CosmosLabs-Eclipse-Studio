// Core can only QUEUE a message for a connected app; it goes out only when the person presses Send. Against a throwaway Postgres and a stand-in for Slack.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
process.env.CONNECT_SECRET_KEY = process.env.CONNECT_SECRET_KEY || "test-secret-for-connectors";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tools: any, db: any, seal: (s: string) => string;
const U = "user_cs_send";
const calls: string[] = [];
const real = globalThis.fetch;

before(async () => {
  if (skip) return;
  tools = await import("../../src/lib/connect-tools");
  db = (await import("../../src/lib/db")).db;
  seal = (await import("../../src/lib/secret-box")).seal;
  await db.pendingSend.deleteMany({ where: { userId: U } });
  await db.connectorLink.deleteMany({ where: { userId: U } });
  await db.connectorLink.create({ data: { userId: U, connector: "slack", label: "#launch", secret: seal(JSON.stringify({ token: "https://hooks.slack.com/services/T000/B000/XXXX" })) } });
  globalThis.fetch = (async (url: string) => { calls.push(String(url)); return new Response("ok", { status: 200 }); }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = real;
  if (skip) return;
  await db.pendingSend.deleteMany({ where: { userId: U } });
  await db.connectorLink.deleteMany({ where: { userId: U } });
  await db.$disconnect();
});

const ctx = (seen: string[] = []) => ({ userId: U, projectId: null, chatId: null, onRender: () => {}, onSend: (id: string) => seen.push(id) });

test("send_to_app only queues: nothing is posted and the model is told it was not sent", { skip }, async () => {
  const seen: string[] = [];
  const r = await tools.runTool("send_to_app", { app: "slack", text: "Memory dump: the client's secret plan" }, ctx(seen));
  assert.equal(r.isError, undefined);
  const out = JSON.parse(r.text);
  assert.equal(out.queued, true);
  assert.equal(out.sent, false);
  assert.match(out.note, /NOT SENT YET/);
  assert.deepEqual(calls, [], "no request left the server");
  assert.equal(seen.length, 1);
  const row = await db.pendingSend.findUnique({ where: { id: out.pending_send_id } });
  assert.equal(row.status, "pending");
  assert.equal(row.app, "slack");
});

test("an app that is not connected, an empty message and a bad picture are refused up front", { skip }, async () => {
  assert.equal((await tools.runTool("send_to_app", { app: "discord", text: "hi" }, ctx())).isError, true);
  assert.equal((await tools.runTool("send_to_app", { app: "slack", text: "   " }, ctx())).isError, true);
  assert.equal((await tools.runTool("send_to_app", { app: "slack", text: "hi", generation_id: "nope" }, ctx())).isError, true);
  assert.deepEqual(calls, []);
});

test("only 20 messages can wait at once", { skip }, async () => {
  await db.pendingSend.deleteMany({ where: { userId: U } });
  for (let i = 0; i < 20; i++) assert.equal((await tools.runTool("send_to_app", { app: "slack", text: `m${i}` }, ctx())).isError, undefined);
  const r = await tools.runTool("send_to_app", { app: "slack", text: "one too many" }, ctx());
  assert.equal(r.isError, true);
  assert.match(r.text, /20 messages/);
  await db.pendingSend.deleteMany({ where: { userId: U } });
});

test("the person's own Send posts it for real, once", { skip }, async () => {
  const r = await tools.runTool("send_to_app", { app: "slack", text: "Launch is live" }, ctx());
  const id = JSON.parse(r.text).pending_send_id;
  // Two taps at once: only one claims it (the same claim the route makes).
  const claims = await Promise.all([1, 2].map(() => db.pendingSend.updateMany({ where: { id, userId: U, status: "pending" }, data: { status: "sending" } })));
  assert.equal(claims.filter((c: { count: number }) => c.count === 1).length, 1);
  const row = await db.pendingSend.findUnique({ where: { id } });
  const out = await tools.performSend(U, row.app, row.text, row.generationId);
  assert.equal(out.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/hooks\.slack\.com\//);
});

test("performSend says plainly when the app was disconnected meanwhile", { skip }, async () => {
  const out = await tools.performSend(U, "discord", "hi", null);
  assert.equal(out.ok, false);
  assert.match(out.error, /not connected/);
});
