import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { attachPictures, parsePictures } from "../../src/lib/agent-pictures";

test("parsePictures keeps valid ids, drops duplicates and junk, caps at 4", () => {
  const out = parsePictures([
    { type: "upload", id: "a", role: "start frame" }, { type: "upload", id: "a" }, { type: "render", id: "b" }, { type: "url", id: "c" },
    { type: "render", id: "" }, { type: "render", id: "d" }, { type: "render", id: "e" }, { type: "render", id: "f" },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["a", "b", "d", "e"]);
  assert.equal(out[0].role, "start frame");
  assert.deepEqual(parsePictures("nope"), []);
});

test("attachPictures puts the pictures before the user's message, each named by its role", async () => {
  const last: Anthropic.MessageParam = { role: "user", content: "what do you think?" };
  const seeing = await attachPictures("u1", parsePictures([{ type: "upload", id: "a", role: "start frame" }, { type: "render", id: "b" }]), last, async (uid, refs) => {
    assert.equal(uid, "u1");
    assert.deepEqual(refs, [{ type: "upload", id: "a" }, { type: "render", id: "b" }]);
    return { ok: true, images: [{ mediaType: "image/png", data: "AAA", label: "jacket" }, { mediaType: "image/jpeg", data: "BBB", label: "a red square" }] };
  });
  const c = last.content as Anthropic.ContentBlockParam[];
  assert.equal(c.length, 5);
  assert.deepEqual(c[0], { type: "text", text: "Picture 1 (start frame): jacket" });
  assert.equal(c[1].type, "image");
  assert.deepEqual(c[2], { type: "text", text: "Picture 2: a red square" });
  assert.deepEqual(c[4], { type: "text", text: "what do you think?" });
  assert.match(seeing, /2 pictures/);
});

test("attachPictures leaves the message alone and says so when the pictures cannot be loaded", async () => {
  const last: Anthropic.MessageParam = { role: "user", content: "hi" };
  const seeing = await attachPictures("u1", parsePictures([{ type: "upload", id: "a" }]), last, async () => ({ ok: false, error: "gone" }));
  assert.equal(last.content, "hi");
  assert.match(seeing, /could not be loaded/);
  const none: Anthropic.MessageParam = { role: "user", content: "hi" };
  assert.equal(await attachPictures("u1", [], none, async () => { throw new Error("not called"); }), "");
});
