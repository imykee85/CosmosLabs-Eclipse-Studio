// Voice Studio jobs against a throwaway Postgres, a fake ElevenLabs server and a fake R2 (no real keys, nothing leaves this machine).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";

type Mode = "ok" | "busy-once" | "fail-second" | "voices";
const state = { mode: "ok" as Mode, calls: 0, texts: [] as string[], busyLeft: 0 };
const objects = new Map<string, Buffer>();
let eleven: Server, r2: Server;

const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const listen = (s: Server) => new Promise<number>((res) => s.listen(0, "127.0.0.1", () => res((s.address() as { port: number }).port)));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const USER = "user_audio_a", OTHER = "user_audio_b";

before(async () => {
  if (skip) return;
  eleven = createServer(async (req, res) => {
    const b = await body(req);
    if (req.url?.startsWith("/v2/voices")) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ voices: [{ voice_id: "voiceA", name: "Ana", category: "premade", preview_url: "https://x/p.mp3", labels: { accent: "british" } }], has_more: false })); return; }
    state.calls++;
    const text = (JSON.parse(b.toString() || "{}") as { text?: string }).text ?? "";
    state.texts.push(text);
    if (state.mode === "busy-once" && state.busyLeft > 0) { state.busyLeft--; res.statusCode = 429; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ detail: { code: "system_busy", message: "busy" } })); return; }
    if (state.mode === "fail-second" && state.calls >= 2) { res.statusCode = 402; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ detail: { code: "insufficient_credits", message: "no credit" } })); return; }
    res.setHeader("content-type", "audio/mpeg"); res.setHeader("character-cost", String(text.length)); res.setHeader("request-id", "req_1");
    res.end(Buffer.alloc(16000, 7)); // one second of 128 kbps audio
  });
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const [ep, rp] = [await listen(eleven), await listen(r2)];
  Object.assign(process.env, {
    ELEVENLABS_API_KEY: "test-key", ELEVENLABS_BASE_URL: `http://127.0.0.1:${ep}`, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt",
    CREDITS_ENABLED: "1", AUDIO_JOBS_PER_MINUTE: "1000", AUDIO_JOBS_PER_DAY: "1000", AUDIO_ELEVENLABS_MAX_CONCURRENCY: "2",
  });
  lib = { jobs: await import("../../src/lib/audio/jobs"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db, pricing: await import("../../src/lib/audio/pricing"), registry: await import("../../src/lib/audio/registry") };
  await lib.db.audioJob.deleteMany({ where: { userId: { in: [USER, OTHER] } } });
  await lib.db.creditLedger.deleteMany({ where: { userId: { in: [USER, OTHER] } } });
  await lib.db.usageEvent.deleteMany({ where: { userId: { in: [USER, OTHER] } } });
});
after(async () => { if (skip) return; await lib.db.audioJob.deleteMany({ where: { userId: { in: [USER, OTHER] } } }); await lib.db.$disconnect(); eleven.close(); r2.close(); });

const reset = async (credits: number) => {
  await lib.db.audioJob.deleteMany({ where: { userId: USER } });
  await lib.db.creditLedger.deleteMany({ where: { userId: USER } });
  await lib.db.usageEvent.deleteMany({ where: { userId: USER } });
  if (credits > 0) await lib.credits.grantCredits(USER, credits, { reason: "GRANT", note: "test" });
  Object.assign(state, { mode: "ok", calls: 0, texts: [], busyLeft: 0 }); objects.clear();
};
const waitDone = async (id: string, userId = USER) => { for (let i = 0; i < 200; i++) { const j = await lib.jobs.getAudioJob(userId, id); if (j && j.status !== "pending") return j; await new Promise((r) => setTimeout(r, 50)); } throw new Error("job did not finish"); };
const start = (over: Record<string, unknown> = {}) => lib.jobs.startAudioJob({ userId: USER, text: "Hello world. This is a test.", model: "eleven_v4", voiceId: "voiceA", voiceName: "Ana", ...over });

