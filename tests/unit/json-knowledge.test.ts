import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IMAGE_TO_JSON, A1_JSON_WRITER, JSON_KNOWLEDGE } from "../../src/lib/json-knowledge";
import { engineById } from "../../src/lib/prompt-engines";
import { PERSONAS, customPersona } from "../../src/lib/agent-personas";
import { buildReply } from "../../src/lib/agent-reply";

test("the knowledge documents match the docs word for word", () => {
  assert.equal(IMAGE_TO_JSON, readFileSync("docs/prompt-engines/knowledge/image-to-json.md", "utf8").trim());
  assert.equal(A1_JSON_WRITER, readFileSync("docs/prompt-engines/knowledge/a1-json-prompt-writer.md", "utf8").trim());
  assert.ok(!JSON_KNOWLEDGE.includes("﻿"));
});

test("the AI Master Engine and Atlas carry both documents; custom agents do not", () => {
  const master = engineById("master")!.system;
  assert.ok(master.startsWith("AI Image Master Engine"));
  for (const sys of [master, PERSONAS.Atlas.system]) {
    assert.ok(sys.includes(IMAGE_TO_JSON));
    assert.ok(sys.includes(A1_JSON_WRITER));
  }
  assert.ok(PERSONAS.Atlas.system.includes("Deliver the finished JSON through suggest_prompt"));
  assert.ok(!engineById("kling")!.system.includes(A1_JSON_WRITER));
  assert.ok(!customPersona({ name: "X", role: "", instructions: "y" }).system.includes(A1_JSON_WRITER));
});

test("a long JSON prompt from Atlas is kept whole, on one line, never cut", () => {
  const objects = Array.from({ length: 60 }, (_, i) => ({ id: `obj_${i}`, label: "a detailed object label", material: "brushed aluminium with fine scratches" }));
  const prompt = { meta: { image_quality: "High" }, objects };
  const r = buildReply([{ type: "tool_use", id: "t", name: "suggest_prompt", input: { prompt } } as never], "tool_use");
  const p = r.actions[0].prompt!;
  assert.deepEqual(JSON.parse(p), prompt);
  assert.ok(!p.includes("\n"));
  const small = buildReply([{ type: "tool_use", id: "t", name: "suggest_prompt", input: { prompt: { meta: { a: 1 } } } } as never], "tool_use");
  assert.ok(small.actions[0].prompt!.includes("\n"));
});
