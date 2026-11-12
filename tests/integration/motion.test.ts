// Design Studio Motion against a throwaway Postgres with a scripted model and fake sound jobs (no real keys).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const A = "user_motion_a";
const sample = readFileSync(new URL("../fixtures/motion-sample.js", import.meta.url), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, agent: any, spec: any;

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "";
  db = (await import("../../src/lib/db")).db;
  agent = await import("../../src/lib/design/motion/agent");
  spec = await import("../../src/lib/design/motion/spec");
  await clean();
});
after(async () => { if (skip) return; await clean(); await db.$disconnect(); });
const clean = async () => { await db.motionVersion.deleteMany({ where: { userId: A } }); await db.motion.deleteMany({ where: { userId: A } }); await db.generation.deleteMany({ where: { userId: { in: [A, "user_motion_b"] } } }); };

async function fresh(settings: object = {}) {
  const s = spec.cleanSettings(settings);
  const m = await db.motion.create({ data: { userId: A, prompt: "GO BEYOND", settings: s } });
  const v = await db.motionVersion.create({ data: { motionId: m.id, userId: A, n: 1, label: "GO BEYOND" } });
  return { m, v, s };
}
function deps(outs: object[], log: string[] = []) {
  let i = 0;
  return {
    log,
    write: async (o: { model: string; content: unknown[] }) => { log.push(`write:${o.model}`); const r = outs[Math.min(i, outs.length - 1)]; i++; return r; },
    startAudio: async (inp: { kind: string }) => { log.push(`start:${inp.kind}`); return { ok: true, item: { id: `job-${inp.kind}` } }; },
    quoteAudio: async (inp: { kind: string }) => { log.push(`quote:${inp.kind}`); return { ok: true, quote: 3 }; },
    voice: async () => ({ id: "v1", name: "Voice" }),
    images: async () => ({ ok: true, images: [] }),
  };
}

test("a brief becomes a ready version with code, plan, length and the title", { skip }, async () => {
  const { m, v, s } = await fresh({ duration: "auto" });
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: s, brief: "GO BEYOND", kit: null }, deps([{ title: "Go Beyond", plan: "0-2s GO", duration: 7, code: sample }]));
  const r = await db.motionVersion.findUnique({ where: { id: v.id } });
  assert.equal(r.status, "ready"); assert.equal(r.code, sample); assert.equal(r.duration, 7); assert.equal(r.plan, "0-2s GO");
  assert.equal((await db.motion.findUnique({ where: { id: m.id } })).title, "Go Beyond");
});

test("broken code gets one repair; still broken fails with plain wording", { skip }, async () => {
  const a = await fresh({ duration: 6 });
  const log: string[] = [];
  await agent.runVersion({ versionId: a.v.id, userId: A, personId: A, settings: a.s, brief: "x", kit: null }, deps([{ code: "return { render( {", plan: "p", duration: 6 }, { code: sample, plan: "p", duration: 6 }], log));
  assert.equal((await db.motionVersion.findUnique({ where: { id: a.v.id } })).status, "ready");
  assert.equal(log.filter((l) => l.startsWith("write")).length, 2);
  const b = await fresh();
  await agent.runVersion({ versionId: b.v.id, userId: A, personId: A, settings: b.s, brief: "x", kit: null }, deps([{ code: "fetch('/x')", plan: "p", duration: 6 }]));
  const r = await db.motionVersion.findUnique({ where: { id: b.v.id } });
  assert.equal(r.status, "failed"); assert.doesNotMatch(r.error, /fetch|Anthropic|Claude/);
});

test("ask first: sound waits for approval with prices, nothing is started", { skip }, async () => {
  const { v, s } = await fresh({ audio: { music: true, voice: true }, approval: "ask", duration: 10 });
  const d = deps([{ code: sample, plan: "p", duration: 10, music: "upbeat synth", voiceover: "Go beyond." }]);
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: s, brief: "x", kit: null }, d);
  const r = await db.motionVersion.findUnique({ where: { id: v.id } });
  assert.equal(r.status, "approval");
  assert.equal(r.audio.approval, "waiting"); assert.equal(r.audio.music.credits, 3); assert.equal(r.audio.voice.prompt, "Go beyond.");
  assert.ok(!d.log.some((l) => l.startsWith("start:")));
  // Approving starts each sound once, even when asked twice.
  await db.motionVersion.update({ where: { id: v.id }, data: { audio: { ...r.audio, approval: "approved" }, status: "finishing" } });
  await agent.startSound(v.id, A, d); await agent.startSound(v.id, A, d);
  assert.deepEqual(d.log.filter((l) => l.startsWith("start:")).sort(), ["start:music", "start:tts"]);
});

