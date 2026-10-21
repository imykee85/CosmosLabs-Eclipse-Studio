// The direct BytePlus Seedance route against a throwaway Postgres, a fake BytePlus and a fake Higgsfield (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_bpv_a";
let hf: Server, ark: Server, r2: Server;
const hfSent: { path: string; body: Record<string, unknown> }[] = [];
const arkSent: { method: string; path: string; auth: string; body: Record<string, unknown> }[] = [];
const arkMode = { kind: "ok" as "ok" | "refuse" | "drop", status: "running" };
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

before(async () => {
  if (skip) return;
  hf = createServer(async (req, res) => {
    hfSent.push({ path: req.url ?? "", body: JSON.parse((await body(req)) || "{}") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "queued", request_id: `rq${hfSent.length}`, status_url: `http://127.0.0.1:${(hf.address() as { port: number }).port}/requests/rq${hfSent.length}/status`, cancel_url: "" }));
  });
  ark = createServer(async (req, res) => {
    const raw = await body(req);
    arkSent.push({ method: req.method ?? "", path: req.url ?? "", auth: String(req.headers.authorization ?? ""), body: raw ? JSON.parse(raw) : {} });
    if (req.method === "POST" && arkMode.kind === "drop") { req.socket.destroy(); return; }
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && arkMode.kind === "refuse") { res.statusCode = 429; res.end(JSON.stringify({ error: { code: "RateLimit", message: "slow down" } })); return; }
    if (req.method === "POST") { res.end(JSON.stringify({ id: `cgt-${arkSent.length}` })); return; }
    if (req.method === "DELETE") { res.end("{}"); return; }
    res.end(JSON.stringify({ id: "cgt-1", status: arkMode.status, content: arkMode.status === "succeeded" ? { video_url: "https://cdn.example/v.mp4" } : undefined, usage: { completion_tokens: 246840, total_tokens: 246840 } }));
  });
  r2 = createServer((_req, res) => { res.end("x"); });
  const port = (s: Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as { port: number }).port)));
  const [hp, ap, rp] = [await port(hf), await port(ark), await port(r2)];
  Object.assign(process.env, {
    HIGGSFIELD_API_KEY: "id:secret", HIGGSFIELD_BASE_URL: `http://127.0.0.1:${hp}`, HIGGSFIELD_VIDEO_BASE_URL: `http://127.0.0.1:${hp}`,
    ARK_API_KEY: "ark-test-key", ARK_BASE_URL: `http://127.0.0.1:${ap}/api/v3`,
    R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "1",
  });
  lib = {
    start: await import("../../src/lib/start-video"), edit: await import("../../src/lib/video-edit"), hfv: await import("../../src/lib/higgsfield-video"),
    credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db,
  };
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); hf.close(); ark.close(); r2.close(); });
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: A } });
  await lib.db.creditLedger.deleteMany({ where: { userId: A } });
  await lib.db.usageEvent.deleteMany({ where: { userId: A } });
};
beforeEach(async () => {
  if (skip) return;
  await clean();
  await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" });
  hfSent.length = 0; arkSent.length = 0; arkMode.kind = "ok"; arkMode.status = "running";
  delete process.env.ROUTE_SEEDANCE_2_5; delete process.env.ARK_VIDEO_MAX_CONCURRENT;
});
const make = (extra: Record<string, unknown> = {}) => lib.start.startVideoRender({ userId: A, prompt: "a cat", model: "seedance_2_5", duration: 5, resolution: "720p", aspectRatio: "16:9", audio: true, ...extra });

test("the switch is off by default: Higgsfield runs it and BytePlus is never called", { skip }, async () => {
  const r = await make();
  assert.equal(r.ok, true, r.error);
  assert.equal(hfSent.length, 1); assert.equal(arkSent.length, 0);
  const row = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(row.provider, "higgsfield");
});

test("direct: BytePlus gets the task with the key, the row records it, status and usage are read from it", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const r = await make();
  assert.equal(r.ok, true, r.error);
  assert.equal(hfSent.length, 0);
  const post = arkSent[0];
  assert.equal(post.method, "POST"); assert.equal(post.path, "/api/v3/contents/generations/tasks"); assert.equal(post.auth, "Bearer ark-test-key");
  assert.equal(post.body.model, "dreamina-seedance-2-5-260628"); assert.equal(post.body.ratio, "16:9"); assert.equal(post.body.duration, 5); assert.equal(post.body.watermark, false);
  assert.deepEqual(post.body.content, [{ type: "text", text: "a cat" }]);
  const row = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(row.provider, "byteplus"); assert.ok(row.statusUrl.endsWith("/api/v3/contents/generations/tasks/cgt-1")); assert.equal((row.params as { route: string }).route, "direct");
  assert.equal((await lib.hfv.videoStatus(row.statusUrl)).state, "in_progress");
  arkMode.status = "queued"; assert.equal((await lib.hfv.videoStatus(row.statusUrl)).state, "queued");
  arkMode.status = "failed"; assert.equal((await lib.hfv.videoStatus(row.statusUrl)).state, "failed");
  arkMode.status = "succeeded";
  const done = await lib.hfv.videoStatus(row.statusUrl);
  assert.equal(done.state, "completed"); assert.equal(done.videoUrl, "https://cdn.example/v.mp4"); assert.equal(done.usage.total_tokens, 246840);
  assert.equal(await lib.hfv.cancelVideo(row.cancelUrl), true);
  assert.equal(arkSent[arkSent.length - 1].method, "DELETE");
});

