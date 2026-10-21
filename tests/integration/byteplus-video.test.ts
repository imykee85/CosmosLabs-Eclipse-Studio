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
const arkMode = { kind: "ok" as "ok" | "refuse" | "forbid" | "drop", status: "running" };
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
    if (req.method === "POST" && arkMode.kind === "forbid") { res.statusCode = 404; res.end(JSON.stringify({ error: { code: "ModelNotOpen", message: "activate the model" } })); return; }
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
  process.env.ROUTE_SEEDANCE_2_5 = "higgsfield"; process.env.ROUTE_SEEDANCE_2_0 = "higgsfield"; delete process.env.ARK_VIDEO_MAX_CONCURRENT; (await import("../../src/lib/video-submit")).resetArkBlock(); delete process.env.SEEDANCE_HIGGSFIELD_FALLBACK;
});
const make = (extra: Record<string, unknown> = {}) => lib.start.startVideoRender({ userId: A, prompt: "a cat", model: "seedance_2_5", duration: 5, resolution: "720p", aspectRatio: "16:9", audio: true, ...extra });

test("with the setting at higgsfield, Higgsfield runs it and BytePlus is never called", { skip }, async () => {
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

test("Seedance is ON by default: with no setting at all the direct route is used", { skip }, async () => {
  delete process.env.ROUTE_SEEDANCE_2_5;
  const r = await make();
  assert.equal(r.ok, true, r.error);
  assert.equal(arkSent.length, 1); assert.equal(hfSent.length, 0);
  assert.equal((await lib.db.generation.findUnique({ where: { id: r.item.id } })).provider, "byteplus");
});

test("BytePlus not activated (404): the person is asked before paying the higher Higgsfield price, and the next video is priced there at once", { skip }, async () => {
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  delete process.env.ROUTE_SEEDANCE_2_5; arkMode.kind = "forbid";
  const first = await make();
  assert.equal(first.ok, false); assert.equal(first.status, 409); assert.equal(first.needsConfirm, true);
  assert.equal(hfSent.length, 0); assert.equal(await lib.db.generation.count({ where: { userId: A } }), 0, "nothing held or kept");
  const hfPrice = first.cost;
  const second = await make();            // BytePlus is now known to be closed: priced and sent to Higgsfield straight away
  assert.equal(second.ok, true, second.error);
  assert.equal(arkSent.length, 1, "BytePlus was not asked again"); assert.equal(hfSent.length, 1);
  assert.equal((await lib.db.generation.findUnique({ where: { id: second.item.id } })).creditsHeld, hfPrice);
});

test("confirming the higher price after a refusal goes through on Higgsfield", { skip }, async () => {
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  delete process.env.ROUTE_SEEDANCE_2_5; arkMode.kind = "forbid";
  const ok = await make({ confirm: true });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(hfSent.length, 1);
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
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  process.env.ROUTE_SEEDANCE_2_5 = "direct"; arkMode.kind = "refuse";
  const r = await make({ confirm: true });
  assert.equal(r.ok, true, r.error);
  assert.equal(arkSent.length, 1); assert.equal(hfSent.length, 1);
  const row = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(row.provider, "higgsfield"); assert.equal((row.params as { route: string }).route, "higgsfield-fallback");
  await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" }); process.env.ROUTE_SEEDANCE_2_5 = "higgsfield"; hfSent.length = 0;
  const plain = (await make()).item;
  assert.equal(row.creditsHeld, (await lib.db.generation.findUnique({ where: { id: plain.id } })).creditsHeld, "held the Higgsfield price");
});

test("a fallback the balance cannot cover fails cleanly and releases the hold", { skip }, async () => {
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  const price = async (route: string) => {
    await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" });
    process.env.ROUTE_SEEDANCE_2_5 = route;
    const r = await make();
    return (await lib.db.generation.findUnique({ where: { id: r.item.id } })).creditsHeld as number;
  };
  const hfPrice = await price("higgsfield"); const directPrice = await price("direct");
  assert.ok(directPrice < hfPrice);
  // enough for the direct price but not for the dearer backup price
  await clean(); await lib.credits.grantCredits(A, Math.floor((directPrice + hfPrice) / 2 / 10), { reason: "GRANT", note: "t" });
  hfSent.length = 0; arkSent.length = 0; arkMode.kind = "refuse"; process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const r = await make({ confirm: true });
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
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  process.env.ROUTE_SEEDANCE_2_5 = "direct"; process.env.ARK_VIDEO_MAX_CONCURRENT = "2";
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) { const r = await make(); assert.equal(r.ok, true, r.error); ids.push(r.item.id); }
  const providers = (await Promise.all(ids.map((id) => lib.db.generation.findUnique({ where: { id } })))).map((g: { provider: string }) => g.provider);
  assert.deepEqual(providers, ["byteplus", "byteplus", "higgsfield"]);
});

test("Seedance 2.0 4K runs one at a time on BytePlus; the next 4K goes to Higgsfield, other sizes still go direct", { skip }, async () => {
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  process.env.ROUTE_SEEDANCE_2_0 = "direct";
  const four = (extra: Record<string, unknown> = {}) => lib.start.startVideoRender({ userId: A, prompt: "a cat", model: "seedance_2_0", duration: 5, resolution: "4k", aspectRatio: "16:9", audio: true, ...extra });
  const a = await four(), b = await four(), c = await four({ resolution: "720p" });
  for (const r of [a, b, c]) assert.equal(r.ok, true, r.error);
  const got = await Promise.all([a, b, c].map((r) => lib.db.generation.findUnique({ where: { id: r.item.id } })));
  assert.deepEqual(got.map((g: { provider: string }) => g.provider), ["byteplus", "higgsfield", "byteplus"]);
  assert.equal((arkSent[0].body as { resolution: string }).resolution, "4k");
  process.env.ROUTE_SEEDANCE_2_0 = "higgsfield";
});

test("jobs with a video input go direct at BytePlus' token price when the clip's length is known", { skip }, async () => {
  await lib.db.generation.create({ data: { id: "bpv-src", userId: A, kind: "video", prompt: "x", status: "completed", imageUrl: "", storageKey: "u/a/clip.mp4", model: "seedance_2_5", durationSec: 6, aspectRatio: "16:9" } });
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const r = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-src", mode: "edit", prompt: "remove the crowd", resolution: "480p", audio: false });
  assert.equal(r.ok, true, r.error);
  assert.equal(hfSent.length, 0);
  const b = arkSent[0].body as { content: { role?: string }[]; duration: number; ratio: string; omni_reference_task_type: string };
  assert.deepEqual(b.content.map((c) => c.role ?? "text"), ["text", "reference_video"]);
  assert.equal(b.duration, -1); assert.equal(b.ratio, "adaptive"); assert.equal(b.omni_reference_task_type, "edit");
  const editRow = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(editRow.provider, "byteplus");
  // 6 s in + 6 s out at 480p: (12 s x 854x480x24/1024 tokens) x 6.4 per million
  const usd = (12 * 854 * 480 * 24 / 1024) * 6.4 / 1e6;
  assert.equal(editRow.creditsHeld, (await import("../../src/lib/price-constants")).videoCreditsForUsd(usd) * 10);
  const c = await make({ videoRefs: [{ id: "bpv-src" }] });
  assert.equal(c.ok, true, c.error);
  assert.equal(arkSent.length, 2); assert.deepEqual((arkSent[1].body as { content: { role?: string }[] }).content.map((x) => x.role ?? "text"), ["text", "reference_video"]);
});

test("a video whose length was never recorded cannot be priced at BytePlus and stays on Higgsfield", { skip }, async () => {
  process.env.SEEDANCE_HIGGSFIELD_FALLBACK = "on"; // these tests are about the automatic Higgsfield fallback, which is off unless switched on
  await lib.db.generation.create({ data: { id: "bpv-nolen", userId: A, kind: "video", prompt: "x", status: "completed", imageUrl: "", storageKey: "u/a/clip2.mp4", model: "seedance_2_5", aspectRatio: "16:9" } });
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const c = await make({ videoRefs: [{ id: "bpv-nolen" }] });
  assert.equal(c.ok, true, c.error);
  assert.equal(arkSent.length, 0); assert.equal(hfSent.length, 1);
  const e = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-nolen", mode: "extend", prompt: "and then", duration: 6 });
  assert.equal(e.ok, true, e.error);
  assert.equal(arkSent.length, 0);
});

test("Seedance 2.0 Fast: direct only, the right BytePlus model, and a refusal is NOT moved to Higgsfield", { skip }, async () => {
  const ok = await make({ model: "seedance_2_0_fast", resolution: "480p" });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(arkSent[0].body.model, "dreamina-seedance-2-0-fast-260128"); assert.equal(hfSent.length, 0);
  await clean(); await lib.credits.grantCredits(A, 20000, { reason: "GRANT", note: "t" }); arkSent.length = 0;
  arkMode.kind = "refuse";
  const bad = await make({ model: "seedance_2_0_fast", resolution: "480p" });
  assert.equal(bad.ok, false); assert.equal(hfSent.length, 0, "never sent to Higgsfield");
  assert.equal(await lib.db.generation.count({ where: { userId: A } }), 0, "nothing held or kept");
  const mini = await make({ model: "seedance_2_0_mini", resolution: "1080p" });
  assert.equal(mini.ok, false, "Mini has no 1080p"); assert.equal(mini.status, 400);
});

test("Fast and Mini cost the BytePlus list price and are refused when the direct route is switched off", { skip }, async () => {
  const { findVideoModel, videoPrice } = await import("../../src/lib/video-models");
  const fast = findVideoModel("seedance_2_0_fast")!, mini = findVideoModel("seedance_2_0_mini")!;
  assert.ok(videoPrice(mini, "480p", 5, true, "direct")! < videoPrice(fast, "480p", 5, true, "direct")!);
  process.env.ROUTE_SEEDANCE_2_0_FAST = "higgsfield";
  const off = await make({ model: "seedance_2_0_fast", resolution: "480p" });
  delete process.env.ROUTE_SEEDANCE_2_0_FAST;
  assert.equal(off.ok, false); assert.equal(off.status, 503); assert.equal(arkSent.length, 0); assert.equal(hfSent.length, 0);
});

test("Seedance 2.0 Edit and Extend run at BytePlus only, clips up to 15 s", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_0 = "direct";
  await lib.db.generation.create({ data: { id: "bpv-s20", userId: A, kind: "video", prompt: "x", status: "completed", imageUrl: "", storageKey: "u/a/c20.mp4", model: "seedance_2_0", durationSec: 6, aspectRatio: "16:9" } });
  await lib.db.generation.create({ data: { id: "bpv-long", userId: A, kind: "video", prompt: "x", status: "completed", imageUrl: "", storageKey: "u/a/long.mp4", model: "seedance_2_0", durationSec: 20, aspectRatio: "16:9" } });
  const e = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-s20", mode: "edit", prompt: "make it night", resolution: "480p", audio: false, model: "seedance_2_0" });
  assert.equal(e.ok, true, e.error);
  const b = arkSent[0].body as { model: string; omni_reference_task_type?: string; duration: number };
  assert.equal(b.model, "dreamina-seedance-2-0-260128"); assert.equal(b.omni_reference_task_type, undefined); assert.equal(b.duration, -1); assert.equal(hfSent.length, 0);
  const x = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-s20", mode: "extend", prompt: "and then it rains", duration: 16, model: "seedance_2_0" });
  assert.equal(x.ok, false, "2.0 extends by 4 to 15 s");
  const long = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-long", mode: "edit", prompt: "make it night", model: "seedance_2_0" });
  assert.equal(long.ok, false);
  arkMode.kind = "refuse";
  const bad = await lib.edit.startVideoEdit({ userId: A, sourceId: "bpv-s20", mode: "edit", prompt: "make it night", model: "seedance_2_0" });
  assert.equal(bad.ok, false); assert.equal(hfSent.length, 0);
});

