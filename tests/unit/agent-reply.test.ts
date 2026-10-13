import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { buildReply } from "../../src/lib/agent-reply";

const text = (t: string): Anthropic.ContentBlock => ({ type: "text", text: t, citations: null } as Anthropic.ContentBlock);
const tool = (name: string, input: unknown): Anthropic.ContentBlock => ({ type: "tool_use", id: "t1", name, input } as Anthropic.ContentBlock);

test("a prompt tool call becomes its buttons", () => {
  const r = buildReply([text("Here it is."), tool("suggest_prompt", { prompt: "A red square" }), tool("propose_generation", { prompt: "A red square", count: 2 })], "tool_use");
  assert.deepEqual(r.actions.map((a) => a.kind), ["use_prompt", "generate"]);
  assert.equal(r.actions[1].label, "Generate 2");
});

test("a structured (JSON) prompt that arrives as an object is kept as text", () => {
  const r = buildReply([text("Done."), tool("suggest_prompt", { prompt: { subject: "woman", lighting: "soft" } })], "tool_use");
  assert.equal(r.actions.length, 1);
  assert.match(r.actions[0].prompt!, /"lighting": "soft"/);
});

test("a long prompt is kept up to the box limit, not cut at 2000", () => {
  const r = buildReply([tool("suggest_prompt", { prompt: "x".repeat(4500) })], "tool_use");
  assert.equal(r.actions[0].prompt!.length, 4500);
});

test("an answer cut off before its buttons says so instead of promising them", () => {
  const r = buildReply([text("The prompt is ready, see the buttons below.")], "max_tokens");
  assert.equal(r.actions.length, 0);
  assert.match(r.text, /cut off before I could attach the buttons/);
});

test("an empty answer gets a plain fallback", () => {
  assert.match(buildReply([], "end_turn").text, /Tell me a bit more/);
});