test("direct costs less: the hold is the direct price, the backup price is the Higgsfield one", { skip }, async () => {
  const hfRow = (await make()).item; // switch off
  const heldHf = (await lib.db.generation.findUnique({ where: { id: hfRow.id } })).creditsHeld;
  await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" });
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const d = (await make()).item;
  const heldDirect = (await lib.db.generation.findUnique({ where: { id: d.id } })).creditsHeld;
  assert.ok(heldDirect < heldHf, `${heldDirect} should be below ${heldHf}`);
});

test("BytePlus refuses before starting: the same row carries on at Higgsfield at the Higgsfield price", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "direct"; arkMode.kind = "refuse";
  const r = await make();
  assert.equal(r.ok, true, r.error);
  assert.equal(arkSent.length, 1); assert.equal(hfSent.length, 1);
  const row = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(row.provider, "higgsfield"); assert.equal((row.params as { route: string }).route, "higgsfield-fallback");
  await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" }); delete process.env.ROUTE_SEEDANCE_2_5; hfSent.length = 0;
  const plain = (await make()).item;
  assert.equal(row.creditsHeld, (await lib.db.generation.findUnique({ where: { id: plain.id } })).creditsHeld, "held the Higgsfield price");
});

test("a fallback the balance cannot cover fails cleanly and releases the hold", { skip }, async () => {
  const price = async (route: string) => {
    await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" });
    process.env.ROUTE_SEEDANCE_2_5 = route;
    const r = await make();
    return (await lib.db.generation.findUnique({ where: { id: r.item.id } })).creditsHeld as number;
  };
  const hfPrice = await price(""); const directPrice = await price("direct");
  assert.ok(directPrice < hfPrice);
  // enough for the direct price but not for the dearer backup price
  await clean(); await lib.credits.grantCredits(A, Math.floor((directPrice + hfPrice) / 2 / 10), { reason: "GRANT", note: "t" });
  hfSent.length = 0; arkSent.length = 0; arkMode.kind = "refuse"; process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const r = await make();
  assert.equal(r.ok, false); assert.equal(r.status, 402); assert.equal(hfSent.length, 0);
  assert.equal(await lib.db.generation.count({ where: { userId: A } }), 0);
});

test("an unclear outcome (the connection drops) is NOT retried elsewhere, so nobody pays twice", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "direct"; arkMode.kind = "drop";
  const r = await make();
  assert.equal(r.ok, false); assert.equal(r.status, 502);
  assert.equal(hfSent.length, 0);
  assert.equal(await lib.db.generation.count({ where: { userId: A } }), 0, "the row (and its hold) is gone");
});

test("BytePlus runs 3 at a time: the next video goes to Higgsfield from the start", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "direct"; process.env.ARK_VIDEO_MAX_CONCURRENT = "2";
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) { const r = await make(); assert.equal(r.ok, true, r.error); ids.push(r.item.id); }
  const providers = (await Promise.all(ids.map((id) => lib.db.generation.findUnique({ where: { id } })))).map((g: { provider: string }) => g.provider);
  assert.deepEqual(providers, ["byteplus", "byteplus", "higgsfield"]);
});

test("Edit on the direct route: reference video, task type edit, length -1; no key means Higgsfield", { skip }, async () => {
  await lib.db.generation.create({ data: { id: "bpv-src", userId: A, kind: "video", prompt: "x", status: "completed", imageUrl: "", storageKey: "u/a/clip.mp4", model: "seedance_2_5", durationSec: 6, aspectRatio: "16:9" } });
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const r = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-src", mode: "edit", prompt: "remove the crowd", resolution: "480p", audio: false });
  assert.equal(r.ok, true, r.error);
  const b = arkSent[0].body as { content: { role?: string }[]; duration: number; ratio: string; omni_reference_task_type: string };
  assert.deepEqual(b.content.map((c) => c.role ?? "text"), ["text", "reference_video"]);
  assert.equal(b.duration, -1); assert.equal(b.ratio, "adaptive"); assert.equal(b.omni_reference_task_type, "edit");
  const key = process.env.ARK_API_KEY; delete process.env.ARK_API_KEY; arkSent.length = 0;
  const r2x = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-src", mode: "extend", prompt: "and then", duration: 6 });
  process.env.ARK_API_KEY = key;
  assert.equal(r2x.ok, true, r2x.error); assert.equal(arkSent.length, 0); assert.match(hfSent[hfSent.length - 1].path, /video-extend$/);
});
