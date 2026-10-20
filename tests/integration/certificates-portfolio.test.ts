// Certificates and portfolio media against a throwaway Postgres and a fake R2 (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server;
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const A = "user_cert_a", B = "user_cert_b";
const PIC = Buffer.from("not really a picture but some stable bytes ".repeat(500));

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const port = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${port}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt" });
  lib = { certs: await import("../../src/lib/certificates"), db: (await import("../../src/lib/db")).db, certMedia: await import("../../src/app/api/public/cert/[code]/media/route"), pubMedia: await import("../../src/app/api/public/p/[slug]/[id]/route") };
  await clean();
  objects.set("/bkt/u/a/pic.png", PIC);
  objects.set("/bkt/u/a/clip.mp4", Buffer.alloc(300_000, 3));
  objects.set("/bkt/audio/a/take.mp3", Buffer.alloc(16_000, 7));
});
const clean = async () => {
  await lib.db.certificate.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.portfolio.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.generation.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.audioJob.deleteMany({ where: { userId: { in: [A, B] } } });
  await lib.db.usageEvent.deleteMany({ where: { userId: { in: [A, B] } } });
};
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); r2.close(); });

const gen = (data: Record<string, unknown>) => lib.db.generation.create({ data: { userId: A, prompt: "a red fox", status: "completed", storageKey: "u/a/pic.png", contentType: "image/png", width: 1024, height: 768, model: "soul_v2", ...data } });

test("issues a certificate with the file's real SHA-256, once", { skip }, async () => {
  const g = await gen({});
  const [r1, r2_] = await Promise.all([lib.certs.issueCertificate(A, "render", g.id), lib.certs.issueCertificate(A, "render", g.id)]);
  assert.ok(r1.ok && r2_.ok);
  assert.equal(r1.certificate.id, r2_.certificate.id, "a double tap gives one certificate");
  assert.equal(r1.certificate.sha256, sha(PIC));
  assert.equal(r1.certificate.sizeBytes, PIC.length);
  assert.match(r1.certificate.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(r1.certificate.showPrompt, false);
  assert.equal(r1.certificate.showMedia, false);
  assert.equal(r1.certificate.facts.prompt, "a red fox");
  assert.equal(await lib.db.certificate.count({ where: { userId: A } }), 1);
  const again = await lib.certs.issueCertificate(A, "render", g.id);
  assert.ok(again.ok && !again.created);
});

test("refuses other people's, unfinished, binned and missing creations", { skip }, async () => {
  const mine = await gen({});
  const other = await lib.certs.issueCertificate(B, "render", mine.id);
  assert.ok(!other.ok && other.status === 404);
  const pending = await gen({ status: "pending", storageKey: null });
  assert.ok(!(await lib.certs.issueCertificate(A, "render", pending.id)).ok);
  const binned = await gen({ deletedAt: new Date() });
  assert.ok(!(await lib.certs.issueCertificate(A, "render", binned.id)).ok);
  assert.ok(!(await lib.certs.issueCertificate(A, "render", "nope")).ok);
});

test("a video is fingerprinted from its stream; an audio take can be certified, a transcript cannot", { skip }, async () => {
  const v = await gen({ kind: "video", storageKey: "u/a/clip.mp4", contentType: "video/mp4", durationSec: 5 });
  const rv = await lib.certs.issueCertificate(A, "render", v.id);
  assert.ok(rv.ok); assert.equal(rv.certificate.kind, "video"); assert.equal(rv.certificate.sha256, sha(Buffer.alloc(300_000, 3)));
  const a = await lib.db.audioJob.create({ data: { userId: A, kind: "tts", provider: "elevenlabs", model: "eleven_v4", text: "Hello there", textHash: "h", chars: 11, status: "completed", storageKey: "audio/a/take.mp3", contentType: "audio/mpeg", durationMs: 1000 } });
  const ra = await lib.certs.issueCertificate(A, "audio", a.id);
  assert.ok(ra.ok); assert.equal(ra.certificate.kind, "audio"); assert.equal(ra.certificate.sha256, sha(Buffer.alloc(16_000, 7)));
  const stt = await lib.db.audioJob.create({ data: { userId: A, kind: "stt", provider: "elevenlabs", model: "scribe_v2", text: "x", textHash: "h2", chars: 1, status: "completed", storageKey: "audio/a/take.mp3" } });
  assert.ok(!(await lib.certs.issueCertificate(A, "audio", stt.id)).ok);
});

test("the public certificate file is served only when the owner chose to show it", { skip }, async () => {
  const g = await gen({});
  const r = await lib.certs.issueCertificate(A, "render", g.id);
  const code = r.certificate.code;
  const get = (c: string) => lib.certMedia.GET(new Request("http://x/"), { params: { code: c } });
  assert.equal((await get(code)).status, 404, "hidden by default");
  await lib.db.certificate.update({ where: { code }, data: { showMedia: true } });
  const ok = await get(code.toLowerCase().replace(/-/g, ""));
  assert.equal(ok.status, 200, "the file is streamed from Eclipse's own address");
  assert.equal(ok.headers.get("location"), null, "no redirect to the storage address");
  await lib.db.generation.update({ where: { id: g.id }, data: { deletedAt: new Date() } });
  assert.equal((await get(code)).status, 404, "a binned file is no longer served");
  assert.equal((await get("nonsense")).status, 404);
});

test("a published portfolio serves only chosen projects' finished media", { skip }, async () => {
  const inP = await gen({ projectId: "proj_in" });
  const outP = await gen({ projectId: "proj_out" });
  await lib.db.portfolio.create({ data: { userId: A, slug: "ana-studio", published: false, data: { headline: "Ana", projectIds: ["proj_in"], photos: {} } } });
  const get = (slug: string, id: string) => lib.pubMedia.GET(new Request("http://x/"), { params: { slug, id } });
  assert.equal((await get("ana-studio", inP.id)).status, 404, "not published yet");
  await lib.db.portfolio.update({ where: { userId: A }, data: { published: true } });
  assert.equal((await get("ana-studio", inP.id)).status, 200);
  assert.equal((await get("ana-studio", outP.id)).status, 404, "another project is not shown");
  assert.equal((await get("nobody", inP.id)).status, 404);
  const mineElsewhere = await lib.db.generation.create({ data: { userId: B, prompt: "b", status: "completed", storageKey: "u/a/pic.png", projectId: "proj_in" } });
  assert.equal((await get("ana-studio", mineElsewhere.id)).status, 404, "someone else's file with the same project id is never served");
  await lib.db.generation.update({ where: { id: inP.id }, data: { deletedAt: new Date() } });
  assert.equal((await get("ana-studio", inP.id)).status, 404, "binned");
});
