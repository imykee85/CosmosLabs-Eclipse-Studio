// Retouch with a real mask: startRender -> OpenAI edit request, against a throwaway Postgres, a fake R2 and a fake OpenAI (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server, oa: Server;
const seen: Record<string, unknown>[] = [];
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const A = "user_mask_a", B = "user_mask_b";

async function png(w: number, h: number, rgb: [number, number, number]) {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
}
async function sel(w: number, h: number, x: number, y: number, s: number) {
  const sharp = (await import("sharp")).default;
  const sq = await sharp({ create: { width: s, height: s, channels: 4, background: { r: 59, g: 130, b: 246, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: sq, left: x, top: y }]).png().toBuffer();
}

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const out = await png(200, 100, [5, 200, 5]);
  oa = createServer(async (req, res) => {
    seen.push(JSON.parse((await body(req)).toString()));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: out.toString("base64") }], output_format: "png", usage: { total_tokens: 1 } }));
  });
  const p1 = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  const p2 = await new Promise<number>((r) => oa.listen(0, "127.0.0.1", () => r((oa.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${p1}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", OPENAI_API_KEY: "test", OPENAI_BASE_URL: `http://127.0.0.1:${p2}`, CREDITS_ENABLED: "0" });
  lib = { start: await import("../../src/lib/start-render"), db: (await import("../../src/lib/db")).db };
  await clean();
  objects.set("/bkt/u/m/pic.png", await png(200, 100, [200, 30, 30]));
  objects.set("/bkt/u/m/mask.png", await sel(100, 50, 20, 10, 20));
});
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.upload.deleteMany({ where: { userId: { in: [A, B] } } });
};
after(async () => { if (skip) return; await new Promise((r) => setTimeout(r, 300)); await clean(); await lib.db.$disconnect(); r2.close(); oa.close(); });

const pic = (userId: string) => lib.db.generation.create({ data: { userId, prompt: "a car", status: "completed", storageKey: "u/m/pic.png", contentType: "image/png", width: 200, height: 100, kind: "image" } });
const maskRow = (userId: string) => lib.db.upload.create({ data: { userId, kind: "asset", name: "Retouch mask", storageKey: "u/m/mask.png", contentType: "image/png", sizeBytes: 100, width: 100, height: 50 } });

test("a mask goes to the picture editor as a mask the size of the picture, transparent where selected", { skip }, async () => {
  const g = await pic(A), m = await maskRow(A);
  const r = await lib.start.startRender({ userId: A, prompt: "Remove what is inside the masked area", model: "gpt_image_2_5_sunburst", aspectRatio: "auto", references: [{ type: "render", id: g.id }], maskId: m.id });
  assert.ok(r.ok, JSON.stringify(r));
  for (let i = 0; i < 50 && !seen.length; i++) await new Promise((x) => setTimeout(x, 100));
  assert.equal(seen.length, 1);
  const sent = seen[0] as { images: { image_url: string }[]; mask: { image_url: string } };
  assert.equal(sent.images.length, 1);
  assert.match(sent.mask.image_url, /^data:image\/png;base64,/);
  const sharp = (await import("sharp")).default;
  const maskPng = Buffer.from(sent.mask.image_url.split(",")[1], "base64");
  const meta = await sharp(maskPng).metadata();
  assert.equal(meta.width, 200); assert.equal(meta.height, 100);
  const { data, info } = await sharp(maskPng).raw().toBuffer({ resolveWithObject: true });
  const a = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
  assert.equal(a(60, 40), 0); // the selection (20..40 x 10..30 at half size = 40..80 x 20..60): editable
  assert.equal(a(150, 80), 255); // elsewhere: kept
});

test("refused: a mask on a model that cannot take one, another person's mask, a mask with no picture", { skip }, async () => {
  const g = await pic(A), mine = await maskRow(A), theirs = await maskRow(B);
  const noMask = await lib.start.startRender({ userId: A, prompt: "x", model: "soul_v2", references: [{ type: "render", id: g.id }], maskId: mine.id });
  assert.ok(!noMask.ok && noMask.status === 400);
  const other = await lib.start.startRender({ userId: A, prompt: "x", model: "gpt_image_2_5_sunburst", references: [{ type: "render", id: g.id }], maskId: theirs.id });
  assert.ok(!other.ok && other.status === 400);
  const noPic = await lib.start.startRender({ userId: A, prompt: "x", model: "gpt_image_2_5_sunburst", maskId: mine.id });
  assert.ok(!noPic.ok && noPic.status === 400);
});
