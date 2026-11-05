// Upscale of a picture and of a clip, against a throwaway Postgres, a fake R2 and a fake Topaz (no real keys): the request fields, the price held, polling,
// saving the result, charging once, failure with nothing charged, and the refusals.
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
const A = "user_topaz_a", B = "user_topaz_b";
const realFetch = globalThis.fetch;
const calls: { method: string; url: string; headers: Record<string, string>; body: string }[] = [];
let imageStatus = ["Processing", "Completed"], videoStatus = ["processing", "complete"], failImage = false;
let outJpeg: Buffer;

async function pic(w: number, h: number, fmt: "png" | "jpeg" = "png") {
  const sharp = (await import("sharp")).default;
  const s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 120, b: 200 } } });
  return fmt === "png" ? s.png().toBuffer() : s.jpeg().toBuffer();
}
const withUrl = (r: Response, url: string) => Object.defineProperty(r, "url", { value: url });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  outJpeg = await pic(400, 200, "jpeg");
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", TOPAZ_API_KEY: "test-key", TOPAZ_CREDIT_USD: "0.05", CREDITS_ENABLED: "1", SUBSCRIPTION_RULE: "off" });
  // The fake Topaz and its download hosts are https addresses answered here; everything else (the fake R2) goes through.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!/^https:\/\/(api\.topazlabs\.com|dl\.test|up\.test)/.test(url)) return realFetch(input as RequestInfo, init);
    const h: Record<string, string> = {}; new Headers(init?.headers).forEach((v, k) => { h[k] = v; });
    const method = init?.method ?? "GET";
    const b = init?.body && typeof init.body === "string" ? init.body : init?.body instanceof FormData ? [...init.body.entries()].map(([k, v]) => `${k}=${typeof v === "string" ? v : "<file>"}`).join("&") : init?.body ? "<bytes>" : "";
    calls.push({ method, url, headers: h, body: b });
    if (url.startsWith("https://dl.test/img")) return withUrl(new Response(outJpeg as unknown as BodyInit, { headers: { "Content-Type": "image/jpeg" } }), url);
    if (url.endsWith("/image/v1/enhance-gen/async") || url.endsWith("/image/v1/enhance/async")) return json({ process_id: "img-1" });
    if (url.includes("/image/v1/status/")) { const s = failImage ? "Failed" : imageStatus.shift() ?? "Completed"; return json({ status: s }); }
    if (url.includes("/image/v1/download/")) return json({ download_url: "https://dl.test/img" });
    if (url.endsWith("/video/") && method === "POST") return json({ requestId: "vid-1", estimates: { cost: [8, 9] } });
    if (url.endsWith("/accept")) return json({ urls: ["https://up.test/part1"] });
    if (url.startsWith("https://up.test/")) return new Response("", { status: 200, headers: { ETag: '"abc123"' } });
    if (url.endsWith("/complete-upload")) return json({});
    if (url.includes("/video/vid-1/status")) { const s = videoStatus.shift() ?? "complete"; return json({ status: s, ...(s === "complete" ? { download: { url: "https://dl.test/vid" } } : {}) }); }
    return json({ error: "unexpected " + url }, 404);
  }) as typeof fetch;
  lib = { jobs: await import("../../src/lib/topaz/jobs"), gen: await import("../../src/lib/generation-jobs"), vid: await import("../../src/lib/video-jobs"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db };
  await clean();
  objects.set("/bkt/u/t/pic.png", await pic(200, 100));
  objects.set("/bkt/u/t/clip.mp4", Buffer.from("not really a video but long enough ".repeat(40)));
});
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.creditLedger.deleteMany({ where: { userId: { in: [A, B] } } });
};
after(async () => { globalThis.fetch = realFetch; if (skip) return; await new Promise((r) => setTimeout(r, 300)); await clean(); await lib.db.$disconnect(); r2.close(); });

