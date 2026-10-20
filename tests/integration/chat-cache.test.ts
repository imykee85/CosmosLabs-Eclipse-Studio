// Core's tool loop with prompt caching, against a fake streaming Anthropic server and a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any, agent: any, credits: any;
const requests: { model: string; system: unknown; tools: unknown[]; messages: { role: string; content: unknown }[] }[] = [];
let server: http.Server;
const U = "user_chatcache_1";

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      requests.push(j);
      const n = requests.length;
      // the first call writes the cache, later calls read it (the fake only "hits" when the request really carries the breakpoints)
      const marked = JSON.stringify(j.system).includes("cache_control") && JSON.stringify(j.messages[j.messages.length - 1]).includes("cache_control");
      const usage = n === 1 || !marked ? { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 6000, cache_read_input_tokens: 0 } : { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 6000 };
      const tool = n % 2 === 1;
      const block = tool ? { type: "tool_use", id: `toolu_${n}`, name: "list_projects", input: {} } : { type: "text", text: "" };
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        ["message_start", { type: "message_start", message: { id: `msg_${n}`, type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, usage } }],
        ["content_block_start", { type: "content_block_start", index: 0, content_block: block }],
        ...(tool ? [["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } }] as [string, unknown]] : [["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "All done." } }] as [string, unknown]]),
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        ["message_delta", { type: "message_delta", delta: { stop_reason: tool ? "tool_use" : "end_turn" }, usage: { output_tokens: 50 } }],
        ["message_stop", { type: "message_stop" }],
      ]));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  db = (await import("../../src/lib/db")).db;
  agent = await import("../../src/lib/connect-agent");
  credits = await import("../../src/lib/credits");
  await db.connectChat.deleteMany({ where: { userId: U } });
  await db.creditLedger.deleteMany({ where: { userId: U } });
  await credits.grantCredits(U, 100000, { reason: "GRANT", provider: "test", externalId: `cc-${U}` });
});
after(async () => { server?.close(); });

test("Core: Auto runs on Sonnet, the first step writes the cache, later steps read it, and the charge uses cache prices", { skip }, async () => {
  const { connectModels, apiModelFor } = await import("../../src/lib/connect-models");
  assert.equal(apiModelFor("auto"), "claude-sonnet-5-5");
  assert.equal(connectModels.find((m) => m.id === "claude-opus-5-5")!.api, "claude-opus-5-5", "Max stays Opus");
  const before = (await credits.getBalance(U)) as number;
  const events: { t: string }[] = [];
  await agent.runTurn({ userId: U, chatId: null, projectId: null, text: "What projects do I have?", imageIds: [], model: apiModelFor("auto"), emit: (e: { t: string }) => events.push(e) });
  assert.equal(requests.length, 2, "one tool step and one answer");
  for (const r of requests) {
    assert.equal(r.model, "claude-sonnet-5-5");
    assert.ok(Array.isArray(r.system) && (r.system as { cache_control?: unknown }[])[0].cache_control, "system carries a breakpoint");
    const last = r.messages[r.messages.length - 1].content as { cache_control?: unknown }[];
    assert.ok(last[last.length - 1].cache_control, "the last block of the history carries a breakpoint");
    const marks = JSON.stringify(r).split("cache_control").length - 1;
    assert.ok(marks <= 4, "at most 4 breakpoints");
  }
  assert.equal(requests[0].messages.length, 1);
  assert.equal(requests[1].messages.length, 3);
  // the breakpoint moved forward: the first user message no longer carries one on step 2
  assert.equal(JSON.stringify(requests[1].messages[0]).includes("cache_control"), false);
  // step 1: 100 in + 50 out + 6000 written; step 2: 100 in + 50 out + 200 written + 6000 read (Sonnet: $2 / $10 / $0.10 read / $2.50 write per million)
  const usd = (100 * 2 + 50 * 10 + 6000 * 2.5) / 1e6 + (100 * 2 + 50 * 10 + 200 * 2.5 + 6000 * 0.1) / 1e6;
  const expected = Math.ceil((usd * 2.5) / 0.01); // tenths of a credit
  const spent = before - ((await credits.getBalance(U)) as number);
  assert.equal(spent, expected, "charged from real usage at the cache prices");
  assert.ok(events.some((e) => e.t === "text"));
});
