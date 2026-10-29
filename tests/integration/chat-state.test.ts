// Chats kept on the account: the server functions against a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let s: any, db: any;
const A = "user_cs_a", B = "user_cs_b";

before(async () => {
  if (skip) return;
  s = await import("../../src/lib/chat-state");
  db = (await import("../../src/lib/db")).db;
  await db.chatState.deleteMany({ where: { userId: { in: [A, B] } } });
});
after(async () => { if (skip) return; await db.chatState.deleteMany({ where: { userId: { in: [A, B] } } }); await db.$disconnect(); });

test("only chat keys can be saved", { skip }, async () => {
  for (const key of ["eclipse-theme", "eclipse-draft-create", "random", "eclipse-agent-chat-atlas/../x", "eclipse-agent-chat-" + "a".repeat(200), 5, null]) {
    const r = await s.putState(A, key, "[]", Date.now());
    assert.equal(r.ok, false, String(key));
  }
  assert.equal((await s.putState(A, "eclipse-agent-chat-atlas", "[]", Date.now())).ok, true);
  assert.equal(s.isSyncKey("eclipse-treatment-p1"), true);
  assert.equal(s.isSyncKey("eclipse-prompts-engine"), true);
});

test("a chat is saved, listed and read back; an older copy never replaces a newer one", { skip }, async () => {
  const t = Date.now();
  assert.deepEqual(await s.putState(A, "eclipse-prompts-ai-master", '[{"id":"1","role":"user","text":"hi"}]', t), { ok: true });
  assert.deepEqual(await s.getState(A, "eclipse-prompts-ai-master"), { value: '[{"id":"1","role":"user","text":"hi"}]', at: t });
  const old = await s.putState(A, "eclipse-prompts-ai-master", "[]", t - 5000);
  assert.deepEqual(old, { ok: true, stale: true });
  assert.equal((await s.getState(A, "eclipse-prompts-ai-master")).value.includes("hi"), true, "the newer text stayed");
  assert.deepEqual(await s.putState(A, "eclipse-prompts-ai-master", "[1]", t + 1000), { ok: true });
  assert.equal((await s.getState(A, "eclipse-prompts-ai-master")).value, "[1]");
  const list = await s.listStates(A);
  assert.ok(list.some((i: { key: string; at: number }) => i.key === "eclipse-prompts-ai-master" && i.at === t + 1000));
});

test("one person never sees another person's chats", { skip }, async () => {
  await s.putState(A, "eclipse-treatment-p9", '{"plan":"secret"}', Date.now());
  assert.equal(await s.getState(B, "eclipse-treatment-p9"), null);
  assert.deepEqual((await s.listStates(B)).filter((i: { key: string }) => i.key === "eclipse-treatment-p9"), []);
  await s.putState(B, "eclipse-treatment-p9", '{"plan":"mine"}', Date.now());
  assert.equal((await s.getState(A, "eclipse-treatment-p9")).value, '{"plan":"secret"}');
});

test("too-large text is refused, a bad time is refused, null removes the key", { skip }, async () => {
  const big = await s.putState(A, "eclipse-agent-chat-big", "x".repeat(s.MAX_VALUE_CHARS + 1), Date.now());
  assert.equal(big.ok === false && big.status, 413);
  assert.equal((await s.putState(A, "eclipse-agent-chat-big", "[]", "soon")).ok, false);
  assert.equal((await s.putState(A, "eclipse-agent-chat-big", "[]", Date.now() + 10 * 24 * 3600_000)).ok, false);
  await s.putState(A, "eclipse-agent-chat-gone", "[]", Date.now());
  assert.equal((await s.putState(A, "eclipse-agent-chat-gone", null, Date.now() + 5)).ok, true);
  assert.equal(await s.getState(A, "eclipse-agent-chat-gone"), null);
});

test("deleting the account removes the saved chats", { skip }, async () => {
  const { USER_TABLES } = await import("../../src/lib/account-delete");
  assert.ok((USER_TABLES as readonly string[]).includes("chatState"));
});
