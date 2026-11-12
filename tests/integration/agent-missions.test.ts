// Atlas missions: the real database and the real loop, with a scripted model and fake image/video starts.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let m: any, db: any, credits: any;
const U = "user_mission_a", V = "user_mission_b";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
let n = 0;
const tu = (name: string, input: Record<string, unknown> = {}): Block => ({ type: "tool_use", id: `tu${++n}`, name, input });
const say = (text: string): Block => ({ type: "text", text });

// A scripted model: each call returns the next answer and records what it was shown.
function world(script: Block[][]) {
  const w = { seen: [] as unknown[][], images: [] as { prompt: unknown }[], videos: [] as { refs?: unknown }[], done: new Set<string>(), i: 0, calls: 0 };
  const deps = {
    call: async ({ messages }: { messages: unknown[] }) => {
      w.calls++;
      w.seen.push(JSON.parse(JSON.stringify(messages)));
      const content = script[Math.min(w.i++, script.length - 1)];
      return { id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn", usage: { input_tokens: 10, output_tokens: 10 } };
    },
    read: async (_u: string, _p: string, name: string) => ({ content: name === "search_library" ? "[]" : "ok" }),
    startImage: async (i: { prompt: unknown }) => { w.images.push(i); return { ok: true, item: { id: `img${w.images.length}` } }; },
    startVideo: async (i: { refs?: unknown }) => { w.videos.push(i); return { ok: true, item: { id: "vid1" } }; },
    startAudio: async () => ({ ok: true, item: { id: "aud1" } }),
    quoteAudio: async () => ({ ok: true, quote: 25 }),
    voice: async () => ({ id: "v1", name: "Voice" }),
    check: async (_k: string, id: string) => (w.done.has(id) ? { status: "completed" } : { status: "pending" }),
  };
  return { w, deps };
}
const start = async (o: Partial<{ budgetCredits: number; autopilot: boolean; user: string }> = {}) => {
  if (!o.user) await db.agentMission.updateMany({ where: { userId: U, status: { in: ["running", "waiting_approval", "waiting_user"] } }, data: { status: "canceled" } }); // each test starts with none in progress
  const r = await m.createMission({ userId: o.user ?? U, personId: o.user ?? U, projectId: "p1", goal: "Make a three picture lookbook for my sneaker", budgetCredits: o.budgetCredits ?? 0, autopilot: o.autopilot ?? false });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.row.id as string;
};

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  process.env.HIGGSFIELD_API_KEY = "test";
  m = await import("../../src/lib/agent-mission");
  db = (await import("../../src/lib/db")).db;
  credits = await import("../../src/lib/credits");
  await db.agentMission.deleteMany({ where: { userId: { in: [U, V] } } });
  await db.creditLedger.deleteMany({ where: { userId: { in: [U, V] } } });
  await credits.grantCredits(U, 10_000_000, { reason: "GRANT", provider: "test", externalId: "mission-u" });
  await credits.grantCredits(V, 10_000_000, { reason: "GRANT", provider: "test", externalId: "mission-v" });
});
after(async () => { if (skip) return; await db.agentMission.deleteMany({ where: { userId: { in: [U, V] } } }); await db.$disconnect(); });

