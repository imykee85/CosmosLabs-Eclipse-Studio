// A checked upload is kept under a NEW server-made key, so the signed upload link (valid for an hour) can no longer replace what was scanned.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server;
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const U = "user_rekey_a";

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT" && req.headers["x-amz-copy-source"]) {
      const src = objects.get("/" + decodeURIComponent(String(req.headers["x-amz-copy-source"])));
      const want = req.headers["x-amz-copy-source-if-match"];
      if (!src || (want && want !== '"abc"')) { res.statusCode = 412; res.end(); return; }
      objects.set(path, Buffer.from(src)); res.setHeader("Content-Type", "application/xml"); res.end("<CopyObjectResult><ETag>\"abc\"</ETag></CopyObjectResult>"); return;
    }
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    const o = objects.get(path);
    if (!o) { res.statusCode = 404; res.end(); return; }
    res.setHeader("Content-Length", String(o.length)); res.setHeader("ETag", '"abc"');
    if (req.method === "HEAD") { res.end(); return; }
    const range = req.headers.range?.match(/bytes=(\d+)-(\d+)?/);
    res.end(range ? o.subarray(Number(range[1]), range[2] ? Number(range[2]) + 1 : undefined) : o);
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", UPLOAD_SCAN: "off" });
  lib = { du: await import("../../src/lib/direct-upload"), db: (await import("../../src/lib/db")).db, sharp: (await import("sharp")).default };
  await lib.db.upload.deleteMany({ where: { userId: U } });
});
after(async () => { if (skip) return; await lib.db.upload.deleteMany({ where: { userId: U } }); await lib.db.$disconnect(); r2.close(); });

test("a finished picture upload is stored under a fresh key and the handed-out key is deleted", { skip }, async () => {
  const png = await lib.sharp({ create: { width: 64, height: 48, channels: 3, background: "#c00707" } }).png().toBuffer();
  const key = `u/${U}/up-11111111-2222-3333-4444-555555555555.png`;
  objects.set(`/bkt/${key}`, png);
  const r = await lib.du.finishImage(U, key, { kind: "asset", name: "Test", projectId: null });
  assert.equal(r.ok, true);
  assert.notEqual(r.item.storageKey, key, "the stored key is not the one the upload link points at");
  assert.match(r.item.storageKey, new RegExp(`^u/${U}/up-[0-9a-f-]{36}\\.png$`));
  assert.ok(objects.has(`/bkt/${r.item.storageKey}`), "the checked picture is stored under the new key");
  assert.equal(objects.has(`/bkt/${key}`), false, "the original key no longer holds a file");
  // Using the old link again after finishing finds nothing to finish.
  const again = await lib.du.finishImage(U, key, { kind: "asset", name: "Again", projectId: null });
  assert.equal(again.ok, false);
});

test("a video is copied to a fresh key only while the file is still the one that was checked", { skip }, async () => {
  const st = await import("../../src/lib/storage");
  objects.set(`/bkt/u/${U}/vid-a.mp4`, Buffer.from("video bytes"));
  assert.equal(await st.copyObjectIfMatch(`u/${U}/vid-a.mp4`, `u/${U}/vid-b.mp4`, '"abc"', "video/mp4"), true);
  assert.ok(objects.has(`/bkt/u/${U}/vid-b.mp4`));
  assert.equal(await st.copyObjectIfMatch(`u/${U}/vid-a.mp4`, `u/${U}/vid-c.mp4`, '"changed"', "video/mp4"), false, "a changed file is not copied");
  assert.equal(objects.has(`/bkt/u/${U}/vid-c.mp4`), false);
});
