import test from "node:test";
import assert from "node:assert/strict";
import { ChatMeter } from "../../src/lib/chat-credits";

test("a reply is priced from the tokens it used, with the margin, rounded up, at least one credit", () => {
  const m = new ChatMeter();
  m.add("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 1_000 }); // $0.02 + $0.01 = $0.03
  assert.ok(Math.abs(m.usd - 0.03) < 1e-9);
  assert.equal(m.credits(), Math.ceil((0.03 * 1.25) / 0.008)); // 5
  const tiny = new ChatMeter();
  tiny.add("claude-haiku-5-5", { input_tokens: 100, output_tokens: 10 });
  assert.equal(tiny.credits(), 1);
  assert.equal(new ChatMeter().credits(), 0); // nothing used, nothing charged
});

test("several calls add up; cache reads are cheap; an unknown fallback model is priced like the dearest Opus", () => {
  const m = new ChatMeter();
  m.add("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 1_000_000 });
  m.add("claude-opus-5-5", { input_tokens: 0, output_tokens: 100_000 });
  assert.ok(Math.abs(m.usd - (4 + 0.2 + 2)) < 1e-9);
  const u = new ChatMeter();
  u.add("some-other-model", { input_tokens: 1_000_000 });
  assert.ok(Math.abs(u.usd - 5) < 1e-9);
});
