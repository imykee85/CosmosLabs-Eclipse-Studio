// Mirelo (sound effects and sound for video) against a throwaway Postgres, a fake Mirelo server, a fake CDN on another port and a fake R2 (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const USER = "user_mirelo_a", OTHER = "user_mirelo_b";
const objects = new Map<string, Buffer>();
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const listen = (s: Server) => new Promise<number>((res) => s.listen(0, "127.0.0.1", () => res((s.address() as { port: number }).port)));

// One second of 8 kHz mono 16-bit WAV per `seconds`.
function wav(seconds: number): Buffer {
  const data = Buffer.alloc(16000 * seconds, 1);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

type Call = { method: string; url: string; auth: string | undefined; idem: string | undefined; body: Record<string, unknown> | null };
const st = { mode: "instant" as string, calls: [] as Call[], cdnAuth: [] as (string | undefined)[], busyLeft: 0, polls: 0, variants: 2, credits: 150, quote: 150 };
let mirelo: Server, cdn: Server, r2: Server;
let base = "", cdnBase = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

const jobJson = (status: string, extra: Record<string, unknown> = {}) => ({ id: "job_1", status, credits: st.credits, urls: { self: `${base}/v3/jobs/job_1` }, ...extra });
const result = (n: number, failed = 0) => ({ outputs: Array.from({ length: n }, (_, i) => ({ status: i < n - failed ? "succeeded" : "failed", url: `${base}/files/${i + 1}`, content_type: "audio/wav" })) });

before(async () => {
  if (skip) return;
  mirelo = createServer(async (req, res) => {
    const raw = await body(req);
    const url = req.url ?? "";
    const b = raw.length ? (JSON.parse(raw.toString()) as Record<string, unknown>) : null;
    st.calls.push({ method: req.method ?? "", url, auth: req.headers.authorization, idem: req.headers["idempotency-key"] as string | undefined, body: b });
    const json = (code: number, o: unknown) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    if (req.method === "POST" && url.includes("/preflight")) return json(200, { credits: st.quote });
    if (req.method === "POST" && /^\/v3\/(text|video)-to-sfx\/generations\?wait=25$/.test(url)) {
      if (st.mode === "402") return json(402, { error: { code: "insufficient_credits", message: "no credits", retryable: false } });
      if (st.mode === "busy-once" && st.busyLeft > 0) { st.busyLeft--; return json(429, { error: { code: "rate_limited", retryable: true } }); }
      if (st.mode === "instant") return json(200, jobJson("succeeded", { result: result(st.variants) }));
      return json(202, jobJson("running"));
    }
    if (req.method === "GET" && url === "/v3/jobs/job_1") {
      st.polls++;
      if (st.mode === "slow") return json(200, st.polls < 2 ? jobJson("running") : jobJson("succeeded", { result: result(st.variants) }));
      if (st.mode === "instant" || st.mode === "busy-once") return json(200, jobJson("succeeded", { result: result(st.variants) }));
      if (st.mode === "partial") return json(200, jobJson("partially_succeeded", { result: result(2, 1) }));
      if (st.mode === "failed") return json(200, jobJson("failed", { errors: [{ code: "invalid_video", message: "cannot decode", retryable: false }] }));
      return json(200, jobJson("running"));
    }
    const f = /^\/files\/(\d+)$/.exec(url);
    if (f) { res.statusCode = 302; res.setHeader("location", `${cdnBase}/cdn/${f[1]}.wav`); return void res.end(); }
    res.statusCode = 404; res.end();
  });
  cdn = createServer((req, res) => { st.cdnAuth.push(req.headers.authorization); res.setHeader("content-type", "audio/wav"); res.end(wav(5)); });
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); return void res.end(); }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; return void res.end(); }
    const o = objects.get(path); if (!o) { res.statusCode = 404; return void res.end(); } res.end(o);
  });
  const [mp, cp, rp] = [await listen(mirelo), await listen(cdn), await listen(r2)];
  base = `http://127.0.0.1:${mp}`; cdnBase = `http://127.0.0.1:${cp}`;
  Object.assign(process.env, { MIRELO_API_KEY: "sk-test", MIRELO_BASE_URL: base, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "1", AUDIO_JOBS_PER_MINUTE: "1000", AUDIO_JOBS_PER_DAY: "1000", AUDIO_MAX_RUNNING: "50", MIRELO_CREDIT_USD: "0.001" });
  lib = { jobs: await import("../../src/lib/audio/jobs"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db, pricing: await import("../../src/lib/audio/pricing") };
  await clean();
});
const clean = async () => {
  for (const m of ["audioJob", "creditLedger", "usageEvent", "generation"]) await lib.db[m].deleteMany({ where: { userId: { in: [USER, OTHER] } } });
};
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); mirelo.close(); cdn.close(); r2.close(); });

