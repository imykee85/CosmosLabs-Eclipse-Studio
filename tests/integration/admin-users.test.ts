// The owner's Users page data: counts and times per account, never content. Throwaway Postgres; Clerk is unreachable here, so labels fall back to short ids.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any, db: any;
const A = "user_au_alpha01", B = "user_au_bravo02";

before(async () => {
  if (skip) return;
  lib = await import("../../src/lib/admin-users");
  db = (await import("../../src/lib/db")).db;
  await clean();
});
after(async () => { if (skip) return; await clean(); await db.$disconnect(); });
async function clean() {
  await db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await db.audioJob.deleteMany({ where: { userId: { in: [A, B] } } });
  await db.chatSpend.deleteMany({ where: { userId: { in: [A, B] } } });
  await db.creditLedger.deleteMany({ where: { userId: { in: [A, B] } } });
}

test("counts per account, split by week and all time, with no prompts in the result", { skip }, async () => {
  const old = new Date(Date.now() - 30 * 86_400_000);
  await db.generation.create({ data: { userId: A, kind: "image", status: "completed", prompt: "SECRET PROMPT ONE", model: "x" } });
  await db.generation.create({ data: { userId: A, kind: "image", status: "completed", prompt: "SECRET PROMPT TWO", model: "x", createdAt: old } });
  await db.generation.create({ data: { userId: A, kind: "video", status: "completed", prompt: "SECRET PROMPT THREE", model: "x" } });
  await db.generation.create({ data: { userId: A, kind: "image", status: "failed", prompt: "failed one", model: "x" } });
  await db.chatSpend.create({ data: { userId: B, kind: "atlas", usd: 0.01, charged: 5 } });
  await db.creditLedger.create({ data: { userId: B, delta: -30, reason: "CHARGE", note: "private note" } });
  const r = await lib.userActivity(100);
  const a = r.rows.find((x: { id: string }) => x.id === A), b = r.rows.find((x: { id: string }) => x.id === B);
  assert.equal(a.total.images, 2); assert.equal(a.week.images, 1); assert.equal(a.total.videos, 1); assert.equal(a.week.videos, 1);
  assert.equal(b.total.chats, 1); assert.equal(b.total.creditsSpent, 3); assert.equal(b.week.creditsSpent, 3);
  assert.ok(a.lastActive instanceof Date);
  const text = JSON.stringify(r);
  assert.ok(!text.includes("SECRET PROMPT") && !text.includes("private note"), "no content leaves the function");
});