test("draft mode: a 480p draft task, then the final 1080p from the draft id; no Higgsfield, once only", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  const { startDraftFinal } = await import("../../src/lib/video-draft");
  const d = await make({ draft: true, resolution: "1080p" });
  assert.equal(d.ok, true, d.error);
  const db = arkSent[0].body as { draft?: boolean; resolution: string };
  assert.equal(db.draft, true); assert.equal(db.resolution, "480p");
  const early = await startDraftFinal({ userId: A, draftId: d.item.id });
  assert.equal(early.ok, false, "a draft that has not finished cannot be finalised");
  const row = await lib.db.generation.findUnique({ where: { id: d.item.id } });
  await lib.db.generation.update({ where: { id: row.id }, data: { status: "completed", storageKey: "u/a/d.mp4", imageUrl: "" } });
  const fin = await startDraftFinal({ userId: A, draftId: d.item.id });
  assert.equal(fin.ok, true, fin.ok ? "" : fin.error);
  const f = arkSent[arkSent.length - 1].body as { content: { type: string; draft_task?: { id: string } }[]; resolution: string; prompt?: string };
  assert.deepEqual(f.content, [{ type: "draft_task", draft_task: { id: row.requestId } }]); assert.equal(f.resolution, "1080p"); assert.equal(hfSent.length, 0);
  const again = await startDraftFinal({ userId: A, draftId: d.item.id });
  assert.equal(again.ok, false); assert.equal(again.status, 409);
  const other = await make({ draft: true, model: "seedance_2_0" });
  assert.equal(other.ok, false, "drafts are Seedance 2.5 only");
});

