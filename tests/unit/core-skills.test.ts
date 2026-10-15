import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BUILTIN_ROOT, builtinIndex, loadBuiltinSkill, parseFrontmatter, readInside, readSkillFile, skillFiles } from "../../src/lib/core-skills/builtin";
import { FakeLocalProvider } from "../../src/lib/sandbox/fake-local";
import { crc32, makeZip } from "../../src/lib/sandbox/zip";

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

test("fake sandbox: a command that runs too long is killed", async () => {
  const p = new FakeLocalProvider(), id = await p.start("u1");
  const t = Date.now();
  const r = await p.exec(id, "sleep 30; echo late", { timeoutMs: 400 });
  assert.equal(r.timedOut, true);
  assert.equal(r.exitCode, null);
  assert.ok(Date.now() - t < 5000);
  await p.destroy(id);
});

test("fake sandbox: a command cannot read Eclipse's environment", async () => {
  process.env.DATABASE_URL = "postgresql://secret"; process.env.CLERK_SECRET_KEY = "sk_secret"; process.env.R2_SECRET_ACCESS_KEY = "r2secret";
  const p = new FakeLocalProvider(), id = await p.start("u1");
  const r = await p.exec(id, "env; echo $DATABASE_URL $CLERK_SECRET_KEY", { timeoutMs: 5000 });
  assert.doesNotMatch(r.stdout, /secret|postgresql|CLERK|R2_/);
  await p.destroy(id);
});

test("fake sandbox: files stay in /work, listing and writing work, two boxes are separate, destroy removes them", async () => {
  const p = new FakeLocalProvider(), a = await p.start("u1"), b = await p.start("u2");
  await p.writeFile(a, "/work/project/index.html", "<h1>a</h1>");
  assert.equal(new TextDecoder().decode(await p.readFile(a, "/work/project/index.html")), "<h1>a</h1>");
  assert.deepEqual((await p.listFiles(a, "/work/project")).map((f) => f.path), ["/work/project/index.html"]);
  await assert.rejects(() => p.readFile(b, "/work/project/index.html"));
  for (const bad of ["/etc/passwd", "/work/../etc/passwd", "/workshop/x", "work/../../x"]) await assert.rejects(() => p.readFile(a, bad), String(bad));
  await assert.rejects(() => p.writeFile(a, "/tmp/x", "x"));
  await assert.rejects(() => p.exec(a, "pwd", { timeoutMs: 1000, cwd: "/etc" }));
  await p.destroy(a);
  assert.equal(p.has(a), false);
  await assert.rejects(() => p.readFile(a, "/work/project/index.html"));
  await p.destroy(b);
});

test("the zip writer produces a valid archive", async () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = makeZip([{ name: "index.html", data: new TextEncoder().encode("<h1>hi</h1>") }, { name: "css/a.css", data: new TextEncoder().encode("a{}") }]);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zip-"));
  await fs.writeFile(path.join(dir, "t.zip"), zip);
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("python3", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(sorted(z.namelist()));print(z.read('index.html').decode())", path.join(dir, "t.zip")], { encoding: "utf8" });
  assert.match(r.stdout, /^None\n\['css\/a.css', 'index.html'\]\n<h1>hi<\/h1>/);
});
