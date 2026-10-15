// Voice Studio phase 2 providers end to end (job, storage, charge) against a throwaway Postgres, ONE fake server that answers like Fish, MiniMax, Qwen and Seed
// Audio, and a fake R2. Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself without DATABASE_URL)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
const USER = "user_audio_providers";
const objects = new Map<string, Buffer>();
const calls: { url: string; body: string }[] = [];
let prov: Server, r2: Server;

const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const listen = (s: Server) => new Promise<number>((res) => s.listen(0, "127.0.0.1", () => res((s.address() as { port: number }).port)));
function wav(samples: number): Buffer {
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
let base = "";

before(async () => {
  if (skip) return;
  prov = createServer(async (req, res) => {
    const b = (await body(req)).toString();
    calls.push({ url: req.url ?? "", body: b });
    const json = (o: unknown) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    if (req.url === "/v1/tts") { res.setHeader("content-type", "audio/mpeg"); res.end(Buffer.alloc(16000, 3)); return; }
    if (req.url === "/v1/t2a_v2") return json({ data: { audio: Buffer.alloc(8000, 5).toString("hex") }, extra_info: { audio_length: 500, usage_characters: 10 }, base_resp: { status_code: 0 } });
    if (req.url === "/api/v1/services/aigc/multimodal-generation/generation") return json({ output: { audio: { url: `${base}/files/piece.wav` } }, usage: { characters: 10 } });
    if (req.url === "/files/piece.wav") { res.setHeader("content-type", "audio/wav"); res.end(wav(24000)); return; } // one second
    if (req.url === "/tts/create") return json({ code: 0, audio: Buffer.alloc(4000, 9).toString("base64"), duration: 30, original_duration: 30 });
    res.statusCode = 404; res.end();
  });
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const [pp, rp] = [await listen(prov), await listen(r2)];
  base = `http://127.0.0.1:${pp}`;
  Object.assign(process.env, {
    FISH_API_KEY: "f", FISH_BASE_URL: base, MINIMAX_API_KEY: "m", MINIMAX_BASE_URL: base, DASHSCOPE_API_KEY: "q", DASHSCOPE_BASE_URL: base, BYTEPLUS_VOICE_API_KEY: "s", BYTEPLUS_VOICE_BASE_URL: base,
    R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt",
    CREDITS_ENABLED: "1", AUDIO_JOBS_PER_MINUTE: "1000", AUDIO_JOBS_PER_DAY: "1000", AUDIO_MAX_RUNNING: "10",
  });
  lib = { jobs: await import("../../src/lib/audio/jobs"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db, pricing: await import("../../src/lib/audio/pricing"), registry: await import("../../src/lib/audio/registry") };
});
after(async () => { if (skip) return; await lib.db.audioJob.deleteMany({ where: { userId: USER } }); await lib.db.creditLedger.deleteMany({ where: { userId: USER } }); await lib.db.usageEvent.deleteMany({ where: { userId: USER } }); await lib.db.$disconnect(); prov.close(); r2.close(); });

const reset = async (credits: number) => {
  for (const t of ["audioJob", "creditLedger", "usageEvent"]) await lib.db[t].deleteMany({ where: { userId: USER } });
  await lib.credits.grantCredits(USER, credits, { reason: "GRANT", note: "test" });
  calls.length = 0; objects.clear();
};
const waitDone = async (id: string) => { for (let i = 0; i < 200; i++) { const j = await lib.jobs.getAudioJob(USER, id); if (j && j.status !== "pending") return j; await new Promise((r) => setTimeout(r, 50)); } throw new Error("job did not finish"); };
const run = async (over: Record<string, unknown>) => { const r = await lib.jobs.startAudioJob({ userId: USER, text: "Hello world. This is a test.", voiceId: "v1", voiceName: "Voice", ...over }); assert.equal(r.ok, true, r.error); return waitDone(r.item.id); };
const price = (id: string, units: number) => lib.pricing.creditsFor(lib.pricing.usdFor(lib.registry.findAudioModel(id), units));

test("Fish: made, stored as MP3, charged on UTF-8 bytes", { skip }, async () => {
  await reset(1000);
  const text = "Héllo wörld. Ünïcode costs more bytes.";
  const j = await run({ model: "s2.1-pro", text });
  assert.equal(j.status, "completed", j.error);
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}.mp3`));
  assert.equal(j.creditsCharged, price("s2.1-pro", Buffer.byteLength(text, "utf8")));
  assert.equal(j.usage.units, Buffer.byteLength(text, "utf8"));
});

test("Fish: (parenthesis) tags are refused before anything is held or sent", { skip }, async () => {
  await reset(1000);
  const r = await lib.jobs.startAudioJob({ userId: USER, text: "(happy) Hello.", model: "s2.1-pro", voiceId: "v1" });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test("MiniMax: hex audio decoded and stored, the reported length kept", { skip }, async () => {
  await reset(1000);
  const j = await run({ model: "speech-2.8-hd" });
  assert.equal(j.status, "completed", j.error);
  assert.equal(j.sizeBytes, 8000);
  assert.equal(j.durationMs, 500);
  assert.equal(JSON.parse(calls[0].body).output_format, "hex");
});

test("Qwen: a long text is split under 600 characters, the WAV pieces joined into one file", { skip }, async () => {
  await reset(1000);
  const text = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here to make the text long enough.`).join(" ");
  const j = await run({ model: "qwen3-tts-flash", voiceId: "Cherry", text });
  assert.equal(j.status, "completed", j.error);
  const gens = calls.filter((c) => c.url.includes("multimodal"));
  assert.ok(gens.length >= 3);
  for (const g of gens) assert.ok(JSON.parse(g.body).input.text.length <= 600);
  assert.equal(j.contentType, "audio/wav");
  assert.equal(j.durationMs, gens.length * 1000);
  assert.ok(objects.has(`/bkt/audio/${USER}/${j.id}.wav`));
});

test("Seed Audio: runs without a voice, holds 120 s and charges the reported seconds", { skip }, async () => {
  await reset(1000);
  const r = await lib.jobs.startAudioJob({ userId: USER, text: "A calm narrator in a rainy street.", model: "seed-audio-1.0", voiceId: "" });
  assert.equal(r.ok, true, r.error);
  const row = await lib.db.audioJob.findUnique({ where: { id: r.item.id } });
  assert.equal(row.creditsHeld, price("seed-audio-1.0", 120));
  const j = await waitDone(r.item.id);
  assert.equal(j.status, "completed", j.error);
  assert.equal(j.creditsCharged, price("seed-audio-1.0", 30));
  assert.equal(JSON.parse(calls[0].body).references, undefined);
  assert.equal(await lib.credits.getBalance(USER), 1000 - j.creditsCharged);
});

test("a model that needs a voice refuses an empty one", { skip }, async () => {
  await reset(1000);
  const r = await lib.jobs.startAudioJob({ userId: USER, text: "Hello.", model: "speech-2.8-hd", voiceId: "" });
  assert.equal(r.ok, false);
});
