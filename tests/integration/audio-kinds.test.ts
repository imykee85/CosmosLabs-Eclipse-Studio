// Speech to text, sound effects, music and long MiniMax text end to end (job, hold, storage, charge) against a throwaway Postgres, one fake provider server and a fake R2.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself without DATABASE_URL)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
const USER = "user_audio_kinds", OTHER = "user_audio_kinds_b";
const objects = new Map<string, Buffer>();
const calls: { url: string; body: string }[] = [];
const task = { polls: 0, failed: false };
let prov: Server, r2: Server;

const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const listen = (s: Server) => new Promise<number>((res) => s.listen(0, "127.0.0.1", () => res((s.address() as { port: number }).port)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

before(async () => {
  if (skip) return;
  prov = createServer(async (req, res) => {
    const b = (await body(req)).toString();
    calls.push({ url: req.url ?? "", body: b });
    const json = (o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/v1/speech-to-text") return json({ language_code: "en", text: "Hello there. Hi back", words: [{ text: "Hello", type: "word", start: 0, end: 0.4, speaker_id: "speaker_0" }, { text: "there.", type: "word", start: 0.5, end: 0.9, speaker_id: "speaker_0" }, { text: "Hi", type: "word", start: 1, end: 1.2, speaker_id: "speaker_1" }, { text: "back", type: "word", start: 1.3, end: 1.6, speaker_id: "speaker_1" }] });
    if (req.url?.startsWith("/v1/sound-generation") || req.url?.startsWith("/v1/music")) {
      if (b.includes("Taylor")) return json({ detail: { code: "bad_prompt", message: "x" } }, 400);
      res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(Buffer.alloc(16000, 4)); // one second at 128 kbps
    }
    if (req.url === "/v1/asr") return json({ text: "Fish heard this", duration: 12, segments: [{ text: "Fish heard this", start: 0, end: 12 }] });
    if (req.url === "/v1/t2a_async_v2") return res.end('{"task_id":424242,"file_id":1,"base_resp":{"status_code":0}}');
    if (req.url?.startsWith("/v1/query/t2a_async_query_v2")) { task.polls++; return res.end(task.failed ? '{"status":"Failed","base_resp":{"status_code":0}}' : task.polls < 2 ? '{"status":"Processing","base_resp":{"status_code":0}}' : '{"status":"Success","file_id":909,"base_resp":{"status_code":0}}'); }
    if (req.url?.startsWith("/v1/files/retrieve_content")) { res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(Buffer.alloc(32000, 6)); }
    res.statusCode = 404; res.end("{}");
  });
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; }
    res.setHeader("content-length", String(o.length)); res.setHeader("content-type", "audio/mpeg");
    res.end(req.method === "HEAD" ? undefined : o);
  });
  const [pp, rp] = [await listen(prov), await listen(r2)];
  const base = `http://127.0.0.1:${pp}`;
  Object.assign(process.env, {
    ELEVENLABS_API_KEY: "k", ELEVENLABS_BASE_URL: base, FISH_API_KEY: "k", FISH_BASE_URL: base, MINIMAX_API_KEY: "k", MINIMAX_BASE_URL: base,
    R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt",
    CREDITS_ENABLED: "1", AUDIO_JOBS_PER_MINUTE: "1000", AUDIO_JOBS_PER_DAY: "1000", AUDIO_MAX_RUNNING: "10",
  });
  lib = { jobs: await import("../../src/lib/audio/jobs"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db, pricing: await import("../../src/lib/audio/pricing"), registry: await import("../../src/lib/audio/registry") };
});
const wipe = async () => { for (const u of [USER, OTHER]) for (const t of ["audioJob", "creditLedger", "usageEvent"]) await lib.db[t].deleteMany({ where: { userId: u } }); };
after(async () => { if (skip) return; await wipe(); await lib.db.$disconnect(); prov.close(); r2.close(); });

const reset = async (credits: number) => { await wipe(); await lib.credits.grantCredits(USER, credits, { reason: "GRANT", note: "t" }); calls.length = 0; objects.clear(); Object.assign(task, { polls: 0, failed: false }); };
const waitDone = async (id: string) => { for (let i = 0; i < 200; i++) { const j = await lib.jobs.getAudioJob(USER, id); if (j && j.status !== "pending") return j; await new Promise((r) => setTimeout(r, 50)); } throw new Error("job did not finish"); };
const start = (over: Record<string, unknown>) => lib.jobs.startAudioJob({ userId: USER, ...over });
const price = (id: string, units: number) => lib.pricing.creditsFor(lib.pricing.usdFor(lib.registry.findAudioModel(id), units));
const putInput = (userId: string, name: string, size: number) => { const key = `audio/${userId}/in/${name}`; objects.set(`/bkt/${key}`, Buffer.alloc(size, 1)); return key; };

test("sound effect: made, stored, charged on the length asked for; out-of-range and empty are refused", { skip }, async () => {
  await reset(500);
  assert.equal((await start({ kind: "sfx", model: "eleven_text_to_sound_v2", text: "rain", durationSec: 31 })).ok, false);
  assert.equal((await start({ kind: "sfx", model: "eleven_text_to_sound_v2", text: " " })).ok, false);
  const r = await start({ kind: "sfx", model: "eleven_text_to_sound_v2", text: "rain on a tin roof", durationSec: 5, loop: true });
  assert.equal(r.ok, true, r.error);
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.equal(j.kind, "sfx");
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}.mp3`));
  assert.equal(j.creditsCharged, price("eleven_text_to_sound_v2", 5));
  const sent = JSON.parse(calls.find((c) => c.url.startsWith("/v1/sound-generation"))!.body);
  assert.deepEqual([sent.duration_seconds, sent.loop], [5, true]);
  assert.equal(await lib.credits.getBalance(USER), 500 - j.creditsCharged);
});

test("music: 60 s by default, capped at 240 s, charged on the length, a refused prompt costs nothing", { skip }, async () => {
  await reset(2000);
  assert.equal((await start({ kind: "music", model: "music_v2_5", text: "calm piano", durationSec: 241 })).ok, false);
  const r = await start({ kind: "music", model: "music_v2_5", text: "calm piano", instrumental: true });
  const row = await lib.db.audioJob.findUnique({ where: { id: r.item.id } });
  assert.equal(row.creditsHeld, price("music_v2_5", 60));
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.equal(j.creditsCharged, price("music_v2_5", 60));
  const sent = JSON.parse(calls.find((c) => c.url.startsWith("/v1/music"))!.body);
  assert.deepEqual([sent.model_id, sent.force_instrumental, sent.music_length_ms], ["music_v2_5", true, 60000]);
  const before = await lib.credits.getBalance(USER);
  const bad = await start({ kind: "music", model: "music_v2_5", text: "like Taylor", durationSec: 30 });
  const jb = await waitDone(bad.item.id);
  assert.equal(jb.status, "failed");
  assert.match(jb.error, /artists or include lyrics/);
  assert.equal(await lib.credits.getBalance(USER), before, "nothing charged, hold released");
});

test("transcribe (ElevenLabs): signed link, transcript with speakers kept, charged on the real length, the recording deleted", { skip }, async () => {
  await reset(500);
  const key = putInput(USER, "talk.mp3", 20000);
  const r = await start({ kind: "stt", model: "scribe_v2", inputKey: key, inputName: "talk.mp3", diarize: true });
  assert.equal(r.ok, true, r.error);
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.equal(j.storageKey, null);
  const item = await lib.jobs.toAudioItem(j);
  assert.equal(item.kind, "stt");
  assert.deepEqual(item.transcript.segments.map((s: { speaker: string }) => s.speaker), ["Speaker 1", "Speaker 2"]);
  assert.equal(j.creditsCharged, price("scribe_v2", 1.6));
  assert.equal(objects.has(`/bkt/${key}`), false, "the recording is not kept");
  assert.equal(await lib.db.audioJob.count({ where: { userId: USER, kind: "stt" } }), 1);
});

test("transcribe: another person's file, a model without speakers, a file that is too large and one that never finished uploading are refused", { skip }, async () => {
  await reset(500);
  assert.equal((await start({ kind: "stt", model: "scribe_v2", inputKey: putInput(OTHER, "x.mp3", 5000), inputName: "x" })).ok, false);
  assert.equal((await start({ kind: "stt", model: "asr-1.0", inputKey: putInput(USER, "y.mp3", 5000), inputName: "y", diarize: true })).ok, false);
  assert.equal((await start({ kind: "stt", model: "scribe_v2", inputKey: `audio/${USER}/in/missing.mp3`, inputName: "m" })).ok, false);
  const big = putInput(USER, "big.mp3", 51 * 1048576);
  const r = await start({ kind: "stt", model: "asr-1.0", inputKey: big, inputName: "big" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(objects.has(`/bkt/${big}`), false, "a refused recording is deleted");
});

test("transcribe (Fish): the provider gets the file's bytes from storage", { skip }, async () => {
  await reset(500);
  const key = putInput(USER, "fish.mp3", 30000);
  const r = await start({ kind: "stt", model: "transcribe-1-pro", inputKey: key, inputName: "fish.mp3" });
  assert.equal(r.ok, true, r.error);
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.equal((await lib.jobs.toAudioItem(j)).transcript.text, "Fish heard this");
  assert.equal(j.creditsCharged, price("transcribe-1-pro", 12));
});

test("long MiniMax text runs on the provider's side, is followed by polls, and is charged and stored exactly once even when polls overlap", { skip }, async () => {
  await reset(2000);
  const text = "This is a long sentence that goes on. ".repeat(100); // 3,800 characters
  const r = await start({ kind: "tts", model: "speech-2.8-hd", text, voiceId: "voiceA" });
  assert.equal(r.ok, true, r.error);
  for (let i = 0; i < 60; i++) { const j = await lib.db.audioJob.findUnique({ where: { id: r.item.id } }); if (j.params?.task) break; await new Promise((x) => setTimeout(x, 50)); }
  const started = await lib.db.audioJob.findUnique({ where: { id: r.item.id } });
  assert.equal(started.params.task.id, "424242");
  assert.equal(started.status, "pending", "the job waits for the provider");
  assert.equal(calls.filter((c) => c.url === "/v1/t2a_async_v2").length, 1);
  await Promise.all([1, 2, 3].map(() => lib.jobs.getAudioJob(USER, r.item.id))); // overlapping polls: one holds the lock, the rest return
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}.mp3`));
  assert.equal(j.creditsCharged, price("speech-2.8-hd", text.length));
  assert.equal(await lib.db.creditLedger.count({ where: { userId: USER, reason: "CHARGE" } }), 1);
  assert.equal(j.lockedAt, null);
});

