import test from "node:test";
import assert from "node:assert/strict";
import { cacheLast, cachedSystem, trimHistory, type Msg } from "../../src/lib/prompt-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bl = (m: Msg) => m.content as unknown as any[];
const img = { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } };
const big = "x".repeat(5000);

test("the system prompt's stable block carries the breakpoint, the changing block does not", () => {
  const s = cachedSystem("stable", "studio now");
  assert.ok(s[0].cache_control && !s[1].cache_control);
  assert.equal(cachedSystem("only").length, 1);
});

test("the last block of the last message gets the breakpoint, on a copy", () => {
  const msgs: Msg[] = [{ role: "user", content: "hi" }, { role: "assistant", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }];
  const out = cacheLast(msgs);
  assert.deepEqual(bl(out[1])[1].cache_control, { type: "ephemeral" });
  assert.equal(bl(msgs[1])[1].cache_control, undefined, "the original is untouched");
  assert.equal(bl(cacheLast([{ role: "user", content: "hello" }] as Msg[])[0])[0].type, "text");
});

test("pictures and big tool results older than two turns are shortened; the last two turns are not", () => {
  const turn = (n: number): Msg[] => [
    { role: "user", content: [img, { type: "text", text: `q${n}` }] },
    { role: "assistant", content: [{ type: "tool_use", id: `t${n}`, name: "x", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: `t${n}`, content: big }, { type: "tool_result", tool_use_id: `u${n}`, content: [{ type: "text", text: "ok" }, img] }] },
    { role: "assistant", content: [{ type: "text", text: "done" }] },
  ];
  const msgs = [...turn(1), ...turn(2), ...turn(3)];
  const out = trimHistory(msgs);
  assert.equal(bl(out[0])[0].text, "[picture omitted]");
  assert.match(String(bl(out[2])[0].content), /\[shortened\]$/);
  assert.equal(String(bl(out[2])[0].content).length < 600, true);
  assert.deepEqual(bl(out[2])[1].content[1], { type: "text", text: "[picture omitted]" });
  // turn 2 and 3 are the last two: untouched (same objects)
  for (let i = 4; i < msgs.length; i++) assert.equal(out[i], msgs[i]);
  assert.equal(bl(msgs[0])[0].type, "image", "the stored chat is not changed");
  assert.equal(trimHistory(msgs.slice(0, 8)).every((m, i) => m === msgs[i]), true, "two turns or fewer: nothing changes");
});
