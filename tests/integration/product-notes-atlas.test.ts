// The two Atlas notes added with the product skills (Product Video Craft, Add Motion Craft) reach Atlas's real instructions only on topic, through
// prepareAgentTurn (the code /api/agent/chat and the MCP ask_atlas share). Fake Anthropic server that records each request; throwaway Postgres.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const U = "user_product_notes";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any; let server: http.Server;
const systems: string[] = [];

before(async () => {
  if (skip) return;
  process.env.CREDITS_ENABLED = "0";
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = JSON.parse(body);
      systems.push(JSON.stringify(j.system));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: j.model, stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: "Here is the plan." }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  lib = { turn: await import("../../src/lib/agent-turn"), know: await import("../../src/lib/product-knowledge"), db: (await import("../../src/lib/db")).db };
  await clean();
  await lib.db.billingSettings.upsert({ where: { userId: U }, create: { userId: U, planOverride: "growth" }, update: { planOverride: "growth" } });
});
const clean = async () => { await lib.db.billingSettings.deleteMany({ where: { userId: U } }); await lib.db.usageEvent.deleteMany({ where: { userId: U } }); await lib.db.chatSpend?.deleteMany({ where: { userId: U } }).catch(() => {}); };
after(async () => { server?.close(); if (skip) return; await clean(); await lib.db.$disconnect(); });

async function ask(text: string, context: Record<string, unknown> = {}) {
  const p = await lib.turn.prepareAgentTurn(U, U, { agent: "Atlas", messages: [{ role: "user", text }], context });
  assert.ok(p.ok, JSON.stringify(p.out));
  const out = await p.work();
  assert.equal(out.status ?? 200, 200, JSON.stringify(out));
  return systems[systems.length - 1];
}
const has = (s: string, note: string) => s.includes(JSON.stringify(note.slice(0, 200)).slice(1, -1));

test("Product Video Craft loads for a creator-style product video and not for an unrelated message", { skip }, async () => {
  const s = await ask("Write a UGC product video of her unboxing the serum and talking to camera", { page: "video" });
  assert.ok(has(s, lib.know.PRODUCT_VIDEO_CRAFT), "Product Video Craft is in Atlas's instructions");
  const plain = await ask("What is a good name for my bakery?");
  assert.ok(!has(plain, lib.know.PRODUCT_VIDEO_CRAFT) && !has(plain, lib.know.ADD_MOTION_CRAFT), "neither note on an unrelated message");
});

test("Add Motion Craft loads when someone wants to animate a still in Video Studio", { skip }, async () => {
  const s = await ask("Animate this packshot, make the bottle slowly rotate", { page: "video", model: "Kling 3.0 Pro" });
  assert.ok(has(s, lib.know.ADD_MOTION_CRAFT), "Add Motion Craft is in Atlas's instructions");
  assert.ok(!s.includes("video generation is not connected yet"), "Atlas is never told video is unavailable");
  assert.match(s, /video generation works here/);
});

test("a named director brings that one full module (and Director Craft) into Atlas's instructions, and no other director", { skip }, async () => {
  const s = await ask("Plan a 10 second shot of a man walking down a corridor, in the style of Villeneuve", { page: "video", model: "Kling 3.0 Pro" });
  assert.match(s, /DIRECTOR LENS: Denis Villeneuve/);
  assert.match(s, /style_id: villeneuve/);
  assert.match(s, /DIRECTOR CRAFT/);
  assert.doesNotMatch(s, /style_id: nolan|style_id: kubrick/);
  const none = await ask("Write a prompt for a red cup on marble", { page: "create" });
  assert.doesNotMatch(none, /DIRECTOR LENS:/);
});
