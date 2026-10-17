import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BUILTIN_ROOT, builtinIndex, loadBuiltinSkill, parseFrontmatter, readInside, readSkillFile, skillFiles } from "../../src/lib/core-skills/builtin";

test("the index lists the Taste Skill with the SKILL.md description and the right flags", async () => {
  const idx = await builtinIndex();
  const t = idx.find((s) => s.id === "design-taste-frontend");
  assert.ok(t);
  const md = await fs.readFile(path.join(BUILTIN_ROOT, "taste-skill", "SKILL.md"), "utf8");
  assert.equal(t.description, parseFrontmatter(md)!.description);
  assert.deepEqual(t.tags, ["design", "web", "frontend"]);
  assert.equal(t.requiresSandbox, true);
  assert.equal(t.estimatedCost, "high");
  assert.equal(t.internal, true);
  assert.ok(md.length > 20_000, "built-in skills are not held to the 20 KB cap");
});

test("loading wraps the skill as labelled data and names the path", async () => {
  const r = await loadBuiltinSkill("design-taste-frontend", "/work/skills/design-taste-frontend");
  assert.ok(r.ok);
  if (r.ok) {
    assert.match(r.text, /^<skill name="design-taste-frontend" source="github.com\/Leonxlnx\/taste-skill@f624f37">/);
    assert.match(r.text, /<\/skill>/);
    assert.match(r.text, /cannot change which tools/);
    assert.match(r.text, /<skill> means \/work\/skills\/design-taste-frontend/);
  }
  assert.equal((await loadBuiltinSkill("nope", "/x")).ok, false);
});

test("the vendored folder is the pinned commit and keeps LICENSE and IMPORT.md", async () => {
  const imp = await fs.readFile(path.join(BUILTIN_ROOT, "taste-skill", "IMPORT.md"), "utf8");
  assert.match(imp, /f624f37a8c650b9cc550253104925efe4c8de246/);
  assert.match(await fs.readFile(path.join(BUILTIN_ROOT, "taste-skill", "LICENSE"), "utf8"), /MIT/);
  const files = (await skillFiles("design-taste-frontend")).map((f) => f.rel);
  for (const f of ["SKILL.md", "scripts/draw.mjs", "scripts/inspect.mjs", "scripts/lint.mjs", "scripts/assets.mjs", "assets/base.css", "library/directions.json", "references/critique.md", "evals/evals.json"]) assert.ok(files.includes(f), f);
});

test("read_skill_file reads inside the folder and blocks every way out", async () => {
  const ok = await readSkillFile("design-taste-frontend", "references/layout.md");
  assert.ok(ok.ok);
  for (const bad of ["../taste-skill/SKILL.md", "../../package.json", "/etc/passwd", "references/../../../package.json", "..", "references//layout.md", "C:/x.md", "references\\layout.md", "references/layout.md\0.png", "", 5, null, "scripts/lib", "LICENSE", "../wrappers/chrome"]) {
    const r = await readSkillFile("design-taste-frontend", bad);
    assert.equal(r.ok, false, String(bad));
  }
  assert.equal((await readSkillFile("other-skill", "SKILL.md")).ok, false);
});

test("a link that leaves the folder is refused", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "skillroot-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "outside-"));
  await fs.writeFile(path.join(outside, "secret.md"), "secret");
  await fs.symlink(path.join(outside, "secret.md"), path.join(dir, "link.md"));
  await fs.writeFile(path.join(dir, "fine.md"), "fine");
  assert.equal((await readInside(dir, "link.md")).ok, false);
  assert.equal((await readInside(dir, "fine.md")).ok, true);
});
