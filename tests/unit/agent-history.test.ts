import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessages, historyPictures, parseTurns } from "../../src/lib/agent-history";

const img = (label: string) => ({ mediaType: "image/png" as const, data: "AAA", label });

test("parseTurns keeps pictures and videos each message was shown with", () => {
  const turns = parseTurns([
    { role: "user", text: "Make it moody", seen: { pictures: [{ type: "render", id: "r1", role: "shown in the preview" }], videos: [{ id: "v1", label: "clip", role: "" }] } },
    { role: "agent", text: "On it" },
    { role: "user", text: "Compare", seen: { pictures: [{ type: "upload", id: "u1", role: "ingredient 1" }, { type: "bogus", id: "x", role: "" }] } },
  ]);
  assert.equal(turns.length, 3);
  assert.equal(turns[0].pictures[0].id, "r1");
  assert.equal(turns[0].videos[0].id, "v1");
  assert.equal(turns[2].pictures.length, 1); // the bogus type is dropped
});

test("historyPictures takes the newest earlier pictures, skips the last message and repeats", () => {
  const turns = parseTurns([
    { role: "user", text: "a", seen: { pictures: [{ type: "upload", id: "old", role: "ingredient 1" }] } },
    { role: "user", text: "b", seen: { pictures: [{ type: "render", id: "r1", role: "preview" }, { type: "upload", id: "old", role: "ingredient 1" }] } },
    { role: "user", text: "c", seen: { pictures: [{ type: "render", id: "now", role: "preview" }] } },
  ]);
  const ids = historyPictures(turns).map((p) => p.id);
  assert.deepEqual(ids, ["r1", "old"]); // "now" is the last message and comes with the box instead
});

test("buildMessages sends earlier pictures before their text, joins same-speaker turns and keeps alternation", () => {
  const turns = parseTurns([
    { role: "user", text: "first", seen: { pictures: [{ type: "upload", id: "u1", role: "ingredient 1" }] } },
    { role: "agent", text: "looks fine" },
    { role: "user", text: "preview is off", seen: { videos: [{ id: "v9", label: "reel", role: "" }] } },
    { role: "user", text: "fix the hands" },
    { role: "agent", text: "ok" },
  ]);
  const loaded = new Map([["upload:u1", img("product")]]);
  const msgs = buildMessages(turns, loaded);
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant", "user", "assistant"]);
  const first = msgs[0].content as { type: string; text?: string }[];
  assert.equal(first[0].type, "text");
  assert.match(first[0].text!, /Earlier you were shown picture \(ingredient 1\): product/);
  assert.equal(first[1].type, "image");
  const second = msgs[2].content as { type: string; text?: string }[];
  assert.match(second.map((b) => b.text ?? "").join("\n"), /clip_id v9 \(reel\)/);
  assert.match(second.map((b) => b.text ?? "").join("\n"), /fix the hands/);
});

test("pictures that could not be loaded are left out, the text stays", () => {
  const turns = parseTurns([{ role: "user", text: "a", seen: { pictures: [{ type: "upload", id: "gone", role: "" }] } }, { role: "agent", text: "b" }, { role: "user", text: "c" }]);
  const msgs = buildMessages(turns, new Map());
  assert.equal((msgs[0].content as { type: string }[]).some((b) => b.type === "image"), false);
});
