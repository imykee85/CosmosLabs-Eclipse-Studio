// Upload links nobody finished are cleaned up after 24 hours; finished ones are never touched.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const U = "user_sweep_a";

before(async () => {
  if (skip) return;
  r2 = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    res.statusCode = 404; res.end();
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt" });
  lib = { sw: await import("../../src/lib/upload-sweep"), db: (await import("../../src/lib/db")).db };
  await lib.db.pendingUpload.deleteMany({ where: { userId: U } });
  await lib.db.upload.deleteMany({ where: { userId: U } });
});
after(async () => { if (skip) return; await lib.db.pendingUpload.deleteMany({ where: { userId: U } }); await lib.db.upload.deleteMany({ where: { userId: U } }); await lib.db.$disconnect(); r2.close(); });

test("old unfinished uploads are deleted, recent and finished ones are kept", { skip }, async () => {
  const old = new Date(Date.now() - 25 * 3600_000);
  const abandoned = `u/${U}/up-aaaaaaaa-0000-0000-0000-000000000001.png`;
  const finished = `u/${U}/up-aaaaaaaa-0000-0000-0000-000000000002.png`;
  const recent = `u/${U}/up-aaaaaaaa-0000-0000-0000-000000000003.png`;
  for (const k of [abandoned, finished, recent]) objects.set(`/bkt/${k}`, Buffer.from("x"));
  await lib.db.pendingUpload.createMany({ data: [{ userId: U, key: abandoned, createdAt: old }, { userId: U, key: finished, createdAt: old }, { userId: U, key: recent }] });
  await lib.db.upload.create({ data: { userId: U, kind: "asset", name: "kept", storageKey: finished, contentType: "image/png", sizeBytes: 1 } });
  const r = await lib.sw.sweepAbandonedUploads();
  assert.deepEqual({ deleted: r.deleted, kept: r.kept }, { deleted: 1, kept: 1 });
  assert.equal(objects.has(`/bkt/${abandoned}`), false, "the abandoned file is gone");
  assert.equal(objects.has(`/bkt/${finished}`), true, "a file a finished upload recorded is kept");
  assert.equal(objects.has(`/bkt/${recent}`), true, "a recent link is left alone");
  assert.equal(await lib.db.pendingUpload.count({ where: { userId: U } }), 1, "only the recent link is still remembered");
});
