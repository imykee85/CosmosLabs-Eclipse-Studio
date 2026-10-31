import test from "node:test";
import assert from "node:assert/strict";
import { GROWTH_MAX_PER_SECOND, STARTER_MAX_PER_SECOND, videoCostPerSecond, videoTierFor } from "../../src/lib/video-tier";
import { VIDEO_MODELS, videoModelById } from "../../src/lib/video-models";
import { atlasDailyLimit } from "../../src/lib/access";
import { planAllows } from "../../src/lib/access-table";

// Which plan can use which video model and quality (owner 2026-10-31): by the maker's cost per second. Starter up to $0.15, Growth up to $0.40, Scale everything.
const tier = (id: string, res?: string) => videoTierFor(videoModelById(id)!, res);

test("Seedance by quality: 480p on Starter, 720p on Growth, 1080p and 4K on Scale", () => {
  assert.equal(tier("seedance_2_5", "480p"), "starter");
  assert.equal(tier("seedance_2_5", "720p"), "growth");
  assert.equal(tier("seedance_2_5", "1080p"), "scale");
  assert.equal(tier("seedance_2_0", "480p"), "starter");
  assert.equal(tier("seedance_2_0", "720p"), "starter", "$0.15 a second is exactly the Starter limit");
  assert.equal(tier("seedance_2_0", "1080p"), "growth");
  assert.equal(tier("seedance_2_0", "4k"), "scale");
});

test("Kling 3.0: Standard and Pro on Starter, 4K on Scale", () => {
  assert.equal(tier("kling_3_std"), "starter");
  assert.equal(tier("kling_3_pro"), "starter");
  assert.equal(tier("kling_3_4k"), "scale");
});

test("every connected video model and quality has a tier that matches its cost per second", () => {
  let n = 0;
  for (const m of VIDEO_MODELS) {
    if (!m.live) continue;
    for (const key of Object.keys(m.live.price.usd)) {
      const res = key === "default" ? undefined : key;
      const cost = videoCostPerSecond(m, res)!;
      const t = videoTierFor(m, res);
      n++;
      if (cost <= STARTER_MAX_PER_SECOND + 1e-9) assert.equal(t, "starter", `${m.id} ${key}`);
      else if (cost <= GROWTH_MAX_PER_SECOND + 1e-9) assert.equal(t, "growth", `${m.id} ${key}`);
      else assert.equal(t, "scale", `${m.id} ${key}`);
    }
  }
  assert.ok(n > 40);
});

test("a model with no price table is left to Scale", () => {
  const m = VIDEO_MODELS.find((x) => !x.live)!;
  assert.equal(videoTierFor(m, undefined), "scale");
});

test("Atlas: Starter has a daily allowance (30), Growth and Scale and the owner have none", () => {
  assert.equal(planAllows("free", "atlas"), false);
  assert.equal(planAllows("starter", "atlas"), true);
  assert.equal(atlasDailyLimit({ plan: "starter", admin: false }), 30);
  assert.equal(atlasDailyLimit({ plan: "growth", admin: false }), null);
  assert.equal(atlasDailyLimit({ plan: "scale", admin: false }), null);
  assert.equal(atlasDailyLimit({ plan: "starter", admin: true }), null);
  process.env.ATLAS_DAILY_MESSAGES_STARTER = "12";
  try { assert.equal(atlasDailyLimit({ plan: "starter", admin: false }), 12); } finally { delete process.env.ATLAS_DAILY_MESSAGES_STARTER; }
});