const picRow = (userId: string) => lib.db.generation.create({ data: { userId, prompt: "a car", status: "completed", storageKey: "u/t/pic.png", contentType: "image/png", width: 200, height: 100, kind: "image", model: "soul_v2" } });
const clipRow = (userId: string) => lib.db.generation.create({ data: { userId, prompt: "a clip", status: "completed", storageKey: "u/t/clip.mp4", contentType: "video/mp4", width: 1280, height: 720, kind: "video", durationSec: 10, sizeBytes: 1400, model: "seedance_2_5" } });
const grant = (userId: string, n: number) => lib.credits.grantCredits(userId, n, { reason: "GRANT", note: "test" });
const balance = (userId: string) => lib.credits.getBalance(userId);

test("a picture upscale sends the right request, holds the price, finishes, saves a new picture and charges once", { skip }, async () => {
  calls.length = 0; imageStatus = ["Processing", "Completed"];
  await grant(A, 1000);
  const src = await picRow(A);
  const q = await lib.jobs.quoteUpscale(A, { sourceId: src.id, preset: "auto", scale: 2 });
  assert.ok(q.ok); assert.equal(q.outW, 400); assert.equal(q.outH, 200);
  // 0.08 MP output: 1 maker credit at $0.05 = $0.05 -> 0.5 Eclipse credit at $0.10, in ledger tenths = 5
  assert.equal(q.credits, 5);
  const r = await lib.jobs.startUpscale(A, { sourceId: src.id, preset: "auto", scale: 2 });
  assert.ok(r.ok, JSON.stringify(r));
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/image/v1/enhance-gen/async"))!;
  assert.ok(post, "enhance-gen call made");
  assert.equal(post.headers["x-api-key"], "test-key");
  assert.match(post.headers["user-agent"], /^Eclipse\//);
  for (const f of ["model=Wonder 4", "output_format=jpeg", "output_width=400", "output_height=200", "image=<file>"]) assert.ok(post.body.includes(f), `form has ${f}: ${post.body}`);
  let g = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(g.status, "pending"); assert.equal(g.statusUrl, "topaz:image:img-1"); assert.equal(g.creditsHeld, 5); assert.equal(g.model, "upscale");
  assert.equal(g.params.upscaleOf, src.id);
  assert.equal(await balance(A), 1000, "nothing charged while it runs");
  g = await lib.gen.finalizeGeneration(g); assert.equal(g.status, "pending", "still processing");
  g = await lib.gen.finalizeGeneration(g); assert.equal(g.status, "completed");
  assert.equal(g.width, 400); assert.equal(g.height, 200);
  assert.ok(objects.has(`/bkt/${g.storageKey}`), "the result is in our storage");
  assert.equal(await balance(A), 995, "charged once, the held price");
  await lib.gen.finalizeGeneration(g);
  assert.equal(await balance(A), 995, "a second finish does not charge again");
  const item = await lib.gen.toItem(g); assert.equal(item.modelLabel, "Upscale");
});

test("the creative style sends its creativity and a failed picture upscale charges nothing and gives the hold back", { skip }, async () => {
  calls.length = 0; failImage = true;
  const before = await balance(A);
  const src = await picRow(A);
  const r = await lib.jobs.startUpscale(A, { sourceId: src.id, preset: "creative", scale: 2, creativity: 6 });
  assert.ok(r.ok, JSON.stringify(r));
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/enhance-gen/async"))!;
  for (const f of ["model=Bloom 2", "creativity=6", "autoprompt=true"]) assert.ok(post.body.includes(f), f);
  let g = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  g = await lib.gen.finalizeGeneration(g);
  assert.equal(g.status, "failed"); assert.equal(await balance(A), before);
  failImage = false;
});

test("a clip upscale creates, accepts, uploads, completes the upload, then polls and saves the result", { skip }, async () => {
  calls.length = 0; videoStatus = ["processing", "complete"];
  objects.delete("/bkt/u/t/ignored");
  const src = await clipRow(A);
  const before = await balance(A);
  const r = await lib.jobs.startUpscale(A, { sourceId: src.id, preset: "auto", target: "1080p" });
  assert.ok(r.ok, JSON.stringify(r));
  for (let i = 0; i < 80 && !calls.some((c) => c.url.endsWith("/complete-upload")); i++) await new Promise((x) => setTimeout(x, 50));
  const order = calls.map((c) => `${c.method} ${c.url.replace("https://api.topazlabs.com", "")}`);
  assert.deepEqual(order.filter((o) => !o.includes("/status")), ["POST /video/", "PATCH /video/vid-1/accept", "PUT https://up.test/part1", "PATCH /video/vid-1/complete-upload"]);
  const create = JSON.parse(calls.find((c) => c.url.endsWith("/video/") && c.method === "POST")!.body);
  assert.deepEqual(create.output.resolution, { width: 1920, height: 1080 });
  assert.equal(create.output.container, "mp4"); assert.equal(create.output.videoEncoder, "H264");
  assert.deepEqual(create.filters, [{ model: "slp-2.6" }]);
  assert.equal(create.source.frameRate, 24); assert.equal(create.source.frameCount, 240);
  const done = JSON.parse(calls.find((c) => c.url.endsWith("/complete-upload"))!.body);
  assert.deepEqual(done.uploadResults, [{ partNum: 1, eTag: "abc123" }]);
  let g = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(g.statusUrl, "topaz:video:vid-1"); assert.equal(g.requestId, "vid-1");
  assert.equal(g.creditsHeld, 50, "10 maker credits x $0.05 = $0.50 = 5 Eclipse credits = 50 tenths");
  assert.equal(await balance(A), before);
  g = await lib.vid.finalizeVideo(g); assert.equal(g.status, "pending", "still processing");
  objects.set("/bkt/placeholder", Buffer.from("x"));
  // the finished clip is fetched from https://dl.test/vid: serve a tiny file
  const realGet = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => String(input instanceof Request ? input.url : input).startsWith("https://dl.test/vid") ? withUrl(new Response(Buffer.from("mp4-bytes".repeat(50)) as unknown as BodyInit, { headers: { "Content-Type": "video/mp4" } }), "https://dl.test/vid") : realGet(input as RequestInfo, init)) as typeof fetch;
  try { g = await lib.vid.finalizeVideo(g); } finally { globalThis.fetch = realGet; }
  assert.equal(g.status, "completed", g.error ?? "");
  assert.equal(await balance(A), before - 50);
});

