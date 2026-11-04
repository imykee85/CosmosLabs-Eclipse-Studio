// Atlas plans run on the server: the real database and the real step logic, with fake image and video starts.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let s: any, db: any;
const U = "user_plan_a", V = "user_plan_b";
const spec = { title: "Ad", hero: "A sneaker on a wet street", scenes: ["Close-up of the laces", "Mid-stride"], video: "Move through image 1 to 3", seconds: 8, ratio: "16:9" };

// A fake world: images and the video finish when `done` says so; every start is recorded.
function world() {
  const w = { images: [] as { prompt: unknown; references?: unknown }[], videos: [] as { refs?: unknown; model?: unknown }[], done: new Set<string>(), failed: new Map<string, string>(), failStartAt: -1, n: 0 };
  const deps = {
    startImage: async (i: { prompt: unknown; references?: unknown }) => {
      if (w.failStartAt === w.images.length) { w.images.push(i); return { ok: false, status: 400, error: "That model is busy." }; }
      w.images.push(i); return { ok: true, item: { id: `img${++w.n}` } };
    },
    startVideo: async (i: { refs?: unknown; model?: unknown }) => { w.videos.push(i); return { ok: true, item: { id: "vid1" } }; },
    check: async (_k: string, id: string) => (w.failed.has(id) ? { status: "failed", error: w.failed.get(id) } : w.done.has(id) ? { status: "completed" } : { status: "pending" }),
  };
  return { w, deps };
}
const make = async (user = U) => { const r = await s.createPlan({ userId: user, personId: user, projectId: "p1", spec }); assert.equal(r.ok, true, JSON.stringify(r)); return r.row.id as string; };

before(async () => {
  if (skip) return;
  s = await import("../../src/lib/agent-plan-server");
  db = (await import("../../src/lib/db")).db;
  await db.agentPlan.deleteMany({ where: { userId: { in: [U, V] } } });
});
after(async () => { if (skip) return; await db.agentPlan.deleteMany({ where: { userId: { in: [U, V] } } }); await db.$disconnect(); });

test("a plan runs hero, then the pictures from the hero, then one video from all of them, with no browser", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  let row = await s.advancePlan(id, deps);
  assert.equal(w.images.length, 1, "the hero starts first");
  assert.equal(row.status, "running");
  row = await s.advancePlan(id, deps);
  assert.equal(w.images.length, 1, "nothing more starts while the hero runs");
  w.done.add("img1");
  row = await s.advancePlan(id, deps);
  assert.equal(w.images.length, 3, "the two pictures start once the hero is done");
  assert.deepEqual(w.images[1].references, [{ type: "render", id: "img1" }], "made from the hero");
  assert.match(String(w.images[1].prompt), /Image 1 is the hero image/);
  assert.equal(w.videos.length, 0, "no video before the pictures are done");
  w.done.add("img2"); row = await s.advancePlan(id, deps);
  assert.equal(w.videos.length, 0);
  w.done.add("img3"); row = await s.advancePlan(id, deps);
  assert.equal(w.videos.length, 1, "one video");
  assert.deepEqual(w.videos[0].refs, [{ type: "render", id: "img1" }, { type: "render", id: "img2" }, { type: "render", id: "img3" }], "all pictures, hero first");
  assert.equal(w.videos[0].model, "seedance_2_5");
  assert.equal(row.status, "running");
  w.done.add("vid1"); row = await s.advancePlan(id, deps);
  assert.equal(row.status, "done");
  assert.deepEqual(row.steps.map((x: { state: string }) => x.state), ["done", "done", "done"]);
  const again = await s.advancePlan(id, deps);
  assert.equal(w.videos.length, 1, "a finished plan never starts anything again");
  assert.equal(again.status, "done");
});

test("a failed step stops the plan and nothing later is started", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  await s.advancePlan(id, deps);
  w.failed.set("img1", "The content filter blocked this.");
  const row = await s.advancePlan(id, deps);
  assert.equal(row.status, "failed");
  assert.match(row.note, /content filter/);
  assert.equal(w.images.length, 1); assert.equal(w.videos.length, 0);
  assert.equal(row.steps[0].state, "failed");
});

test("a scene that cannot start stops the plan before any video", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  await s.advancePlan(id, deps);
  w.done.add("img1"); w.failStartAt = 2; // the second scene
  const row = await s.advancePlan(id, deps);
  assert.equal(row.status, "failed");
  assert.equal(w.videos.length, 0);
});

test("two passes at the same time never start a step twice (one caller works, the other just reads)", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  await Promise.all([s.advancePlan(id, deps), s.advancePlan(id, deps), s.advancePlan(id, deps)]);
  assert.equal(w.images.length, 1, "only one hero was started");
});

test("Stop ends the plan; a step that was running does not bring it back", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  await s.advancePlan(id, deps);
  const stopped = await s.cancelPlan(id, U);
  assert.equal(stopped.status, "canceled");
  w.done.add("img1");
  const row = await s.advancePlan(id, deps);
  assert.equal(row.status, "canceled");
  assert.equal(w.images.length, 1, "nothing else started");
  assert.equal((await s.cancelPlan(id, U))?.status, "canceled", "stopping twice is harmless");
});

test("another account cannot stop or read my plan, and a plan past its deadline is given up", { skip }, async () => {
  const id = await make();
  const other = await s.cancelPlan(id, V);
  assert.equal(other, null, "not theirs");
  assert.equal((await db.agentPlan.findUnique({ where: { id } })).status, "running");
  await db.agentPlan.update({ where: { id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
  const { deps } = world();
  const row = await s.advancePlan(id, deps);
  assert.equal(row.status, "failed");
  assert.match(row.note, /too long/);
});

test("the hand-over token is only valid for its own plan", { skip }, async () => {
  const t = s.planToken("plan1");
  assert.equal(s.validPlanToken("plan1", t), true);
  assert.equal(s.validPlanToken("plan2", t), false);
  assert.equal(s.validPlanToken("plan1", null), false);
  assert.equal(s.validPlanToken("plan1", "x"), false);
});

test("drive keeps going to the end without anyone looking", { skip }, async () => {
  const id = await make();
  const { w, deps } = world();
  // everything finishes straight away
  w.done.add("img1"); w.done.add("img2"); w.done.add("img3"); w.done.add("vid1");
  const row = await s.drive(id, deps, 20000, false);
  assert.equal(row.status, "done");
  assert.equal(w.images.length, 3); assert.equal(w.videos.length, 1);
});

test("at most two plans run at once per account", { skip }, async () => {
  await make(V); await make(V);
  const r = await s.createPlan({ userId: V, personId: V, projectId: null, spec });
  assert.equal(r.ok, false); assert.equal(r.status, 429);
});