test("a long job the provider fails ends as failed with nothing charged", { skip }, async () => {
  await reset(2000);
  task.failed = true;
  const r = await start({ kind: "tts", model: "speech-2.8-hd", text: "A sentence that repeats here. ".repeat(130), voiceId: "voiceA" });
  assert.equal(r.ok, true, r.error);
  for (let i = 0; i < 60; i++) { const j = await lib.db.audioJob.findUnique({ where: { id: r.item.id } }); if (j.params?.task) break; await new Promise((x) => setTimeout(x, 50)); }
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "failed");
  assert.match(j.error, /Nothing was charged/);
  assert.equal(await lib.credits.getBalance(USER), 2000);
});

test("the list moves a long job on by itself (the browser asks it every 2 seconds)", { skip }, async () => {
  await reset(2000);
  const r = await start({ kind: "tts", model: "speech-2.6-turbo", text: "Another sentence goes here. ".repeat(140), voiceId: "voiceA" });
  for (let i = 0; i < 60; i++) { const j = await lib.db.audioJob.findUnique({ where: { id: r.item.id } }); if (j.params?.task) break; await new Promise((x) => setTimeout(x, 50)); }
  let done = false;
  for (let i = 0; i < 20 && !done; i++) { const rows = await lib.jobs.listAudioJobs(USER, 10); done = rows.find((x: { id: string }) => x.id === r.item.id)?.status === "completed"; }
  assert.equal(done, true);
});
