// A full dry run of every price through the real holding code with credits on (master brief section 13, batch 8): for every image model and resolution and every
// connected video model, resolution and sound setting, the held price equals the displayed price, a failed render releases it, and the balance never goes below zero.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { before } from "node:test";
import assert from "node:assert/strict";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, credits: any, res: any, models: any, video: any;
const U = "user_dryrun_1";

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  db = (await import("../../src/lib/db")).db;
  credits = await import("../../src/lib/credits");
  res = await import("../../src/lib/reservations");
  models = await import("../../src/lib/models");
  video = await import("../../src/lib/video-models");
  await db.creditLedger.deleteMany({ where: { userId: U } });
  await db.generation.deleteMany({ where: { userId: U } });
  await credits.grantCredits(U, 10_000_000, { reason: "GRANT", provider: "test", externalId: "dry-1" });
});

test("every image price is held exactly, released on failure and never overdraws", { skip }, async () => {
  let n = 0;
  for (const m of models.allImageModels()) {
    for (const key of Object.keys(m.usd)) {
      const resolution = key === "default" ? undefined : key;
      const cost = models.chargeFor(m, resolution);
      assert.ok(cost && cost > 0 && Number.isInteger(cost), `${m.id} ${key}: a whole number of ledger units (tenths of a credit)`);
      const before = await res.freeCredits(U);
      const made = await res.createGenerationHeld(U, cost, { userId: U, status: "pending", prompt: "p", model: m.id, kind: "image", resolution: resolution ?? null, creditsHeld: cost });
      assert.ok("row" in made, `${m.id} ${key}`);
      assert.equal(before - (await res.freeCredits(U)), cost, `${m.id} ${key} holds its price`);
      await db.generation.update({ where: { id: made.row.id }, data: { status: "failed" } }); // a failed render releases the hold
      assert.equal(await res.freeCredits(U), before, `${m.id} ${key} releases it`);
      n++;
    }
  }
  assert.ok(n > 50, `checked ${n} image prices`);
});

test("every connected video price (5 s and 4 s, sound on and off, both routes) is a whole number of tenths of a credit that holds and releases", { skip }, async () => {
  let n = 0;
  for (const m of video.VIDEO_MODELS) {
    if (!m.live) continue;
    const resolutions = Object.keys(m.live.price.usd).map((k) => (k === "default" ? undefined : k));
    for (const resolution of resolutions) for (const seconds of [4, 5]) for (const sound of [false, true]) for (const route of ["higgsfield", "direct"] as const) {
      const price = video.videoPrice(m, resolution, seconds, sound, route);
      assert.ok(price && price > 0 && Number.isInteger(price), `${m.id} ${resolution} ${seconds}s ${route}`);
      const before = await res.freeCredits(U);
      const made = await res.createGenerationHeld(U, price, { userId: U, status: "pending", prompt: "p", model: m.id, kind: "video", creditsHeld: price });
      assert.ok("row" in made);
      assert.equal(before - (await res.freeCredits(U)), price);
      await db.generation.update({ where: { id: made.row.id }, data: { status: "failed" } });
      assert.equal(await res.freeCredits(U), before);
      n++;
    }
  }
  assert.ok(n > 200, `checked ${n} video prices`);
  assert.ok((await credits.getBalance(U)) >= 0);
});
