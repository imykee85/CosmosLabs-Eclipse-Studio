// The server side of the video plan limits (owner 2026-10-31): videoTierGate refuses a model and quality the workspace's plan does not include, with the
// UPGRADE answer, and lets the rest through. Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { before } from "node:test";
import assert from "node:assert/strict";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, gate: any, vm: any;
const U = { free: "user_vtier_free", starter: "user_vtier_starter", growth: "user_vtier_growth", scale: "user_vtier_scale" };

before(async () => {
  if (skip) return;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x"; process.env.CLERK_SECRET_KEY = "sk_test_x"; // plan checks only run with sign-in on
  delete process.env.PLAN_GATING; delete process.env.ADMIN_EMAILS;
  db = (await import("../../src/lib/db")).db;
  gate = await import("../../src/lib/video-gate");
  vm = await import("../../src/lib/video-models");
  for (const [plan, id] of Object.entries(U)) {
    if (plan === "free") continue;
    await db.billingSettings.upsert({ where: { userId: id }, create: { userId: id, planOverride: plan }, update: { planOverride: plan } });
  }
});

const m = (id: string) => vm.videoModelById(id);

test("Starter: cheaper video only; Growth adds the mid-priced; Scale everything", { skip }, async () => {
  assert.equal(await gate.videoTierGate(U.starter, U.starter, m("seedance_2_5"), "480p"), null);
  const s720 = await gate.videoTierGate(U.starter, U.starter, m("seedance_2_5"), "720p");
  assert.deepEqual([s720.status, s720.code, s720.need], [402, "UPGRADE", "growth"]);
  assert.match(s720.error, /Seedance 2\.5 at 720p is included in the Growth plan and above/);
  assert.equal(await gate.videoTierGate(U.starter, U.starter, m("kling_3_pro"), undefined), null);
  assert.equal((await gate.videoTierGate(U.starter, U.starter, m("kling_3_4k"), undefined)).need, "scale");

  assert.equal(await gate.videoTierGate(U.growth, U.growth, m("seedance_2_5"), "720p"), null);
  assert.equal((await gate.videoTierGate(U.growth, U.growth, m("seedance_2_5"), "1080p")).need, "scale");
  assert.equal((await gate.videoTierGate(U.growth, U.growth, m("seedance_2_0"), "4k")).need, "scale");

  for (const [id, res] of [["seedance_2_5", "1080p"], ["seedance_2_0", "4k"], ["kling_3_4k", undefined]] as const) assert.equal(await gate.videoTierGate(U.scale, U.scale, m(id), res), null, `${id} ${res ?? ""}`);
});

test("a workspace with no plan is refused anything above Starter's tier, and PLAN_GATING=off opens everything", { skip }, async () => {
  assert.equal((await gate.videoTierGate(U.free, U.free, m("seedance_2_5"), "720p")).need, "growth");
  process.env.PLAN_GATING = "off";
  try { assert.equal(await gate.videoTierGate(U.free, U.free, m("seedance_2_5"), "1080p"), null); } finally { delete process.env.PLAN_GATING; }
});
