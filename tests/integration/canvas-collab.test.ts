// Canvas sharing, comments and templates against a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let c: any, db: any;
const A = "user_cc_a", B = "user_cc_b", TEAM = "org_cc_team";
let canvasId = "", genId = "", otherGenId = "";

before(async () => {
  if (skip) return;
  c = await import("../../src/lib/canvas-collab");
  db = (await import("../../src/lib/db")).db;
  await clean();
  const g = await db.generation.create({ data: { userId: A, prompt: "a fox", status: "completed", storageKey: "u/a/fox.png", contentType: "image/png", model: "soul_v2" } });
  const other = await db.generation.create({ data: { userId: A, prompt: "not on the canvas", status: "completed", storageKey: "u/a/secret.png", contentType: "image/png", model: "soul_v2" } });
  genId = g.id; otherGenId = other.id;
  const cv = await db.canvas.create({ data: { userId: A, projectId: "p1", name: "Shared one", nodeCount: 1, data: { nodes: [{ id: "n1", type: "generator", position: { x: 0, y: 0 }, data: { gens: [genId] } }], edges: [] } } });
  canvasId = cv.id;
});
const clean = async () => {
  await db.canvas.deleteMany({ where: { userId: { in: [A, B, TEAM] } } });
  await db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await db.canvasTemplate.deleteMany({ where: { userId: { in: [A, B, TEAM] } } });
};
after(async () => { if (skip) return; await clean(); await db.$disconnect(); });

test("a share link is on or off, stays the same while on, and dies when turned off", { skip }, async () => {
  assert.deepEqual(await c.getShare(A, canvasId), { ok: true, enabled: false, path: null });
  const [x, y] = await Promise.all([c.setShare(A, canvasId, true), c.setShare(A, canvasId, true)]);
  assert.ok(x.ok && y.ok && x.path === y.path, "two taps at once give one link");
  assert.match(x.path, /^\/v\/[A-Za-z0-9_-]{20,}$/);
  const again = await c.setShare(A, canvasId, true);
  assert.equal(again.path, x.path);
  const token = x.path.slice(3);
  assert.ok(await c.sharedMedia(token, genId), "the picture the canvas shows is served");
  const off = await c.setShare(A, canvasId, false);
  assert.deepEqual(off, { ok: true, enabled: false, path: null });
  assert.equal(await c.sharedMedia(token, genId), null, "the old address stops working at once");
  const fresh = await c.setShare(A, canvasId, true);
  assert.notEqual(fresh.path, x.path, "turning it back on makes a new address");
});

test("someone else cannot read or change another workspace's link", { skip }, async () => {
  assert.equal((await c.getShare(B, canvasId)).ok, false);
  assert.equal((await c.setShare(B, canvasId, true)).ok, false);
});

test("a shared canvas serves only what it contains, only while finished and not binned", { skip }, async () => {
  const token = (await c.getShare(A, canvasId)).path.slice(3);
  assert.equal(await c.sharedMedia(token, otherGenId), null, "a picture the canvas does not mention is never served");
  assert.equal(await c.sharedMedia("x".repeat(24), genId), null, "a wrong token serves nothing");
  assert.equal(await c.sharedMedia(token, "../etc"), null);
  await db.generation.update({ where: { id: genId }, data: { deletedAt: new Date() } });
  assert.equal(await c.sharedMedia(token, genId), null, "a binned picture is gone from the link");
  await db.generation.update({ where: { id: genId }, data: { deletedAt: null } });
  assert.ok(await c.sharedMedia(token, genId));
  await db.canvas.update({ where: { id: canvasId }, data: { deletedAt: new Date() } });
  assert.equal(await c.sharedMedia(token, genId), null, "a canvas in Recently deleted is not shared");
  await db.canvas.update({ where: { id: canvasId }, data: { deletedAt: null } });
});

test("comments: add (pinned or not), list for the workspace, resolve, delete", { skip }, async () => {
  assert.equal((await c.addComment(A, A, "Ann", canvasId, "   ", null)).ok, false);
  const one = await c.addComment(A, A, "Ann", canvasId, "Make the fox redder", "n1");
  const two = await c.addComment(A, A, "Ann", canvasId, "Looks great", { evil: 1 });
  assert.ok(one.ok && two.ok);
  assert.equal(one.item.nodeId, "n1");
  assert.equal(two.item.nodeId, null, "a bad node id is dropped, not stored");
  const list = await c.listComments(A, B, canvasId);
  assert.ok(list.ok && list.items.length === 2);
  assert.ok(list.items.every((i: { mine: boolean }) => i.mine === false), "another member sees them as not theirs");
  assert.equal((await c.listComments(B, B, canvasId)).ok, false, "another workspace sees nothing");
  assert.ok((await c.setResolved(A, canvasId, one.item.id, true)).ok);
  assert.equal((await c.listComments(A, A, canvasId)).items.find((i: { id: string }) => i.id === one.item.id).resolved, true);
  assert.equal((await c.setResolved(B, canvasId, one.item.id, false)).ok, false);
  assert.equal((await c.deleteComment(B, canvasId, one.item.id)).ok, false);
  assert.ok((await c.deleteComment(A, canvasId, one.item.id)).ok);
  assert.equal((await c.listComments(A, A, canvasId)).items.length, 1);
  const long = await c.addComment(A, A, "Ann", canvasId, "x".repeat(3000), null);
  assert.equal(long.item.text.length, 1000);
});

test("deleting a canvas takes its comments and its link with it", { skip }, async () => {
  const cv = await db.canvas.create({ data: { userId: A, projectId: "p1", name: "Temp", nodeCount: 0, data: { nodes: [], edges: [] } } });
  await c.addComment(A, A, "Ann", cv.id, "hi", null);
  await c.setShare(A, cv.id, true);
  await db.canvas.delete({ where: { id: cv.id } });
  assert.equal(await db.canvasComment.count({ where: { canvasId: cv.id } }), 0);
  assert.equal(await db.canvasShare.count({ where: { canvasId: cv.id } }), 0);
});

test("templates are kept per workspace (a team shares them), limited and validated", { skip }, async () => {
  assert.equal((await c.addTemplate(A, "  ", [{}], [])).ok, false);
  assert.equal((await c.addTemplate(A, "t", [], [])).ok, false, "an empty template is refused");
  const ok = await c.addTemplate(TEAM, "Product ad", [{ id: "a", type: "text", position: { x: 0, y: 0 }, data: {} }], []);
  assert.ok(ok.ok);
  assert.equal((await c.listTemplates(TEAM)).length, 1);
  assert.equal((await c.listTemplates(A)).length, 0, "a personal workspace does not see the team's templates");
  assert.equal(await c.removeTemplate(A, ok.item.id), false, "someone else cannot delete it");
  assert.equal(await c.removeTemplate(TEAM, ok.item.id), true);
  for (let i = 0; i < c.MAX_TEMPLATES; i++) assert.ok((await c.addTemplate(B, `t${i}`, [{ id: "a" }], [])).ok);
  const over = await c.addTemplate(B, "one too many", [{ id: "a" }], []);
  assert.ok(!over.ok && over.status === 409);
});