test("refusals: not the person's own, too small a step, an unsupported scale, not enough credits, and off without the settings", { skip }, async () => {
  const other = await picRow(B);
  assert.equal((await lib.jobs.startUpscale(A, { sourceId: other.id, preset: "auto", scale: 2 })).status, 404);
  const hd = await lib.db.generation.create({ data: { userId: A, prompt: "hd", status: "completed", storageKey: "u/t/clip.mp4", contentType: "video/mp4", width: 1920, height: 1080, kind: "video", durationSec: 5, sizeBytes: 100 } });
  const same = await lib.jobs.startUpscale(A, { sourceId: hd.id, preset: "auto", target: "1080p" });
  assert.equal(same.ok, false); assert.match(same.error, /already/);
  const mine = await picRow(A);
  assert.equal((await lib.jobs.startUpscale(A, { sourceId: mine.id, preset: "auto", scale: 3 })).ok, false);
  const poor = await picRow(B);
  const r = await lib.jobs.startUpscale(B, { sourceId: poor.id, preset: "auto", scale: 2 });
  assert.equal(r.ok, false); assert.equal(r.status, 402);
  const k = process.env.TOPAZ_API_KEY; delete process.env.TOPAZ_API_KEY;
  try { assert.equal((await lib.jobs.startUpscale(A, { sourceId: mine.id, preset: "auto", scale: 2 })).status, 503); } finally { process.env.TOPAZ_API_KEY = k; }
});
