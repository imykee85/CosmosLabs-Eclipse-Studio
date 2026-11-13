// Core never starts a paid cloud job by itself: it queues a card, and the job starts only when the person presses Start.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const U = "user_jobconfirm_a";

before(async () => {
  if (skip) return;
  lib = { c: await import("../../src/lib/sandbox/confirm"), db: (await import("../../src/lib/db")).db };
  await lib.db.pendingSend.deleteMany({ where: { userId: U } });
  await lib.db.sandboxJob.deleteMany({ where: { userId: U } });
});
after(async () => { if (skip) return; await lib.db.pendingSend.deleteMany({ where: { userId: U } }); await lib.db.sandboxJob.deleteMany({ where: { userId: U } }); await lib.db.$disconnect(); });

test("queueing a job creates a card and starts nothing", { skip }, async () => {
  let cardId = "";
  const r = await lib.c.queueJob({ userId: U, chatId: null, kind: "core.exec", input: { chatId: null }, id: "sbxjobconfirm000000001", summary: "Start a build machine.", onSend: (id: string) => { cardId = id; } });
  assert.equal(r.isError, undefined);
  assert.match(r.text, /NOT STARTED YET/);
  const row = await lib.db.pendingSend.findUnique({ where: { id: cardId } });
  assert.equal(row.app, "job:core.exec");
  assert.equal(row.status, "pending");
  assert.equal(await lib.db.sandboxJob.count({ where: { userId: U } }), 0, "no job exists until the person presses Start");
});

test("an invalid request is refused before a card is made", { skip }, async () => {
  const before = await lib.db.pendingSend.count({ where: { userId: U } });
  const r = await lib.c.queueJob({ userId: U, chatId: null, kind: "media.edit", input: { nonsense: true }, id: "sbxjobconfirm000000002", summary: "x" });
  assert.equal(r.isError, true);
  assert.equal(await lib.db.pendingSend.count({ where: { userId: U } }), before);
});

test("at most 20 cards wait at once", { skip }, async () => {
  await lib.db.pendingSend.createMany({ data: Array.from({ length: 20 }, () => ({ userId: U, app: "telegram", text: "x" })) });
  const r = await lib.c.queueJob({ userId: U, chatId: null, kind: "core.exec", input: { chatId: null }, id: "sbxjobconfirm000000003", summary: "x" });
  assert.equal(r.isError, true);
});