test("a mission reads, asks before it spends, starts exactly what was approved, waits, checks and finishes, with no browser", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([
    [say("Plan: look at the Library, then make two pictures."), tu("search_library", { query: "sneaker" })],
    [say("Nothing yet. Making two."), tu("make_image", { prompt: "A sneaker on wet asphalt", aspect_ratio: "16:9" }), tu("make_image", { prompt: "Close-up of the laces" })],
    [tu("wait", { seconds: 5, reason: "pictures are being made" })],
    [tu("check_job", { kind: "image", id: "img1" }), tu("check_job", { kind: "image", id: "img2" })],
    [tu("finish", { summary: "Made two pictures: img1 and img2." })],
  ]);
  let row = await m.advanceMission(id, deps);
  assert.equal(row.status, "waiting_approval", "it stops at the spend");
  assert.equal(w.images.length, 0, "nothing is made before the person approves");
  assert.equal(w.calls, 2);
  const view = m.missionView(row);
  assert.equal(view.waiting.kind, "approval");
  assert.equal(view.waiting.calls.length, 2);

  // waiting missions do not move on their own
  await m.advanceMission(id, deps);
  assert.equal(w.calls, 2);

  // someone else cannot approve it
  const other = await m.decideMission(id, V, true);
  assert.equal(other, null);
  assert.equal((await db.agentMission.findUnique({ where: { id } })).status, "waiting_approval");

  // approve twice at once: it is started once
  await Promise.all([m.decideMission(id, U, true), m.decideMission(id, U, true)]);
  row = await m.advanceMission(id, deps);
  assert.equal(w.images.length, 2, "both approved pictures started, once");
  assert.equal(row.status, "running");
  assert.ok(row.wakeAt, "it is waiting");

  // while it waits, a push does nothing
  await m.advanceMission(id, deps);
  assert.equal(w.calls, 3);

  await db.agentMission.update({ where: { id }, data: { wakeAt: null } });
  w.done.add("img1"); w.done.add("img2");
  row = await m.advanceMission(id, deps);
  assert.equal(row.status, "done");
  assert.match(row.summary, /img1/);
  assert.ok(row.committed >= 0);

  // every tool call was answered, and no picture bytes are kept in the saved transcript
  const msgs = row.messages as { role: string; content: unknown }[];
  for (let i = 0; i < msgs.length; i++) {
    const c = msgs[i].content;
    if (msgs[i].role === "assistant" && Array.isArray(c)) {
      const uses = c.filter((b: { type: string }) => b.type === "tool_use").map((b: { id: string }) => b.id);
      if (!uses.length) continue;
      const next = msgs[i + 1]?.content as { tool_use_id: string }[];
      assert.deepEqual(next.map((r) => r.tool_use_id).sort(), [...uses].sort(), "every tool call has its result");
    }
  }
  assert.ok(!JSON.stringify(msgs).includes("base64"));
});

test("a declined request is told to the agent, which changes its plan", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([
    [tu("make_video", { prompt: "A long film", duration_seconds: 20 })],
    [say("Understood, I will make a picture instead."), tu("finish", { summary: "Skipped the video." })],
  ]);
  let row = await m.advanceMission(id, deps);
  assert.equal(row.status, "waiting_approval");
  await m.decideMission(id, U, false);
  row = await m.advanceMission(id, deps);
  assert.equal(w.videos.length, 0, "nothing started");
  assert.equal(row.status, "done");
  const shown = JSON.stringify(w.seen[1]);
  assert.match(shown, /declined/);
});

test("a question waits for the person, and the answer goes back to the agent", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([
    [tu("ask_user", { question: "Which colour is the sneaker?" })],
    [tu("finish", { summary: "Used the colour you gave." })],
  ]);
  let row = await m.advanceMission(id, deps);
  assert.equal(row.status, "waiting_user");
  assert.equal(m.missionView(row).waiting.question, "Which colour is the sneaker?");
  await m.answerMission(id, V, "red"); // not theirs
  assert.equal((await db.agentMission.findUnique({ where: { id } })).status, "waiting_user");
  await m.answerMission(id, U, "Bright red");
  row = await m.advanceMission(id, deps);
  assert.equal(row.status, "done");
  assert.match(JSON.stringify(w.seen[1]), /Bright red/);
});

test("autopilot runs only inside the budget; what would go over waits for the person", { skip }, async () => {
  const id = await start({ budgetCredits: 2, autopilot: true });
  const { w, deps } = world([
    [tu("make_image", { prompt: "First picture", model: "soul_v2" })],
    Array.from({ length: 25 }, (_, i) => tu("make_image", { prompt: `Picture ${i + 2}`, model: "soul_v2" })),
    [tu("finish", { summary: "done" })],
  ]);
  let row = await m.advanceMission(id, deps);
  const budget = row.budget;
  assert.ok(w.images.length >= 1, "a priced step inside the budget went ahead by itself");
  assert.ok(row.committed <= budget, `never commits past the budget (${row.committed} of ${budget})`);
  // push until it stops on its own: it must end up asking, with the spend over the budget, and nothing past the budget started
  for (let i = 0; i < 4 && row.status === "running"; i++) row = await m.advanceMission(id, deps);
  assert.equal(row.status, "waiting_approval");
  const p = m.missionView(row).waiting;
  assert.ok(row.committed + (p.total ?? Infinity) > budget, "what waits would have gone over the budget");
  assert.ok(row.committed <= budget);
});