test("auto approve starts the sound at once; a sound that was not asked for is never made", { skip }, async () => {
  const { v, s } = await fresh({ audio: { sfx: true }, approval: "auto", duration: 8 });
  const d = deps([{ code: sample, plan: "p", duration: 8, sfx: "whooshes", music: "should be ignored" }]);
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: s, brief: "x", kit: null }, d);
  const r = await db.motionVersion.findUnique({ where: { id: v.id } });
  assert.equal(r.status, "finishing"); assert.equal(r.audio.sfx.jobId, "job-sfx"); assert.equal(r.audio.music, undefined);
  assert.deepEqual(d.log.filter((l) => l.startsWith("start:")), ["start:sfx"]);
});

test("a Stop pressed while writing wins: the result is not saved over it", { skip }, async () => {
  const { v, s } = await fresh();
  const d = deps([]);
  d.write = async () => { await db.motionVersion.update({ where: { id: v.id }, data: { status: "stopped" } }); return { code: sample, plan: "p", duration: 5 }; };
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: s, brief: "x", kit: null }, d);
  const r = await db.motionVersion.findUnique({ where: { id: v.id } });
  assert.equal(r.status, "stopped"); assert.equal(r.code, null);
});

test("an edit sends the current code, the change and the pinned comments with their place and time", { skip }, async () => {
  const { v, s } = await fresh({ aspect: "16:9" });
  let seen = "";
  const d = deps([{ code: sample, plan: "p", duration: 6 }]);
  d.write = async (o: { model: string; content: unknown[] }) => { seen = (o.content as { text?: string }[]).map((c) => c.text ?? "").join("\n"); return { code: sample, plan: "p", duration: 6 }; };
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: { ...s, aspect: "9:16" }, brief: "make it gold", kit: null,
    base: { code: "return { render(){} }", duration: 6, aspect: "16:9" }, comments: [{ id: "c", t: 3.2, x: 0.4, y: 0.6, text: "bigger here", at: "" }] }, d);
  assert.match(seen, /CURRENT MOTION/); assert.match(seen, /make it gold/); assert.match(seen, /at 3\.2s, at 40% across and 60% down/); assert.match(seen, /Re-compose it for 9:16/);
});

test("clips: only this workspace's own finished, non-binned videos are kept, with their recorded length", { skip }, async () => {
  const server = await import("../../src/lib/design/motion/server");
  const mk = (data: Record<string, unknown>) => db.generation.create({ data: { userId: A, prompt: "waves at dawn", kind: "video", status: "completed", storageKey: "u/a/c.mp4", durationSec: 6.5, ...data } });
  const mine = await mk({}), binned = await mk({ deletedAt: new Date() }), running = await mk({ status: "pending" }), pic = await mk({ kind: "image" }), other = await mk({ userId: "user_motion_b" });
  const s = await server.checkedSettings(A, { clips: [mine, binned, running, pic, other].map((g) => ({ id: g.id, label: "x" })) });
  assert.deepEqual(s.clips, [{ id: mine.id, label: "x", duration: 6.5 }]);
});

test("the voiceover uses the person's default voice when one is set", { skip }, async () => {
  const { v, s } = await fresh({ audio: { voice: true }, approval: "auto", duration: 6, defaults: { voiceModel: "eleven_v4", voiceId: "voice-ana", voiceName: "Ana" } });
  const inputs: Record<string, unknown>[] = [];
  const d = deps([{ code: sample, plan: "p", duration: 6, voiceover: "Go beyond." }]);
  d.startAudio = async (inp: Record<string, unknown>) => { inputs.push(inp); return { ok: true, item: { id: "job-tts" } }; };
  await agent.runVersion({ versionId: v.id, userId: A, personId: A, settings: s, brief: "x", kit: null }, d);
  assert.equal(inputs[0]?.voiceId, "voice-ana"); assert.equal(inputs[0]?.model, "eleven_v4"); assert.equal(inputs[0]?.voiceName, "Ana");
});
