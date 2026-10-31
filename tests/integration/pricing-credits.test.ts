// The render holds (batch pricing, resolution pricing) against a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { before } from "node:test";
import assert from "node:assert/strict";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, res: any, credits: any, models: any;
const U = (n: string) => `user_price_${n}`;

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  db = (await import("../../src/lib/db")).db;
  res = await import("../../src/lib/reservations");
  credits = await import("../../src/lib/credits");
  models = await import("../../src/lib/models");
  await db.creditLedger.deleteMany({ where: { userId: { startsWith: "user_price_" } } });
  await db.generation.deleteMany({ where: { userId: { startsWith: "user_price_" } } });
  await db.freeRender.deleteMany({ where: { userId: { startsWith: "user_price_" } } });
});

const base = (userId: string, extra: Record<string, unknown> = {}) => ({ userId, status: "pending", prompt: "p", model: "soul_v2", kind: "image", ...extra });

test("Soul batch: four images started at once hold ONE credit; a fifth starts a new batch", { skip }, async () => {
  const id = U("batch");
  await credits.grantCredits(id, 1000, { reason: "GRANT", provider: "test", externalId: `b-${id}` });
  const batch = { id: "batch-aaaa-1111", size: 4 };
  const one = (n: number) => res.createGenerationHeld(id, 10, base(id, { creditsHeld: 10, params: { batchId: batch.id }, prompt: `p${n}` }), batch);
  const made = await Promise.all([1, 2, 3, 4].map(one));
  assert.ok(made.every((m: { row?: unknown }) => "row" in m));
  const rows = await db.generation.findMany({ where: { userId: id } });
  assert.deepEqual(rows.map((r: { creditsHeld: number }) => r.creditsHeld).sort((a: number, b: number) => a - b), [0, 0, 0, 10], "exactly one pays");
  assert.equal(await res.freeCredits(id), 1000 - 10, "the hold is one credit");
  const fifth = await one(5);
  assert.ok("row" in fifth);
  assert.equal(await res.freeCredits(id), 1000 - 20, "the fifth image is a second batch");
  const other = await res.createGenerationHeld(id, 10, base(id, { creditsHeld: 10, params: { batchId: "batch-bbbb-2222" } }), { id: "batch-bbbb-2222", size: 4 });
  assert.ok("row" in other);
  assert.equal(await res.freeCredits(id), 1000 - 30, "another batch id pays again");
});

test("a 2k render holds the 2k price, and an old row without a price is held at its model and resolution", { skip }, async () => {
  const id = U("hold");
  await credits.grantCredits(id, 1000, { reason: "GRANT", provider: "test", externalId: `h-${id}` });
  const gpt = models.getModelById("gpt_image_2");
  const cost2k = models.chargeFor(gpt, "2k");
  assert.equal(cost2k, 20, "gpt_image_2 at 2k: $0.20 at cost = 2 credits = 20 ledger units");
  const made = await res.createGenerationHeld(id, cost2k, base(id, { model: "gpt_image_2", resolution: "2k", creditsHeld: cost2k }));
  assert.ok("row" in made);
  assert.equal(await res.freeCredits(id), 1000 - 20);
  await db.generation.create({ data: base(id, { model: "gpt_image_2", resolution: "1k" }) }); // an older row: no creditsHeld saved
  assert.equal(await res.freeCredits(id), 1000 - 20 - 6, "priced by its model and resolution (1k = $0.06 = 0.6 credits = 6 ledger units)");
});

test("a render that costs more than the balance is refused, in credits", { skip }, async () => {
  const id = U("poor");
  await credits.grantCredits(id, 30, { reason: "GRANT", provider: "test", externalId: `p-${id}` });
  const out = await res.createGenerationHeld(id, 50, base(id, { creditsHeld: 50 }));
  assert.deepEqual([("row" in out), out.have, out.held, out.locked], [false, 30, 0, 0]);
});

test("subscription alert: an unsubscribed account that cannot pay is told to subscribe, with the code the browser reacts to", { skip }, async () => {
  const { refusal, SUBSCRIBE_CODE } = await import("../../src/lib/subscribe-alert");
  const { chatRefusal } = await import("../../src/lib/chat-credits");
  const id = U("alert");
  await db.freeRender.create({ data: { userId: id, remaining: 0, granted: 2 } }); // used both free images
  assert.deepEqual(await refusal(id, "Soul needs 1 credit."), { error: "You've used your 2 free images. Subscribe to keep creating.", code: SUBSCRIBE_CODE });
  // video, audio and chat on a free account: the same alert at once
  const chat = await chatRefusal(id);
  assert.deepEqual(chat, { error: "You've used your 2 free images. Subscribe to keep creating.", code: SUBSCRIBE_CODE });
  // an account that never had the free images (an older one) is just asked to subscribe
  assert.deepEqual(await refusal(U("older"), "x"), { error: "Subscribe to keep creating.", code: SUBSCRIBE_CODE });
  // saved but locked top-up credits keep their own wording and also carry the code
  const locked = "Your 50 top-up credits are saved but locked until you subscribe to a plan.";
  assert.deepEqual(await refusal(id, locked, true), { error: locked, code: SUBSCRIBE_CODE });
  // a subscribed account gets the usual sentence, no code
  await db.creditLedger.create({ data: { userId: id, delta: 2000, reason: "PURCHASE", provider: "test", externalId: `plan-${id}`, note: "Plan: Starter" } });
  assert.deepEqual(await refusal(id, "Soul needs 1 credit."), { error: "Soul needs 1 credit." });
  assert.equal(await chatRefusal(id), null, "and with credits the message may go ahead");
  // the rule can be switched off together with the top-up lock
  process.env.TOPUP_REQUIRES_SUBSCRIPTION = "off";
  assert.deepEqual(await refusal(U("older"), "usual"), { error: "usual" });
  delete process.env.TOPUP_REQUIRES_SUBSCRIPTION;
});

test("a free account's refused image render carries the alert end to end (start-render path)", { skip }, async () => {
  const { refusal } = await import("../../src/lib/subscribe-alert");
  const id = U("e2e");
  await db.freeRender.create({ data: { userId: id, remaining: 0, granted: 2 } });
  const made = await res.createGenerationHeld(id, 20, base(id, { creditsHeld: 20 }));
  assert.equal("row" in made, false);
  const r = await refusal(id, "n", made.locked > 0);
  assert.equal(r.code, "SUBSCRIBE");
});
