import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSpec, kinetic } from "../../src/lib/sandbox/kinds/kinetic";

const starter = readFileSync("core/skills/builtin/scenario-kinetic-film/examples/starter/spec.js", "utf8");
test("the starter spec passes and its frame rate is fixed", () => {
  const r = checkSpec(starter);
  assert.match(r.spec, /fps: 24/); assert.ok(r.seconds > 10 && r.seconds <= 20);
});
test("specs that load code, reach the network or run too long are refused", () => {
  for (const bad of ["fetch('x')", "eval('1')", "const w = new Worker('a')", "import('https://x')", "const u = 'https://evil.example'"]) assert.throws(() => checkSpec(starter + "\n" + bad));
  assert.throws(() => checkSpec(starter.replace("from './blocks.js'", "from 'https://x/y.js'")));
  assert.throws(() => checkSpec(starter.replace(/beats: 42/, "beats: 400")), /most is 20/);
  assert.throws(() => checkSpec(starter, "1080"), /most is 10/);
  assert.throws(() => checkSpec("export default {}".padEnd(80, " ")));
});
test("the job has four stages and the render stage has no network", async () => {
  assert.equal(kinetic.stageCount?.({} as never), 4);
  const input = { spec: checkSpec(starter).spec, res: "720" as const, seconds: 15, outputKey: "u/x/kinetic/a.mp4", projectId: null };
  const st = await kinetic.stage!({} as never, 2, input);
  assert.deepEqual(st.network, { kind: "none" });
  const setup = await kinetic.stage!({} as never, 0, input);
  assert.ok(setup.files!.some((f) => f.path === "film/spec.js") && setup.files!.some((f) => f.path === "film/blocks.js") && setup.files!.some((f) => f.path === "kit/scripts/render.py"));
});