test("a voice is made, stored privately and charged exactly once", { skip }, async () => {
  await reset(500);
  const r = await start();
  assert.equal(r.ok, true);
  assert.equal(r.item.status, "pending");
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  assert.equal(j.contentType, "audio/mpeg");
  assert.equal(j.durationMs, 1000);
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}.mp3`), "the file is in storage under audio/<user>/<id>");
  const expected = lib.pricing.creditsFor(lib.pricing.usdFor(lib.registry.findAudioModel("eleven_v4"), j.chars));
  assert.equal(j.creditsCharged, expected);
  assert.equal(await lib.credits.getBalance(USER), 500 - expected);
  assert.equal((await lib.db.creditLedger.count({ where: { userId: USER, reason: "CHARGE" } })), 1);
  assert.deepEqual(state.texts, ["Hello world. This is a test."]);
  const item = await lib.jobs.toAudioItem(j);
  assert.match(item.url ?? "", /^http/);
  assert.equal("storageKey" in item, false, "the browser never gets the storage key");
  // A second run of the same job does nothing: no second call, no second charge.
  await lib.jobs.runAudioJob(j.id);
  assert.equal(state.calls, 1);
  assert.equal(await lib.credits.getBalance(USER), 500 - expected);
});

test("a busy answer (429) is retried and the job still completes", { skip }, async () => {
  await reset(500);
  state.mode = "busy-once"; state.busyLeft = 1;
  const r = await start();
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  assert.equal(state.calls, 2);
});

test("a long text is split at sentence ends, joined, and a failure part-way refunds everything", { skip }, async () => {
  await reset(2000);
  const sentence = "This is one sentence of the long script. ";
  const long = sentence.repeat(300).trim(); // about 12,000 characters, over the 5,000 per call
  const ok = await start({ text: long, model: "eleven_v4" });
  assert.equal(ok.ok, false, "over the 10,000 character limit of eleven_v4 is refused");
  const text = sentence.repeat(180).trim(); // about 7,400 characters: two calls
  const r = await start({ text });
  assert.equal(r.ok, true);
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed");
  assert.equal(state.calls, 2);
  assert.equal(j.sizeBytes, 32000, "two pieces joined");
  for (const t of state.texts) assert.ok(t.length <= 5000 && /\.$/.test(t));

  await reset(2000);
  state.mode = "fail-second";
  const f = await start({ text });
  const fj = await waitDone(f.item.id);
  assert.equal(fj.status, "failed");
  assert.match(fj.error, /Nothing was charged/);
  assert.doesNotMatch(fj.error, /no credit|insufficient/i, "the provider's own words stay out of the message");
  assert.equal(fj.storageKey, null);
  assert.equal(objects.size, 0);
  assert.equal(await lib.credits.getBalance(USER), 2000, "no charge");
  const again = await lib.db.audioJob.aggregate({ where: { userId: USER, status: "pending" }, _sum: { creditsHeld: true } });
  assert.equal(again._sum.creditsHeld ?? 0, 0, "the hold is released");
});

test("not enough credits is refused before anything is called, and a hold counts against the balance", { skip }, async () => {
  await reset(0);
  const r = await start();
  assert.equal(r.ok, false);
  assert.equal(r.status, 402);
  assert.equal(state.calls, 0);
  assert.equal(await lib.db.audioJob.count({ where: { userId: USER } }), 0);
  // A running job holds its price: with exactly enough for one, a second start is refused while the first is pending.
  await reset(0);
  const need = lib.pricing.ttsCredits(lib.registry.findAudioModel("eleven_v4"), 28);
  await lib.credits.grantCredits(USER, need, { reason: "GRANT" });
  await lib.db.audioJob.create({ data: { userId: USER, provider: "elevenlabs", model: "eleven_v4", text: "x", textHash: "h", chars: 28, status: "pending", creditsHeld: need, startedAt: new Date() } });
  const second = await start();
  assert.equal(second.ok, false);
  assert.equal(second.status, 402);
});

test("stale jobs end by themselves; other people's jobs are not found; validation and moderation", { skip }, async () => {
  await reset(500);
  const old = await lib.db.audioJob.create({ data: { userId: USER, provider: "elevenlabs", model: "eleven_v4", text: "x", textHash: "h", chars: 1, status: "pending", creditsHeld: 3, createdAt: new Date(Date.now() - 10 * 60_000) } });
  const polled = await lib.jobs.getAudioJob(USER, old.id);
  assert.equal(polled.status, "failed");
  assert.match(polled.error, /Nothing was charged/);
  assert.equal(await lib.jobs.getAudioJob(OTHER, old.id), null, "another account gets nothing, not the data");
  assert.equal(await lib.jobs.deleteAudioJob(OTHER, old.id), false);
  assert.equal((await start({ text: "   " })).ok, false);
  assert.equal((await start({ voiceId: "../etc" })).ok, false);
  assert.equal((await start({ model: "nope" })).ok, false);
  const speed = await start({ model: "eleven_v4", speed: 2 });
  assert.equal(speed.ok, false);
  assert.equal((await start({ text: "a".repeat(10001) })).ok, false);
  const bad = await start({ text: "make a deepfake of a celebrity nude" });
  assert.equal(bad.ok, false);
  assert.equal(state.calls, 0);
});

test("running limit: no more than the allowed number of voices at once", { skip }, async () => {
  await reset(500);
  for (let i = 0; i < 3; i++) await lib.db.audioJob.create({ data: { userId: USER, provider: "elevenlabs", model: "eleven_v4", text: "x", textHash: "h", chars: 1, status: "pending", startedAt: new Date() } });
  const r = await start();
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
});

test("deleting a finished voice removes its file", { skip }, async () => {
  await reset(500);
  const r = await start();
  const j = await waitDone(r.item.id);
  assert.equal(objects.size, 1);
  assert.equal(await lib.jobs.deleteAudioJob(USER, j.id), true);
  assert.equal(objects.size, 0);
  assert.equal(await lib.jobs.getAudioJob(USER, j.id), null);
});
