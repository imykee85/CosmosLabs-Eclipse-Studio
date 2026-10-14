// Voice cloning and design (src/lib/audio/voices.ts) against a throwaway Postgres and a fake ElevenLabs. Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
const A = "user_voices_a", B = "user_voices_b";
const calls: { method?: string; url?: string; body: string }[] = [];
let srv: Server;
let failClone = false;

const body = (req: IncomingMessage) => new Promise<string>((res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => res(b)); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const mp3 = () => new Uint8Array(Buffer.concat([Buffer.from("ID3\x04\x00"), Buffer.alloc(2000, 1)]));

before(async () => {
  if (skip) return;
  srv = createServer(async (req, res) => {
    const b = await body(req);
    calls.push({ method: req.method, url: req.url, body: b });
    const json = (o: unknown, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/v1/voices/add") return failClone ? json({ detail: { code: "system_busy", message: "x" } }, 429) : json({ voice_id: `vc_${calls.length}`, requires_verification: false });
    if (req.url === "/v1/text-to-voice/design") return json({ previews: [{ generated_voice_id: "genA", audio_base_64: Buffer.from("ID3x").toString("base64"), media_type: "audio/mpeg", duration_secs: 5 }] });
    if (req.url === "/v1/text-to-voice") return json({ voice_id: "designed_1" });
    if (req.method === "DELETE") return req.url!.endsWith("/stuck") ? json({ detail: { code: "service_unavailable" } }, 503) : json({ status: "ok" });
    json({}, 404);
  });
  const port = await new Promise<number>((r) => srv.listen(0, "127.0.0.1", () => r((srv.address() as { port: number }).port)));
  Object.assign(process.env, { ELEVENLABS_API_KEY: "k", ELEVENLABS_BASE_URL: `http://127.0.0.1:${port}`, CREDITS_ENABLED: "1", AUDIO_CLONE_CREDITS: "40", AUDIO_DESIGN_CREDITS: "60" });
  lib = { v: await import("../../src/lib/audio/voices"), credits: await import("../../src/lib/credits"), db: (await import("../../src/lib/db")).db };
});
const wipe = async () => { for (const u of [A, B]) for (const t of ["userVoice", "creditLedger", "usageEvent"]) await lib.db[t].deleteMany({ where: { userId: u } }); calls.length = 0; failClone = false; };
after(async () => { if (skip) return; await wipe(); await lib.db.$disconnect(); srv.close(); });

const clone = (over: Record<string, unknown> = {}) => lib.v.cloneOwnVoice({ userId: A, provider: "elevenlabs", name: "My voice", consent: true, sample: mp3(), ...over });

test("a clone needs consent, is stored with the consent record, charged once, and listed first", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 100, { reason: "GRANT", note: "t" });
  const no = await clone({ consent: false });
  assert.equal(no.ok, false);
  assert.equal(calls.length, 0, "nothing reaches the provider without consent");
  const r = await clone();
  assert.equal(r.ok, true, r.error);
  const row = await lib.db.userVoice.findFirst({ where: { userId: A } });
  assert.equal(row.kind, "cloned");
  assert.equal(row.provider, "elevenlabs");
  assert.ok(row.consentAt && row.consentVersion === lib.v.CONSENT_VERSION);
  assert.match(row.sampleHash, /^[0-9a-f]{64}$/);
  assert.equal(await lib.credits.getBalance(A), 60);
  assert.equal(await lib.db.creditLedger.count({ where: { userId: A, reason: "CHARGE" } }), 1);
  const list = await lib.v.listOwnVoices(A, "elevenlabs");
  assert.deepEqual(list.map((x: { voiceId: string; own: boolean }) => [x.voiceId, x.own]), [[row.providerVoiceId, true]]);
  assert.deepEqual(await lib.v.listOwnVoices(B, "elevenlabs"), [], "another person sees none of it");
  assert.deepEqual(await lib.v.listOwnVoices(A, "fish"), []);
});

test("refused before any call or charge: not audio, too large, no name, too little credit, a provider that cannot clone", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 100, { reason: "GRANT", note: "t" });
  assert.equal((await clone({ sample: new Uint8Array(Buffer.from("MZ not audio at all")) })).ok, false);
  assert.equal((await clone({ sample: new Uint8Array(4_000_001).fill(1) })).ok, false);
  assert.equal((await clone({ name: " " })).ok, false);
  assert.equal((await clone({ provider: "qwen" })).ok, false);
  assert.equal((await clone({ provider: "minimax" })).ok, false, "minimax has no key here: not connected");
  await lib.credits.spendCredits(A, 80, "t");
  const poor = await clone();
  assert.equal(poor.ok, false);
  assert.equal(poor.status, 402);
  assert.equal(calls.length, 0);
  assert.equal(await lib.db.userVoice.count({ where: { userId: A } }), 0);
});