const reset = async (credits: number, mode = "instant") => {
  await clean();
  if (credits > 0) await lib.credits.grantCredits(USER, credits, { reason: "GRANT", note: "test" });
  Object.assign(st, { mode, calls: [], cdnAuth: [], busyLeft: 0, polls: 0, variants: 2, credits: 150, quote: 150 }); objects.clear();
};
const waitDone = async (id: string, userId = USER) => { for (let i = 0; i < 300; i++) { const j = await lib.jobs.getAudioJob(userId, id); if (j && j.status !== "pending") return j; await new Promise((r) => setTimeout(r, 50)); } throw new Error("job did not finish"); };
const sfx = (over: Record<string, unknown> = {}) => lib.jobs.startAudioJob({ userId: USER, kind: "sfx", model: "sfx-2.0", text: "footsteps on gravel", durationSec: 5, variants: 2, ...over });
const video = (data: Record<string, unknown> = {}) => lib.db.generation.create({ data: { userId: USER, prompt: "a fox", kind: "video", status: "completed", storageKey: "u/a/clip.mp4", contentType: "video/mp4", durationSec: 5.04, ...data } });
const create = () => st.calls.filter((c) => c.method === "POST" && !c.url.includes("preflight"));
const creditsOf = (usd: number) => lib.pricing.creditsFor(usd);

