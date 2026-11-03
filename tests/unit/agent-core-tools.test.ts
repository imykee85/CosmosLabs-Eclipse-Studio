import test from "node:test";
import assert from "node:assert/strict";
import { CORE_TOOLS, CORE_TOOL_NAMES, isCoreTool } from "../../src/lib/agent-core-tools";

test("Atlas shares only the read and memory tools of Core, never a tool that renders or sends", () => {
  assert.deepEqual(CORE_TOOLS.map((t) => t.name).sort(), [...CORE_TOOL_NAMES].sort());
  for (const bad of ["generate_image", "send_to_app", "sandbox_exec", "save_tool", "use_skill"]) assert.equal(isCoreTool(bad), false);
  for (const t of CORE_TOOLS) assert.ok(t.description && t.input_schema);
});