test("only the owner can stop a mission, and a stopped mission does nothing more", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([[tu("search_library", {})], [tu("search_library", {})]]);
  await m.cancelMission(id, V);
  assert.equal((await db.agentMission.findUnique({ where: { id } })).status, "running");
  await m.cancelMission(id, U);
  const row = await m.advanceMission(id, deps);
  assert.equal(row.status, "canceled");
  assert.equal(w.calls, 0);
});

test("three passes at once make one model call", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([[tu("wait", { seconds: 60 })]]);
  await Promise.all([m.advanceMission(id, deps), m.advanceMission(id, deps), m.advanceMission(id, deps)]);
  assert.equal(w.calls, 1);
});

test("a person can have two missions going, not three; the hand-over needs the signed token", { skip }, async () => {
  await db.agentMission.deleteMany({ where: { userId: V } });
  await start({ user: V }); await start({ user: V });
  const r = await m.createMission({ userId: V, personId: V, projectId: null, goal: "A third thing to make today", budgetCredits: 0, autopilot: false });
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  const id = (await db.agentMission.findFirst({ where: { userId: V } })).id;
  assert.equal(m.validMissionToken(id, m.missionToken(id)), true);
  assert.equal(m.validMissionToken(id, "nope"), false);
  assert.equal(m.validMissionToken(id + "x", m.missionToken(id)), false);
});

test("an agent that answers without a tool hands the conversation back instead of looping", { skip }, async () => {
  const id = await start();
  const { w, deps } = world([[say("Which style do you prefer, clean or gritty?")]]);
  let row = await m.advanceMission(id, deps);
  assert.equal(row.status, "waiting_user");
  assert.equal(w.calls, 1);
  await m.answerMission(id, U, "Gritty");
  row = await db.agentMission.findUnique({ where: { id } });
  assert.equal(row.status, "running");
});

test("sending to an app always waits for the person, even on autopilot, and only for a connected app", { skip }, async () => {
  const id = await start({ budgetCredits: 500, autopilot: true });
  await db.connectorLink.deleteMany({ where: { userId: U } });
  const { w, deps } = world([
    [tu("send_to_app", { app: "slack", text: "Hi team" })],
    [tu("finish", { summary: "done" })],
  ]);
  let row = await m.advanceMission(id, deps);
  assert.equal(row.status, "done", "an app that is not connected is refused to the agent (it carries on), not asked");
  assert.match(JSON.stringify(w.seen[1]), /not connected/);
  // connected: it is never run by itself
  await db.connectorLink.create({ data: { userId: U, connector: "slack", label: "x", secret: "x" } });
  const id2 = await start({ budgetCredits: 500, autopilot: true });
  const w2 = world([[tu("send_to_app", { app: "slack", text: "Launch is live" })]]);
  row = await m.advanceMission(id2, w2.deps);
  assert.equal(row.status, "waiting_approval");
  assert.match(m.missionView(row).waiting.calls[0].summary, /Send to slack/);
  await db.connectorLink.deleteMany({ where: { userId: U } });
});

test("the agent reads the person's canvases and library by project, and only its owner's", { skip }, async () => {
  await db.canvas.deleteMany({ where: { userId: { in: [U, V] } } });
  const mine = await db.canvas.create({ data: { userId: U, projectId: "p1", name: "Sneaker board", nodeCount: 2, data: { nodes: [{ id: "n1", type: "text", position: { x: 0, y: 0 }, data: { text: "A sneaker on wet asphalt" } }, { id: "n2", type: "gen", position: { x: 1, y: 1 }, data: { model: "soul_v2", ratio: "16:9" } }], edges: [{ source: "n1", target: "n2", targetHandle: "description" }] } } });
  const theirs = await db.canvas.create({ data: { userId: V, projectId: "p9", name: "Secret", nodeCount: 0, data: { nodes: [], edges: [] } } });
  const id = await start();
  const { w, deps } = world([
    [tu("list_canvases", {}), tu("read_canvas", { canvas_id: mine.id }), tu("read_canvas", { canvas_id: theirs.id })],
    [tu("finish", { summary: "read" })],
  ]);
  const row = await m.advanceMission(id, deps);
  assert.equal(row.status, "done");
  const shown = JSON.stringify(w.seen[1]);
  assert.match(shown, /Sneaker board/);
  assert.match(shown, /wet asphalt/);
  assert.match(shown, /description/);
  assert.ok(!shown.includes("Secret"), "another person's canvas is never shown");
  assert.match(shown, /No canvas with that id/);
  await db.canvas.deleteMany({ where: { userId: { in: [U, V] } } });
});
