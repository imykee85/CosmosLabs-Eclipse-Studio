import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkCode } from "../../src/lib/design/motion/agent";
import { cleanSettings, colorsInCode, logicalSize, pixelSize, TEMPLATES, MOTION_ASPECTS } from "../../src/lib/design/motion/spec";
import { FRAME_CSP, FRAME_HTML, HELP } from "../../src/lib/design/motion/runtime";

const sample = readFileSync(new URL("../fixtures/motion-sample.js", import.meta.url), "utf8");

test("drawing space keeps the short side at 1000 units; pixel sizes are even", () => {
  assert.deepEqual(logicalSize("16:9"), { W: 1778, H: 1000 });
  assert.deepEqual(logicalSize("9:16"), { W: 1000, H: 1778 });
  assert.deepEqual(pixelSize("16:9", 1080), { w: 1920, h: 1080 });
  assert.deepEqual(pixelSize("9:16", 2160), { w: 2160, h: 3840 });
  for (const a of MOTION_ASPECTS) { const p = pixelSize(a, 1080); assert.equal(p.w % 2, 0); assert.equal(p.h % 2, 0); }
});

test("code check: a real motion compiles; syntax errors and forbidden calls are refused", () => {
  assert.equal(checkCode(sample), null);
  assert.match(checkCode("return { render(g, t) { g.fillRect(0, 0, 10 }")!, /./);
  assert.ok(checkCode("fetch('/api/credits'); return { render() {} }"));
  assert.ok(checkCode("const x = import('x'); return {}"));
  assert.ok(checkCode(""));
});

test("settings from the browser are cleaned", () => {
  const s = cleanSettings({ aspect: "2:1", duration: 999, loop: "yes", audio: { music: true, voice: 1 }, model: "gpt", approval: "auto", refs: [{ type: "upload", id: "a" }, { type: "bad", id: "b" }] });
  assert.equal(s.aspect, "16:9"); assert.equal(s.duration, 60); assert.equal(s.loop, false);
  assert.deepEqual(s.audio, { sfx: false, music: true, voice: false });
  assert.equal(s.model, "claude-sonnet-5-5"); assert.equal(s.approval, "auto"); assert.equal(s.refs.length, 1);
  assert.equal(cleanSettings({ duration: "auto" }).duration, "auto");
  assert.equal(cleanSettings({ duration: 0.5 }).duration, 2);
});

test("a motion's colours make a brand kit palette, most used first", () => {
  assert.deepEqual(colorsInCode(sample).slice(0, 2), ["#e8d9c4", "#0f4c5c"]);
  assert.deepEqual(colorsInCode("'#FFF' '#fff' '#000'"), ["#ffffff", "#000000"]);
});

test("the runtime frame is locked down and documents every helper the motion is told about", () => {
  assert.match(FRAME_CSP, /sandbox allow-scripts/); assert.match(FRAME_CSP, /connect-src 'none'/); assert.doesNotMatch(FRAME_CSP, /allow-same-origin/);
  for (const name of ["prog", "letters", "text", "measure", "wrap", "roundRect", "image", "gradient", "radial", "rand", "noise", "rgba", "mix"]) {
    assert.match(HELP, new RegExp(`M\\.${name}\\b`), `HELP names M.${name}`);
    assert.match(FRAME_HTML, new RegExp(`${name}: ${name}`), `runtime exposes ${name}`);
  }
  assert.ok(TEMPLATES.length >= 6);
});
