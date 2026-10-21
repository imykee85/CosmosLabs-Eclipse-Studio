// Seedance 2.5 Edit/Extend and reference audio against a throwaway Postgres, a fake Higgsfield and a fake R2 (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_vedit_a", B = "user_vedit_b";
let hf: Server, r2: Server;
const sent: { path: string; body: Record<string, unknown> }[] = [];
const body = (req: IncomingMessage) => new Promise<string>((res) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => res(s)); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

before(async () => {
  if (skip) return;
  hf = createServer(async (req, res) => {
    sent.push({ path: req.url ?? "", body: JSON.parse((await body(req)) || "{}") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "queued", request_id: `rq${sent.length}`, status_url: `http://127.0.0.1:${(hf.address() as { port: number }).port}/requests/rq${sent.length}/status`, cancel_url: "" }));
  });
  r2 = createServer((_req, res) => { res.end("x"); });
  const hp = await new Promise<number>((r) => hf.listen(0, "127.0.0.1", () => r((hf.address() as { port: number }).port)));
  const rp = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { HIGGSFIELD_API_KEY: "id:secret", HIGGSFIELD_BASE_URL: `http://127.0.0.1:${hp}`, HIGGSFIELD_VIDEO_BASE_URL: `http://127.0.0.1:${hp}`, R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", CREDITS_ENABLED: "", ROUTE_SEEDANCE_2_5: "higgsfield" }); // these tests are about the Higgsfield endpoints: the owner's manual switch
  lib = { edit: await import("../../src/lib/video-edit"), refs: await import("../../src/lib/references"), db: (await import("../../src/lib/db")).db };
  await clean();
  await lib.db.generation.create({ data: { id: "vsrc1", userId: A, kind: "video", prompt: "a cat", status: "completed", imageUrl: "", storageKey: "u/a/clip.mp4", model: "seedance_2_5", durationSec: 6, aspectRatio: "16:9" } });
  await lib.db.audioJob.create({ data: { id: "aud1", userId: A, kind: "music", provider: "elevenlabs", model: "music_v2_5", text: "drums", textHash: "h", chars: 5, status: "completed", storageKey: "audio/a/aud1.mp3" } });
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); hf.close(); r2.close(); });
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.audioJob.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.usageEvent.deleteMany({ where: { userId: { in: [A, B] } } });
};

test("Edit sends the source clip and prompt, no duration", { skip }, async () => {
  const r = await lib.edit.startVideoEdit({ userId: A, sourceId: "vsrc1", mode: "edit", prompt: "make it night", resolution: "480p", audio: false });
  assert.equal(r.ok, true, r.error);
  const last = sent[sent.length - 1];
  assert.match(last.path, /bytedance\/seedance-2\.5\/video-edit$/);
  assert.equal(last.body.prompt, "make it night");
  assert.equal(last.body.resolution, "480p");
  assert.equal(last.body.generate_audio, false);
  assert.ok(String(last.body.video_url).includes("u/a/clip.mp4"), "a signed link to our stored copy");
  assert.equal("duration" in last.body, false);
  const row = await lib.db.generation.findUnique({ where: { id: r.item.id } });
  assert.equal(row.status, "pending"); assert.equal(row.durationSec, 6); assert.equal((row.params as { workflow: string }).workflow, "edit");
});

test("Extend sends the extension length and checks it", { skip }, async () => {
  const r = await lib.edit.startVideoEdit({ userId: A, sourceId: "vsrc1", mode: "extend", prompt: "and then it jumps", duration: 8 });
  assert.equal(r.ok, true, r.error);
  const last = sent[sent.length - 1];
  assert.match(last.path, /video-extend$/);
  assert.equal(last.body.duration, 8);
  const bad = await lib.edit.startVideoEdit({ userId: A, sourceId: "vsrc1", mode: "extend", prompt: "x", duration: 31 });
  assert.equal(bad.ok, false); assert.equal(bad.status, 400);
});

test("someone else's video, empty prompts and unknown modes are refused", { skip }, async () => {
  const n = sent.length;
  assert.equal((await lib.edit.startVideoEdit({ userId: B, sourceId: "vsrc1", mode: "edit", prompt: "x" })).status, 404);
  assert.equal((await lib.edit.startVideoEdit({ userId: A, sourceId: "vsrc1", mode: "edit", prompt: " " })).status, 400);
  assert.equal((await lib.edit.startVideoEdit({ userId: A, sourceId: "vsrc1", mode: "remix", prompt: "x" })).status, 400);
  assert.equal(sent.length, n, "nothing reached the provider");
});

test("reference audio: own finished takes only", { skip }, async () => {
  const ok = await lib.refs.resolveAudioReferences(A, ["aud1"]);
  assert.equal(ok.ok, true); assert.ok(ok.urls[0].includes("audio/a/aud1.mp3"));
  assert.equal((await lib.refs.resolveAudioReferences(B, ["aud1"])).ok, false);
});
