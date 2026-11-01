// Proof of acceptance: the record is made once per person and version, keeps the first time and address, and goes with the account.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let t: any, db: any, v: string;
const A = "user_terms_a", B = "user_terms_b";

before(async () => {
  if (skip) return;
  t = await import("../../src/lib/terms-db");
  v = (await import("../../src/lib/terms")).TERMS_VERSION;
  db = (await import("../../src/lib/db")).db;
  await db.termsAcceptance.deleteMany({ where: { userId: { in: [A, B] } } });
});
after(async () => { if (skip) return; await db.termsAcceptance.deleteMany({ where: { userId: { in: [A, B] } } }); await db.$disconnect(); });

test("nothing is accepted until it is recorded, and one person's record is not another's", { skip }, async () => {
  assert.equal(await t.hasAcceptedTerms(A), false);
  await t.recordAcceptance(A, { ip: "203.0.113.7", userAgent: "TestBrowser/1", source: "sign-up" });
  assert.equal(await t.hasAcceptedTerms(A), true);
  assert.equal(await t.hasAcceptedTerms(B), false);
});

test("recording twice keeps the first time, address and source", { skip }, async () => {
  const first = await db.termsAcceptance.findUnique({ where: { userId_version: { userId: A, version: v } } });
  await new Promise((r) => setTimeout(r, 20));
  await t.recordAcceptance(A, { ip: "198.51.100.9", userAgent: "Other/2", source: "gate" });
  const rows = await db.termsAcceptance.findMany({ where: { userId: A } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ip, "203.0.113.7");
  assert.equal(rows[0].source, "sign-up");
  assert.equal(rows[0].acceptedAt.getTime(), first.acceptedAt.getTime());
  assert.equal(rows[0].version, v);
});

test("an acceptance of an older version does not count for the current one", { skip }, async () => {
  await db.termsAcceptance.create({ data: { userId: B, version: "2000-01-01", source: "gate" } });
  assert.equal(await t.hasAcceptedTerms(B), false);
});
