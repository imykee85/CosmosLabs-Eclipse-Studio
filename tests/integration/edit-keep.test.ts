// Keeping an edit as a version and the editing timeline, against a throwaway Postgres and a fake R2 (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server;
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const A = "user_edit_a", B = "user_edit_b";

async function png(w: number, h: number, rgb: [number, number, number]) {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
}
async function maskPng(w: number, h: number, x: number, y: number, s: number) {
  const sharp = (await import("sharp")).default;
  const sq = await sharp({ create: { width: s, height: s, channels: 4, background: { r: 59, g: 130, b: 246, alpha: 1 } } }).png().toBuffer();
  return (await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: sq, left: x, top: y }]).png().toBuffer()).toString("base64");
}

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt" });
  lib = { keep: await import("../../src/lib/edit/keep"), db: (await import("../../src/lib/db")).db };
  await clean();
  objects.set("/bkt/u/edit/orig.png", await png(200, 200, [200, 30, 30]));
  objects.set("/bkt/u/edit/res1.png", await png(200, 200, [10, 20, 220]));
  objects.set("/bkt/u/edit/res2.png", await png(200, 200, [10, 220, 20]));
});
const clean = async () => { await lib.db.generation.deleteMany({ where: { userId: { in: [A, B] } } }); };
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); r2.close(); });

const gen = (userId: string, data: Record<string, unknown>) => lib.db.generation.create({ data: { userId, prompt: "a car", status: "completed", storageKey: "u/edit/orig.png", contentType: "image/png", width: 200, height: 200, kind: "image", ...data } });

test("Edit: a kept render becomes a child version with the person's own words, and the timeline shows the branch", { skip }, async () => {
  const orig = await gen(A, {});
  const r1 = await gen(A, { prompt: "wrapped prompt", storageKey: "u/edit/res1.png" });
  const r2_ = await gen(A, { prompt: "wrapped prompt 2", storageKey: "u/edit/res2.png" });
  const k1 = await lib.keep.keepEdit(A, { parentId: orig.id, resultId: r1.id, op: "prompt", prompt: "make it night" });
  assert.ok(k1.ok); assert.equal(k1.id, r1.id);
  const k2 = await lib.keep.keepEdit(A, { parentId: orig.id, resultId: r2_.id, op: "visual", prompt: "", pins: [{ x: 0.4, y: 2, text: "body yellow" }, { x: "bad" }] });
  assert.ok(k2.ok);
  const row = await lib.db.generation.findUnique({ where: { id: r2_.id } });
  assert.deepEqual(row.params.pins, [{ x: 0.4, y: 1, text: "body yellow" }]); // clamped, the bad pin dropped
  assert.equal(row.params.aiEdited, true);
  // an edit of the first edit: a branch below it
  const r3 = await gen(A, { storageKey: "u/edit/res2.png" });
  await lib.keep.keepEdit(A, { parentId: r1.id, resultId: r3.id, op: "prompt", prompt: "add rain" });
  for (const start of [orig.id, r3.id]) { // from the original or from the deepest step, the same tree comes back
    const steps = await lib.keep.editHistory(A, start);
    assert.equal(steps.length, 4);
    assert.equal(steps[0].id, orig.id); assert.equal(steps[0].op, "original");
    assert.deepEqual(steps.find((s: { id: string }) => s.id === r1.id), { id: r1.id, parentId: orig.id, op: "prompt", prompt: "make it night", createdAt: steps[1].createdAt });
    assert.equal(steps.find((s: { id: string }) => s.id === r3.id).parentId, r1.id);
    assert.equal(steps.filter((s: { parentId: string | null }) => s.parentId === orig.id).length, 2); // two branches from the original
  }
});

test("Retouch: only the selected area is replaced, kept once, and the selection is stored", { skip }, async () => {
  const orig = await gen(A, { storageKey: "u/edit/orig.png" });
  const raw = await gen(A, { storageKey: "u/edit/res1.png" });
  const mask = await maskPng(200, 200, 80, 80, 40);
  const k = await lib.keep.keepEdit(A, { parentId: orig.id, resultId: raw.id, op: "replace", prompt: "black glass", mask });
  assert.ok(k.ok); assert.notEqual(k.id, raw.id, "a new picture is made");
  const again = await lib.keep.keepEdit(A, { parentId: orig.id, resultId: raw.id, op: "replace", prompt: "black glass", mask });
  assert.equal(again.id, k.id, "keeping the same render twice gives one version");
  const row = await lib.db.generation.findUnique({ where: { id: k.id } });
  assert.equal(row.params.editOf, orig.id); assert.equal(row.params.editRaw, raw.id); assert.equal(row.params.retouched, true); assert.ok(row.params.mask);
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(objects.get(`/bkt/${row.storageKey}`)).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
  assert.deepEqual(px(100, 100), [10, 20, 220]); // inside the selection: the new result
  assert.deepEqual(px(10, 10), [200, 30, 30]); // outside: exactly the original
  assert.deepEqual(px(190, 190), [200, 30, 30]);
  assert.equal((await lib.keep.editHistory(A, k.id)).length, 2);
});

test("refusals: other people's pictures, unfinished ones, bad input", { skip }, async () => {
  const mine = await gen(A, {}), theirs = await gen(B, {}), pending = await gen(A, { status: "pending" });
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: theirs.id, op: "prompt" })).status, 409);
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: pending.id, op: "prompt" })).status, 409);
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: mine.id, op: "prompt" })).status, 400);
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: "x", op: "nope" })).status, 400);
  const raw = await gen(A, {});
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: raw.id, op: "erase" })).status, 400); // no selection
  assert.equal((await lib.keep.keepEdit(A, { parentId: mine.id, resultId: raw.id, op: "erase", mask: Buffer.from("not a png").toString("base64") })).status, 400);
  assert.equal(await lib.keep.editHistory(B, mine.id), null); // somebody else's picture has no timeline for you
});
