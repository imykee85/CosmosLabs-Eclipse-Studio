// Credit expiry against a throwaway Postgres: the expiry job is idempotent, expired credits cannot be spent, a running job's hold stays valid, nothing goes negative.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { before } from "node:test";
import assert from "node:assert/strict";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
const DAY = 86400000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, credits: any, expiry: any, res: any, sub: any;
const U = (n: string) => `user_expiry_${n}`;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const put = (userId: string, daysAgo: number, delta: number, reason: string, note: string | null, externalId?: string) =>
  db.creditLedger.create({ data: { userId, delta, reason, note, provider: externalId ? "test" : null, externalId: externalId ?? null, createdAt: ago(daysAgo) } });

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  process.env.CREDIT_EXPIRY_START = new Date(Date.now() - 200 * DAY).toISOString(); // the rule has been on for a long time
  db = (await import("../../src/lib/db")).db;
  credits = await import("../../src/lib/credits");
  expiry = await import("../../src/lib/expiry");
  res = await import("../../src/lib/reservations");
  sub = await import("../../src/lib/subscription");
  await db.creditLedger.deleteMany({ where: { userId: { startsWith: "user_expiry_" } } });
  await db.generation.deleteMany({ where: { userId: { startsWith: "user_expiry_" } } });
  await db.billingSettings.deleteMany({ where: { userId: { startsWith: "user_expiry_" } } });
});

test("plan credits are removed after the period and the job writes one history row; running it twice does the same as once", { skip }, async () => {
  const id = U("plan");
  await put(id, 40, 2000, "PURCHASE", "Plan: Starter", "p1");
  assert.equal(await credits.getBalance(id), 2000);
  assert.equal(await credits.getUsableBalance(id), 0, "past its date it is no longer spendable, even before the job runs");
  const first = await expiry.expireCredits(id);
  const second = await expiry.expireCredits(id);
  assert.equal(first, 2000);
  assert.equal(second, 0);
  assert.equal(await credits.getBalance(id), 0);
  const rows = await db.creditLedger.findMany({ where: { userId: id, reason: "EXPIRE" } });
  assert.equal(rows.length, 1);
  assert.match(rows[0].note, /Plan credits expired/);
});

test("a renewal removes the previous month's leftovers; spending takes the plan credits first and top-ups last", { skip }, async () => {
  const id = U("order");
  await put(id, 50, 2000, "PURCHASE", "Plan: Starter", "o1");
  await put(id, 20, 2000, "PURCHASE", "Plan: Starter", "o2");
  await put(id, 10, 500, "PURCHASE", "Top-up: 50 credits", "o3");
  await put(id, 15, 300, "PURCHASE", "Top-up: 30 credits", "o4");
  assert.equal(await credits.getUsableBalance(id), 2000 + 500 + 300, "the first month's plan credits ended at the renewal");
  await credits.spendCredits(id, 2100, "test");
  const state = await expiry.creditState(id);
  assert.equal(state.topup, 700, "2000 plan then 100 from the OLDEST top-up (the 300 one bought 15 days ago)");
  assert.equal(state.grants.find((g: { amount: number }) => g.amount === 300).remaining, 200);
  assert.equal(state.grants.find((g: { amount: number }) => g.amount === 500).remaining, 500);
});

test("a top-up is alive on day 89 and gone on day 91; a lapsed account cannot spend it either way", { skip }, async () => {
  const a = U("t89"), b = U("t91"), c = U("lapsed");
  await put(a, 89, 500, "PURCHASE", "Top-up: 50 credits", "t1");
  await put(a, 20, 2000, "PURCHASE", "Plan: Starter", "t1p"); // subscribed
  await put(b, 91, 500, "PURCHASE", "Top-up: 50 credits", "t2");
  await put(b, 20, 2000, "PURCHASE", "Plan: Starter", "t2p");
  assert.equal((await expiry.creditState(a)).topup, 500);
  assert.equal((await expiry.creditState(b)).topup, 0);
  assert.equal(await credits.getUsableBalance(a), 2500);
  assert.equal(await credits.getUsableBalance(b), 2000);
  // no plan at all: the top-up is saved but locked
  await put(c, 10, 500, "PURCHASE", "Top-up: 50 credits", "t3");
  assert.equal(await credits.getUsableBalance(c), 0);
  assert.equal(await sub.lockedTopup(c), 500);
});

test("a render holding credits when they expire stays valid, and nothing goes negative", { skip }, async () => {
  const id = U("hold");
  await put(id, 30, 1000, "PURCHASE", "Plan: Starter", "h1"); // still alive for 3 days
  const made = await res.createGenerationHeld(id, 400, { userId: id, status: "pending", prompt: "p", model: "soul_v2", kind: "image", creditsHeld: 400 });
  assert.ok("row" in made);
  // time passes: move the plan payment back so its period ended while the job runs
  await db.creditLedger.updateMany({ where: { userId: id, externalId: "h1" }, data: { createdAt: ago(40) } });
  assert.equal(await credits.getUsableBalance(id), 400, "the expired credits cover the held price only");
  assert.equal(await res.freeCredits(id), 0, "nothing new can start");
  assert.equal(await expiry.expireCredits(id), 1000, "the job itself can run (it does not look at holds; the cron skips people with a job running)");
  await db.creditLedger.deleteMany({ where: { userId: id, reason: "EXPIRE" } }); // undo, to test the charge while the hold exists
  await credits.spendCredits(id, 400, "the held render finishes");
  assert.equal(await credits.getBalance(id), 600, "charged once from the held credits");
  await db.generation.deleteMany({ where: { userId: id } });
  assert.equal(await credits.getUsableBalance(id), 0, "after the job settles the rest is expired");
  assert.ok((await credits.getBalance(id)) >= 0);
});

test("the dry run: setting a start date later leaves everything usable until then", { skip }, async () => {
  const id = U("dry");
  const keep = process.env.CREDIT_EXPIRY_START;
  process.env.CREDIT_EXPIRY_START = new Date(Date.now() + 30 * DAY).toISOString();
  try {
    await put(id, 100, 1000, "PURCHASE", "Plan: Starter", "d1");
    await put(id, 200, 500, "PURCHASE", "Top-up: 50 credits", "d2");
    assert.equal((await sub.unusable(id)).expired, 0, "before the start date nothing is lost");
    assert.equal(await expiry.expireCredits(id), 0, "the job does nothing before the start date");
    const state = await expiry.creditState(id, undefined, Date.now() + 31 * DAY);
    assert.equal(state.expiredUnswept, 0, "inside the grace week");
    assert.equal((await expiry.creditState(id, undefined, Date.now() + 38 * DAY)).expiredUnswept, 1000, "the old plan grant goes after the grace");
  } finally { process.env.CREDIT_EXPIRY_START = keep; }
});

test("the people the job looks at are only those with purchases", { skip }, async () => {
  const ids: string[] = await expiry.usersToExpire();
  assert.ok(ids.includes(U("order")));
});
