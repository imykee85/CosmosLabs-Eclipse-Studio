import test from "node:test";
import assert from "node:assert/strict";
import { ChatMeter } from "../../src/lib/chat-credits";
import { WEB_NOTE, WEB_TOOLS, webUse } from "../../src/lib/web-tools";
import { planAllows } from "../../src/lib/access-table";

test("web tools are capped and Growth and up only", () => {
  assert.deepEqual(WEB_TOOLS.map((t) => (t as { name: string }).name), ["web_search", "web_fetch"]);
  assert.ok(WEB_TOOLS.every((t) => Number((t as { max_uses?: number }).max_uses) <= 4));
  assert.equal(planAllows("starter", "web"), false);
  assert.equal(planAllows("growth", "web"), true);
  assert.match(WEB_NOTE, /DATA/);
});
test("searches are charged on top of tokens", () => {
  assert.deepEqual(webUse({ server_tool_use: { web_search_requests: 3, web_fetch_requests: 1 } }), { searches: 3, fetches: 1 });
  assert.deepEqual(webUse(undefined), { searches: 0, fetches: 0 });
  const m = new ChatMeter();
  m.add("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } } as never);
  assert.ok(Math.abs(m.usd - 0.03) < 1e-9);
});