test("a provider failure leaves no voice and no charge", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 100, { reason: "GRANT", note: "t" });
  failClone = true;
  const r = await clone();
  assert.equal(r.ok, false);
  assert.equal(await lib.db.userVoice.count({ where: { userId: A } }), 0);
  assert.equal(await lib.credits.getBalance(A), 100);
});

test("clone attempts are rate limited", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 1000, { reason: "GRANT", note: "t" });
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await clone({ name: `Voice ${i}` }));
  assert.equal(out.filter((o) => o.ok).length, 5);
  assert.equal(out[5].status, 429);
});

test("design: previews are signed for the person, a wrong signature is refused, saving twice keeps one voice, only the design is charged", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 200, { reason: "GRANT", note: "t" });
  const d = await lib.v.designOwnVoice({ userId: A, provider: "elevenlabs", description: "A warm calm narrator in her forties, soft accent" });
  assert.equal(d.ok, true, d.error);
  assert.match(d.previews[0].url, /^data:audio\/mpeg;base64,/);
  assert.equal(await lib.credits.getBalance(A), 140);
  assert.equal((await lib.v.designOwnVoice({ userId: A, provider: "elevenlabs", description: "short" })).ok, false);
  const p = d.previews[0];
  const args = { provider: "elevenlabs", token: p.token, sig: p.sig, name: "Warm", description: "A warm calm narrator in her forties, soft accent" };
  assert.equal((await lib.v.saveDesignedVoice({ userId: B, ...args })).ok, false, "another person cannot keep this preview");
  assert.equal((await lib.v.saveDesignedVoice({ userId: A, ...args, sig: "0".repeat(32) })).ok, false);
  const one = await lib.v.saveDesignedVoice({ userId: A, ...args });
  const two = await lib.v.saveDesignedVoice({ userId: A, ...args });
  assert.equal(one.ok && two.ok, true, JSON.stringify([one.error, two.error]));
  assert.equal(one.voice.ownId, two.voice.ownId);
  assert.equal(await lib.db.userVoice.count({ where: { userId: A } }), 1);
  assert.equal(await lib.credits.getBalance(A), 140, "saving is free");
  // a double tap: two saves of one preview at the same moment still make one voice
  const q = await lib.v.designOwnVoice({ userId: A, provider: "elevenlabs", description: "A bright energetic young man with a fast pace" });
  const both = await Promise.all([1, 2].map(() => lib.v.saveDesignedVoice({ userId: A, provider: "elevenlabs", token: q.previews[0].token, sig: q.previews[0].sig, name: "Bright", description: "A bright energetic young man with a fast pace" })));
  assert.equal(both[0].ok && both[1].ok, true);
  assert.equal(both[0].voice.ownId, both[1].voice.ownId);
});

test("deleting removes the voice at the provider too; another person's id is not found; a provider that cannot delete keeps the row", { skip }, async () => {
  await wipe();
  await lib.credits.grantCredits(A, 500, { reason: "GRANT", note: "t" });
  const r = await clone();
  const id = r.voice.ownId;
  assert.equal((await lib.v.deleteOwnVoice(B, id)).status, 404);
  assert.equal(await lib.db.userVoice.count({ where: { id } }), 1);
  calls.length = 0;
  assert.equal((await lib.v.deleteOwnVoice(A, id)).ok, true);
  assert.ok(calls.some((c) => c.method === "DELETE" && c.url === `/v1/voices/${r.voice.voiceId}`));
  assert.equal(await lib.db.userVoice.count({ where: { id } }), 0);
  const stuck = await lib.db.userVoice.create({ data: { userId: A, provider: "elevenlabs", providerVoiceId: "stuck", name: "Stuck", kind: "cloned" } });
  const bad = await lib.v.deleteOwnVoice(A, stuck.id);
  assert.equal(bad.ok, false);
  assert.equal(await lib.db.userVoice.count({ where: { id: stuck.id } }), 1, "kept so it can be tried again");
});

test("a MiniMax clone warns when it is close to its 7-day expiry", { skip }, async () => {
  const day = 86_400_000;
  const mk = (daysAgo: number) => ({ id: "x", userId: A, provider: "minimax", providerVoiceId: "v", name: "n", kind: "cloned", description: null, consentAt: null, consentVersion: null, sampleHash: null, lastUsedAt: null, createdAt: new Date(Date.now() - daysAgo * day) });
  assert.equal(lib.v.toOwnItem(mk(1)).descriptive, "Your clone");
  assert.match(lib.v.toOwnItem(mk(5)).descriptive, /use within 2 days/);
  assert.match(lib.v.toOwnItem(mk(8)).descriptive, /may have expired/);
});
