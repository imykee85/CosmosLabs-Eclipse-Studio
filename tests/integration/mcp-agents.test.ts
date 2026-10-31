// Atlas and Core through the MCP endpoint, plus the MCP prompts (slash commands), against a fake Anthropic server and a throwaway Postgres.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const G = "user_mcpag_growth", S = "user_mcpag_starter";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any; let keyG = "", keyS = ""; let server: http.Server;
const seen: { stream: boolean; system: unknown; messages: { role: string; content: unknown }[] }[] = [];
const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "1";
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      seen.push({ stream: !!j.stream, system: j.system, messages: j.messages });
      const usage = { input_tokens: 1000, output_tokens: 200 };
      if (!j.stream) {
        // Atlas: one text block and a suggest_prompt tool call
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "msg_a", type: "message", role: "assistant", model: j.model, stop_reason: "tool_use", usage,
          content: [{ type: "text", text: "Soft side light, one prop." }, { type: "tool_use", id: "toolu_1", name: "suggest_prompt", input: { prompt: "A perfume bottle in soft side light" } }] }));
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        ["message_start", { type: "message_start", message: { id: "msg_c", type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, usage } }],
        ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
        ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Done, boss." } }],
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 200 } }],
        ["message_stop", { type: "message_stop" }],
      ]));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  lib = { keys: await import("../../src/lib/api-keys"), db: (await import("../../src/lib/db")).db, mcp: await import("../../src/app/api/mcp/route"), credits: await import("../../src/lib/credits") };
  await clean();
  await lib.db.billingSettings.upsert({ where: { userId: G }, create: { userId: G, planOverride: "growth" }, update: { planOverride: "growth" } });
  await lib.db.billingSettings.upsert({ where: { userId: S }, create: { userId: S, planOverride: "starter" }, update: { planOverride: "starter" } });
  keyG = (await lib.keys.createKey(G, "T")).key; keyS = (await lib.keys.createKey(S, "T")).key;
  await lib.credits.grantCredits(G, 100000, { reason: "GRANT", provider: "test", externalId: `mcpag-${G}` });
});
after(async () => { server?.close(); if (skip) return; await clean(); await lib.db.$disconnect(); });
const clean = async () => {
  for (const u of [G, S]) { await lib.db.connectChat.deleteMany({ where: { userId: u } }); await lib.db.creditLedger.deleteMany({ where: { userId: u } }); await lib.db.chatSpend?.deleteMany({ where: { userId: u } }).catch(() => {}); await lib.db.billingSettings.deleteMany({ where: { userId: u } }); await lib.db.apiKey.deleteMany({ where: { userId: u } }); await lib.db.usageEvent.deleteMany({ where: { userId: u } }).catch(() => {}); }
};
let n = 0;
const rpc = async (k: string, method: string, params?: unknown) => (await lib.mcp.POST(new Request("http://x/api/mcp", { method: "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) }))).json();
const call = (k: string, name: string, args: unknown) => rpc(k, "tools/call", { name, arguments: args });

test("ask_atlas answers with a reply and its suggested prompt, sees the MCP context and the earlier turns, and is charged", { skip }, async () => {
  const before = (await lib.credits.getBalance(G)) as number;
  const r = await call(keyG, "ask_atlas", { message: "Plan a perfume shot", history: [{ role: "user", text: "Hi" }, { role: "assistant", text: "Hello" }] });
  assert.equal(r.result.isError, undefined, JSON.stringify(r));
  const d = r.result.structuredContent;
  assert.equal(d.reply, "Soft side light, one prop.");
  assert.deepEqual(d.suggestions.map((x: { kind: string; prompt?: string }) => [x.kind, x.prompt]), [["prompt", "A perfume bottle in soft side light"]]);
  const q = seen[seen.length - 1];
  assert.equal(q.messages.length, 3, "history plus the new message");
  assert.match(JSON.stringify(q.system), /MCP connection/);
  assert.ok(((await lib.credits.getBalance(G)) as number) < before, "the reply is charged in credits");
});

test("ask_core answers, returns a chat id, and continues the same chat", { skip }, async () => {
  const a = await call(keyG, "ask_core", { message: "Hello Core", model: "lite" });
  assert.equal(a.result.isError, undefined, JSON.stringify(a));
  assert.equal(a.result.structuredContent.reply, "Done, boss.");
  const chat = a.result.structuredContent.chat_id as string;
  assert.ok(chat);
  assert.equal(seen[seen.length - 1].stream, true);
  const b = await call(keyG, "ask_core", { message: "Again", chat_id: chat });
  assert.equal(b.result.structuredContent.chat_id, chat);
  const rows = await lib.db.connectMessage.count({ where: { chatId: chat } });
  assert.ok(rows >= 4, "two user messages and two answers are in one chat");
});

test("Core is locked below the Growth plan, with the upgrade answer; Atlas is open to Starter (with a daily allowance)", { skip }, async () => {
  const r = await call(keyS, "ask_core", { message: "hi" });
  assert.equal(r.result.isError, true, "ask_core");
  assert.match(r.result.content[0].text, /UPGRADE/, "ask_core");
  const a = await call(keyS, "ask_atlas", { message: "hi" });
  assert.doesNotMatch(JSON.stringify(a.result), /UPGRADE/, "Starter can use Atlas");
});

test("empty messages are refused before anything runs", { skip }, async () => {
  const count = seen.length;
  for (const tool of ["ask_atlas", "ask_core"]) assert.equal((await call(keyG, tool, { message: "  " })).result.isError, true);
  assert.equal(seen.length, count, "the model was not called");
});

test("prompts: the slash commands are listed and each one hands Claude an exact instruction", { skip }, async () => {
  const init = await rpc(keyG, "initialize", { protocolVersion: "2025-06-18" });
  assert.ok(init.result.capabilities.prompts);
  const list = await rpc(keyG, "prompts/list");
  assert.deepEqual(list.result.prompts.map((p: { name: string }) => p.name), ["image", "video", "atlas", "storyboard", "core", "balance"]);
  const img = await rpc(keyG, "prompts/get", { name: "image", arguments: { idea: "a red chair", aspect_ratio: "4:5" } });
  const t = img.result.messages[0].content.text as string;
  assert.match(t, /a red chair/); assert.match(t, /generate_image/); assert.match(t, /4:5/);
  assert.match((await rpc(keyG, "prompts/get", { name: "atlas", arguments: { request: "plan a shoot" } })).result.messages[0].content.text, /ask_atlas/);
  assert.match((await rpc(keyG, "prompts/get", { name: "image", arguments: {} })).result.messages[0].content.text, /needs "idea"/);
  assert.equal((await rpc(keyG, "prompts/get", { name: "nope" })).error.code, -32602);
});