test("text to sound effects: exact request, quote first, two variants stored, charged once from Mirelo's credits", { skip }, async () => {
  await reset(500);
  const r = await sfx({ negativePrompt: "music" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  const c = create()[0];
  assert.equal(c.url, "/v3/text-to-sfx/generations?wait=25");
  assert.equal(c.auth, "Bearer sk-test");
  assert.equal(c.idem, j.id, "the Idempotency-Key is the job id");
  assert.deepEqual(c.body, { model: "sfx-2.0", num_variants: 2, input: { prompt: "footsteps on gravel", negative_prompt: "music" }, output: { format: "wav" }, duration_ms: 5000 });
  assert.ok(st.calls.some((x) => x.url === "/v3/text-to-sfx/generations/preflight"), "a quote was asked before anything was held");
  assert.deepEqual(st.cdnAuth.filter(Boolean), [], "the key never reaches the redirect target");
  assert.equal(st.cdnAuth.length, 2, "both variants were downloaded");
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}/variant-1.wav`) && objects.has(`/bkt/audio/${USER}/${j.id}/variant-2.wav`));
  assert.equal(j.storageKey, `audio/${USER}/${j.id}/variant-1.wav`);
  const expected = creditsOf(150 * 0.001);
  assert.equal(j.creditsCharged, expected, "settled from the 150 credits Mirelo reported");
  assert.equal(await lib.credits.getBalance(USER), 500 - expected);
  const item = await lib.jobs.toAudioItem(j);
  assert.equal(item.variants?.length, 2);
  assert.match(item.variants?.[1].fileName ?? "", /-v2\.wav$/);
  assert.equal("storageKey" in item, false);
  await lib.jobs.runAudioJob(j.id);
  assert.equal(create().length, 1, "a second run of the same job does nothing");
});

test("a job that is still running is followed by polling and finished once", { skip }, async () => {
  await reset(500, "slow");
  const r = await sfx({ variants: 1 });
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  assert.ok(st.polls >= 2);
  assert.equal(await lib.db.creditLedger.count({ where: { userId: USER, reason: "CHARGE" } }), 1);
});

test("sound for a video: the video's signed link goes to Mirelo, speech kept or removed, only the owner's own finished video", { skip }, async () => {
  await reset(500);
  objects.set("/bkt/u/a/clip.mp4", Buffer.alloc(100, 1));
  const v = await video();
  const r = await lib.jobs.startAudioJob({ userId: USER, kind: "vsfx", model: "sfx-2.0", videoId: v.id, variants: 1, preserveSpeech: false, text: "" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  const c = create()[0];
  assert.equal(c.url, "/v3/video-to-sfx/generations?wait=25");
  const b = c.body as { input: { video: { type: string; url: string }; prompt?: string }; controls: unknown; duration_ms: number };
  assert.equal(b.input.video.type, "url");
  assert.match(b.input.video.url, /clip\.mp4/);
  assert.equal(b.input.prompt, undefined, "no prompt unless the person wrote one");
  assert.deepEqual(b.controls, { preserve_speech: false });
  assert.equal(b.duration_ms, 5000, "the clip's length, to the tenth of a second");
  const item = await lib.jobs.toAudioItem(j);
  assert.equal(item.kind, "vsfx");
  assert.match(item.videoUrl ?? "", /clip\.mp4/);
  // default: speech is kept
  await reset(500);
  const v2 = await video();
  await waitDone((await lib.jobs.startAudioJob({ userId: USER, kind: "vsfx", model: "sfx-2.0", videoId: v2.id, text: "light wind" })).item.id);
  assert.deepEqual((create()[0].body as { controls: unknown }).controls, { preserve_speech: true });
  assert.equal((create()[0].body as { input: { prompt: string } }).input.prompt, "light wind");
  // other people's, unfinished, binned and image rows are refused
  const mine = await video();
  const other = await lib.jobs.startAudioJob({ userId: OTHER, kind: "vsfx", model: "sfx-2.0", videoId: mine.id });
  assert.ok(!other.ok && other.status === 404);
  for (const data of [{ status: "pending" }, { deletedAt: new Date() }, { kind: "image" }]) {
    const bad = await video(data);
    assert.ok(!(await lib.jobs.startAudioJob({ userId: USER, kind: "vsfx", model: "sfx-2.0", videoId: bad.id })).ok);
  }
});

test("a variant that failed is not kept and not charged (partially succeeded)", { skip }, async () => {
  await reset(500, "partial");
  st.credits = 75;
  const r = await sfx({ variants: 2 });
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  assert.equal(st.cdnAuth.length, 1, "only the successful variant was downloaded");
  assert.equal(j.creditsCharged, creditsOf(75 * 0.001));
  assert.equal((await lib.jobs.toAudioItem(j)).variants, null, "one file left: a plain take");
});

test("a failed job ends failed with a plain message, nothing charged, hold released", { skip }, async () => {
  await reset(500, "failed");
  const r = await sfx({ variants: 1 });
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "failed");
  assert.match(j.error, /Nothing was charged/);
  assert.equal(await lib.credits.getBalance(USER), 500);
  assert.equal(await lib.db.creditLedger.count({ where: { userId: USER, reason: "CHARGE" } }), 0);
});

test("no Mirelo credit (402) is an owner alert: the person sees a generic message, nothing charged", { skip }, async () => {
  await reset(500, "402");
  const r = await sfx({ variants: 1 });
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "failed");
  assert.match(j.error, /unavailable right now/i);
  assert.doesNotMatch(j.error, /credits/i);
  assert.equal(await lib.credits.getBalance(USER), 500);
});

test("a busy answer (429) is retried with the SAME key and body", { skip }, async () => {
  await reset(500, "busy-once");
  st.busyLeft = 1;
  const r = await sfx({ variants: 1 });
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  const c = create();
  assert.equal(c.length, 2);
  assert.equal(c[0].idem, c[1].idem);
  assert.deepEqual(c[0].body, c[1].body);
});

test("the settings are checked before anything is held", { skip }, async () => {
  await reset(500);
  const no = async (over: Record<string, unknown>, re: RegExp) => { const r = await sfx(over); assert.ok(!r.ok, JSON.stringify(over)); assert.match(r.error, re); };
  await no({ loop: true }, /cannot make loops/);
  await no({ variants: 5 }, /1 to 4/);
  await no({ variants: 0 }, /1 to 4/);
  await no({ text: "x".repeat(2001) }, /2,000 characters/);
  await no({ negativePrompt: "y".repeat(1001) }, /1,000/);
  await no({ durationSec: 700 }, /between/);
  await no({ durationSec: 0.05 }, /between/);
  await no({ format: "ogg" }, /format/);
  assert.equal(st.calls.length, 0, "Mirelo was never called");
  assert.equal(await lib.db.audioJob.count({ where: { userId: USER } }), 0);
  // no length chosen: sound effects default to 5 seconds; mp3 asks for mp3_192
  const ok = await sfx({ durationSec: undefined, variants: 1, format: "mp3" });
  assert.equal(ok.ok, true);
  await waitDone(ok.item.id);
  const b = create()[0].body as { duration_ms: number; output: { format: string } };
  assert.equal(b.duration_ms, 5000);
  assert.equal(b.output.format, "mp3_192");
});

test("the quote creates nothing, and not enough credits is refused with the number", { skip }, async () => {
  await reset(500);
  const q = await lib.jobs.startAudioJob({ userId: USER, kind: "sfx", model: "sfx-2.0", text: "rain", durationSec: 5, variants: 2 }, { dryRun: true });
  assert.deepEqual(q, { ok: true, quote: creditsOf(150 * 0.001) });
  assert.equal(await lib.db.audioJob.count({ where: { userId: USER } }), 0);
  await reset(1);
  const r = await sfx();
  assert.ok(!r.ok && r.status === 402);
  assert.match(r.error, new RegExp(`needs ${creditsOf(150 * 0.001) / 10} credits`)); // shown in credits (ledger / 10)
});

test("deleting a take removes every alternative from storage", { skip }, async () => {
  await reset(500);
  const r = await sfx();
  const j = await waitDone(r.item.id);
  assert.equal([...objects.keys()].filter((k) => k.includes(j.id)).length, 2);
  assert.equal(await lib.jobs.deleteAudioJob(USER, j.id), true); // goes to the Bin, files stay
  assert.equal([...objects.keys()].filter((k) => k.includes(j.id)).length, 2);
  assert.equal(await lib.jobs.deleteAudioJob(USER, j.id, true), true);
  assert.equal([...objects.keys()].filter((k) => k.includes(j.id)).length, 0);
});
