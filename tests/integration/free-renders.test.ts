// The welcome offer (3 free image renders for new accounts) against a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { before } from "node:test";
import assert from "node:assert/strict";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any, db: any;
const NEW = Date.parse("2026-11-01"), OLD = Date.parse("2026-09-01");

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  delete process.env.FREE_RENDERS_COUNT; delete process.env.FREE_RENDERS_MAX_CREDITS; delete process.env.FREE_RENDERS_FROM;
  lib = await import("../../src/lib/free-renders");
  db = (await import("../../src/lib/db")).db;
  await db.freeRender.deleteMany({ where: { userId: { startsWith: "user_free_" } } }); // a clean start on a database that has been used before
});

test("a new account gets 2 free renders on any model, and each claim uses one", { skip }, async () => {
  const id = "user_free_new";
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 2);
  assert.equal(await lib.freeUsedUp(id), false);
  assert.equal(await lib.claimFreeRender(id, 2, async () => NEW), true);
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 1);
  assert.equal(await lib.claimFreeRender(id, 32, async () => NEW), true, "even the dearest model");
  assert.equal(await lib.claimFreeRender(id, 7, async () => NEW), false, "the third is paid");
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 0);
  assert.equal(await lib.freeUsedUp(id), true, "so the message can say the free images are used");
});

test("an account made before the offer gets nothing, and Clerk is asked only once", { skip }, async () => {
  let asked = 0;
  const lookup = async () => { asked++; return OLD; };
  assert.equal(await lib.freeRendersLeft("user_free_old", lookup), 0);
  assert.equal(await lib.claimFreeRender("user_free_old", 2, lookup), false);
  assert.equal(asked, 1);
});

test("FREE_RENDERS_MAX_CREDITS is ignored: a free render may be on any model, whatever it costs", { skip }, async () => {
  const id = "user_free_cap";
  process.env.FREE_RENDERS_MAX_CREDITS = "15";
  assert.equal(await lib.claimFreeRender(id, 600, async () => NEW), true);
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 1);
  delete process.env.FREE_RENDERS_MAX_CREDITS;
});

test("an account made while the offer was 3 never gets more than 2 in all", { skip }, async () => {
  const id = "user_free_three";
  await db.freeRender.create({ data: { userId: id, remaining: 3, granted: 3 } });
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 2);
  assert.equal(await lib.claimFreeRender(id, 2, async () => NEW), true);
  assert.equal(await lib.claimFreeRender(id, 2, async () => NEW), true);
  assert.equal(await lib.claimFreeRender(id, 2, async () => NEW), false);
});

test("a failed free render is given back, never above what was granted", { skip }, async () => {
  const id = "user_free_back";
  await lib.claimFreeRender(id, 2, async () => NEW);
  await lib.giveBackFreeRender(id);
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 2);
  await lib.giveBackFreeRender(id);
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 2);
});

test("teams, switched-off credits and unknown account dates give nothing", { skip }, async () => {
  assert.equal(await lib.freeRendersLeft("org_team1", async () => NEW), 0);
  assert.equal(await lib.freeRendersLeft("user_free_unknown", async () => null), 0);
  assert.equal(await db.freeRender.findUnique({ where: { userId: "user_free_unknown" } }), null, "no row is made when the date is unknown");
  process.env.CREDITS_ENABLED = "0";
  assert.equal(await lib.freeRendersLeft("user_free_off", async () => NEW), 0);
  process.env.CREDITS_ENABLED = "1";
});

test("claims at the same moment never go below zero", { skip }, async () => {
  const id = "user_free_race";
  const results = await Promise.all(Array.from({ length: 8 }, () => lib.claimFreeRender(id, 2, async () => NEW)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(await lib.freeRendersLeft(id, async () => NEW), 0);
});
