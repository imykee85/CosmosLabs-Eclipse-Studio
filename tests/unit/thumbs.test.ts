// Thumbnails against a fake R2 (no real keys): made once, kept, small, and removed with the original.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import sharp from "sharp";

const objects = new Map<string, Buffer>();
let r2: Server;
let puts = 0;
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let thumbs: any;

before(async () => {
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { puts++; objects.set(path, await body(req)); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    const o = objects.get(path);
    if (!o) { res.statusCode = 404; res.end(); return; }
    res.setHeader("Content-Length", String(o.length)); res.setHeader("Content-Type", "application/octet-stream");
    res.end(req.method === "HEAD" ? undefined : o);
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt" });
  thumbs = await import("../../src/lib/thumbs");
  const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toBuffer();
  objects.set("/bkt/u/a/pic.png", big);
});
after(() => r2?.close());

test("a thumbnail is made once, fits in 480 px and is kept next to the original", async () => {
  const a = await thumbs.thumbForKey("u/a/pic.png");
  const meta = await sharp(Buffer.from(a)).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 480);
  assert.equal(meta.height, 320);
  assert.ok(objects.has("/bkt/thumbs/u/a/pic.png.webp"));
  const before = puts;
  const b = await thumbs.thumbForKey("u/a/pic.png");
  assert.equal(puts, before, "second ask reads the kept copy");
  assert.equal(Buffer.compare(Buffer.from(a), Buffer.from(b)), 0);
});

test("deleting the thumbnail removes the kept copy and never throws", async () => {
  await thumbs.deleteThumb("u/a/pic.png");
  assert.equal(objects.has("/bkt/thumbs/u/a/pic.png.webp"), false);
  await thumbs.deleteThumb(null);
});
