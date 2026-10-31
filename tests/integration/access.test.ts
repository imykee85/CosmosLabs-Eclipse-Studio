// The plan lookup against a throwaway Postgres: the plan comes from the ledger, a hand-given plan wins, a lapsed or ended plan is Free, and the Core limit follows the plan.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_access_a";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

before(async () => {
  if (skip) return;
  lib = { access: await import("../../src/lib/access"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db, table: await import("../../src/lib/access-table") };
});
const clean = async () => { await lib.db.creditLedger.deleteMany({ where: { userId: A } }); await lib.db.billingSettings.deleteMany({ where: { userId: A } }); };
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); });
beforeEach(async () => { if (skip) return; await clean(); delete process.env.PLAN_GATING; delete process.env.CORE_DAILY_MESSAGES_GROWTH; });
const pay = (plan: string, daysAgo = 0) => lib.credits.grantCredits(A, 2000, { reason: "PURCHASE", provider: "whop", externalId: `pay-${plan}-${daysAgo}-${Math.random()}`, note: `Plan: ${plan}` }).then(async () => {
  if (daysAgo) await lib.db.creditLedger.updateMany({ where: { userId: A, note: `Plan: ${plan}` }, data: { createdAt: new Date(Date.now() - daysAgo * 86400_000) } });
});

test("no payment means Free, and Free has none of the plan features", { skip }, async () => {
  assert.equal(await lib.access.planOf(A), "free");
  const g = await lib.access.gateFeatureFor(A, "canvas");
  assert.equal(g.ok, false); assert.equal(g.status, 402); assert.equal(g.body.code, "UPGRADE"); assert.equal(g.body.need, "growth");
  assert.match(g.body.error, /Canvas is included in the Growth and Scale plans/);
});

test("the plan is the latest recent plan payment", { skip }, async () => {
  await pay("Starter", 10);
  assert.equal(await lib.access.planOf(A), "starter");
  assert.equal((await lib.access.gateFeatureFor(A, "api")).ok, true);
  assert.equal((await lib.access.gateFeatureFor(A, "core")).ok, false);
  await pay("Growth", 1);
  assert.equal(await lib.access.planOf(A), "growth");
  assert.equal((await lib.access.gateFeatureFor(A, "core")).ok, true);
  assert.equal((await lib.access.gateFeatureFor(A, "builds")).ok, false);
  await pay("Scale", 0);
  assert.equal(await lib.access.planOf(A), "scale");
  assert.equal((await lib.access.gateFeatureFor(A, "builds")).ok, true);
});

test("a plan that stopped renewing (older than the window) or was ended by the provider is Free again", { skip }, async () => {
  await pay("Growth", 60);
  assert.equal(await lib.access.planOf(A), "free");
  await clean();
  await pay("Growth", 2);
  await lib.db.billingSettings.upsert({ where: { userId: A }, create: { userId: A, subscriptionEndedAt: new Date() }, update: { subscriptionEndedAt: new Date() } });
  assert.equal(await lib.access.planOf(A), "free");
});

test("a plan the owner gave by hand wins, and 'none' hands control back", { skip }, async () => {
  await lib.db.billingSettings.upsert({ where: { userId: A }, create: { userId: A, planOverride: "growth" }, update: { planOverride: "growth" } });
  assert.equal(await lib.access.planOf(A), "growth");
  await pay("Starter", 1);
  assert.equal(await lib.access.planOf(A), "growth", "given plan wins over the real one");
  await lib.db.billingSettings.update({ where: { userId: A }, data: { planOverride: null } });
  assert.equal(await lib.access.planOf(A), "starter");
  await lib.db.billingSettings.update({ where: { userId: A }, data: { planOverride: "banana" } });
  assert.equal(await lib.access.planOf(A), "starter", "a bad value is ignored");
});

test("PLAN_GATING=off opens everything (the emergency switch)", { skip }, async () => {
  process.env.PLAN_GATING = "off";
  assert.equal((await lib.access.gateFeatureFor(A, "builds")).ok, true);
  assert.equal((await lib.access.accessFor(A, A)).plan, "scale");
});

test("Core's daily limit: Growth has a big number you can change, Scale has none", { skip }, async () => {
  assert.equal(lib.access.coreDailyLimit({ plan: "growth", admin: false }), 150);
  process.env.CORE_DAILY_MESSAGES_GROWTH = "400";
  assert.equal(lib.access.coreDailyLimit({ plan: "growth", admin: false }), 400);
  assert.equal(lib.access.coreDailyLimit({ plan: "scale", admin: false }), null);
  assert.equal(lib.access.coreDailyLimit({ plan: "growth", admin: true }), null, "the owner has none");
});

test("an API key stops working when its owner's plan lapses and works again after subscribing", { skip }, async () => {
  const keys = await import("../../src/lib/api-keys");
  const made = await keys.createKey(A, "t");
  assert.equal(made.ok, true);
  const req = () => new Request("http://x/api/v1/models", { headers: { authorization: `Bearer ${(made as { key: string }).key}` } });
  const lapsed = await keys.authenticateKey(req());
  assert.equal(lapsed.ok, false); assert.equal((lapsed as { status: number }).status, 402);
  await pay("Starter", 1);
  assert.equal((await keys.authenticateKey(req())).ok, true);
  await lib.db.apiKey.deleteMany({ where: { userId: A } });
});
