import test from "node:test";
import assert from "node:assert/strict";
import { BENEFITS, FEATURE_MIN, PLAN_RANK, planAllows, plansFor, upgradeText, type Feature, type PlanId } from "../../src/lib/access-table";

// The owner's table (2026-10-21): Free nothing but 2 images, Starter = studios + plan tools + certificates/portfolio + academy + top-ups + API + teams,
// Atlas on Starter has a daily allowance (30 messages), Growth adds Canvas, Agents, Core, Scale adds builds and workflows (Soon).
const MATRIX: Record<Feature, PlanId> = {
  studios: "starter",
  plan_tools: "starter", certificates: "starter", portfolio: "starter", api: "starter", teams: "starter",
  atlas: "starter", canvas: "growth", agents: "growth", core: "growth", builds: "scale", workflows: "scale",
};

test("the feature table is the owner's", () => { assert.deepEqual(FEATURE_MIN, MATRIX); });

test("every plan includes the one before it", () => {
  const order: PlanId[] = ["free", "starter", "growth", "scale"];
  for (const f of Object.keys(MATRIX) as Feature[]) {
    let seen = false;
    for (const p of order) { const ok = planAllows(p, f); if (seen) assert.ok(ok, `${p} must include ${f}`); if (ok) seen = true; }
  }
  assert.ok(order.every((p, i) => PLAN_RANK[p] === i));
});

test("free has none of the plan features, scale has all", () => {
  for (const f of Object.keys(MATRIX) as Feature[]) { assert.equal(planAllows("free", f), false, f); assert.equal(planAllows("scale", f), true, f); }
  assert.equal(planAllows("starter", "atlas"), true);
  assert.equal(planAllows("starter", "canvas"), false);
  assert.equal(planAllows("growth", "canvas"), true);
  assert.equal(planAllows("growth", "builds"), false);
});

test("the pop-up sentences name the plans that unlock a feature", () => {
  assert.equal(plansFor("canvas"), "the Growth and Scale plans");
  assert.equal(plansFor("builds"), "the Scale plan");
  assert.equal(plansFor("api"), "every paid plan");
  assert.match(upgradeText("canvas"), /^Canvas is included in the Growth and Scale plans\.$/);
  assert.match(upgradeText("atlas"), /^Atlas is included in every paid plan\.$/);
  assert.match(upgradeText("agents"), /^Your own agents are included in/);
});

test("the benefit list on the cards: Starter's nine come first and every one is on Starter", () => {
  assert.equal(BENEFITS.slice(0, 9).every((b) => b.min === "starter"), true);
  assert.equal(BENEFITS.filter((b) => b.min === "starter").length, 9);
  assert.ok(BENEFITS.some((b) => b.label === "Automated workflows" && b.soon), "workflows is shown as Soon");
  assert.equal(BENEFITS.find((b) => b.label.startsWith("Core"))?.min, "growth");
  assert.equal(BENEFITS.find((b) => b.label === "No daily limit on Core")?.min, "scale");
});