test("fallback OFF (the default): a refusal by BytePlus stops the video, nothing is held and Higgsfield is never asked", { skip }, async () => {
  delete process.env.ROUTE_SEEDANCE_2_5; arkMode.kind = "forbid";
  const a = await make({ confirm: true });
  assert.equal(a.ok, false); assert.equal(hfSent.length, 0); assert.equal(await lib.db.generation.count({ where: { userId: A } }), 0, "nothing held or kept");
  const b = await make({ confirm: true });   // no 10-minute block: BytePlus is asked again, so a fix there shows at once
  assert.equal(b.ok, false); assert.equal(arkSent.length, 2); assert.equal(hfSent.length, 0);
});

test("fallback OFF: three BytePlus jobs running means the fourth is refused, not sent to Higgsfield", { skip }, async () => {
  delete process.env.ROUTE_SEEDANCE_2_5;
  for (let i = 0; i < 3; i++) assert.equal((await make()).ok, true);
  const fourth = await make();
  assert.equal(fourth.ok, false); assert.equal(fourth.status, 503); assert.equal(hfSent.length, 0);
});

test("the owner's own switch still sends Seedance to Higgsfield (ROUTE_SEEDANCE_2_5=higgsfield)", { skip }, async () => {
  process.env.ROUTE_SEEDANCE_2_5 = "higgsfield";
  const r = await make();
  assert.equal(r.ok, true, r.error); assert.equal(hfSent.length, 1); assert.equal(arkSent.length, 0);
});
