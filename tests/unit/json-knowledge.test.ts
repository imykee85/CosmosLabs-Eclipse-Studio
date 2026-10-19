import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IMAGE_TO_JSON, A1_JSON_WRITER, jsonKnowledge } from "../../src/lib/json-knowledge";
import { engineById } from "../../src/lib/prompt-engines";
import { PERSONAS, customPersona } from "../../src/lib/agent-personas";
import { buildReply } from "../../src/lib/agent-reply";

test("the knowledge documents match their Eclipse docs; the GPT-only parts are gone", () => {
  assert.equal(IMAGE_TO_JSON, readFileSync("docs/prompt-engines/knowledge/image-to-json.md", "utf8").trim());
  assert.equal(A1_JSON_WRITER, readFileSync("docs/prompt-engines/knowledge/a1-json-prompt-writer.md", "utf8").trim());
  for (const host of ["master", "atlas"] as const) {
    const k = jsonKnowledge(host);
    assert.ok(!k.includes("\ufeff"));
    // Reworded for Eclipse: nothing that only existed in the ChatGPT custom GPTs.
    assert.ok(!/a1_prompt_pack|DALL|flux|You have access to/i.test(k));
  }
  assert.ok(readFileSync("docs/prompt-engines/knowledge/original/a1-json-prompt-writer.md", "utf8").includes("a1_prompt_pack.txt"));
});

test("the AI Master Engine and Atlas carry both documents; custom agents do not", () => {
  const master = engineById("master")!.system;
  assert.ok(master.startsWith("AI Image Master Engine"));
  for (const sys of [master, PERSONAS.Atlas.system]) {
    assert.ok(sys.includes(IMAGE_TO_JSON));
    assert.ok(sys.includes(A1_JSON_WRITER));
  }
  assert.ok(PERSONAS.Atlas.system.includes("YOUR DELIVERY RULES (Atlas)"));
  assert.ok(master.includes("YOUR DELIVERY RULES (Prompts page)") && !master.includes("YOUR DELIVERY RULES (Atlas)"));
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
