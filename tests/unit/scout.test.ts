import test from "node:test";
import assert from "node:assert/strict";
import { scout, scoutInputFor, ScoutRequest } from "../../src/lib/sandbox/kinds/scout";
import { SCOUT_TOOLS, isScoutTool } from "../../src/lib/agent-scout";
import { kindDef } from "../../src/lib/sandbox/kinds";

test("search request is bounded", () => {
  assert.ok(ScoutRequest.safeParse({ mode: "search", queries: ["Ponte 25 de Abril"] }).success);
  assert.ok(!ScoutRequest.safeParse({ mode: "search", queries: [] }).success);
  assert.ok(!ScoutRequest.safeParse({ mode: "search", queries: Array(7).fill("a place") }).success);
  assert.ok(!ScoutRequest.safeParse({ mode: "search", queries: ["x y"], extra: 1 }).success);
});
test("pack titles must be exact Commons file titles", () => {
  assert.ok(ScoutRequest.safeParse({ mode: "pack", name: "Lisbon", titles: ["File:Lisbon tram 28.jpg"] }).success);
  for (const bad of ["Lisbon.jpg", "File:a|b.jpg", "File:../../etc/passwd\n", "https://x.test/a.jpg", "File:<x>.jpg"]) assert.ok(!ScoutRequest.safeParse({ mode: "pack", name: "x1", titles: [bad] }).success, bad);
  assert.ok(!ScoutRequest.safeParse({ mode: "pack", name: "Lisbon", titles: Array(13).fill("File:A b.jpg") }).success);
});
test("pack keys sit under the person's own folder; search needs none", () => {
  const p = scoutInputFor("u1", "j1", { mode: "pack", name: "Lisbon", titles: ["File:Lisbon tram 28.jpg"] });
  assert.equal(p.packKey, "u/u1/scout/j1.zip");
  assert.equal(scoutInputFor("u1", "j1", { mode: "search", queries: ["Lisbon"] }).packKey, undefined);
  assert.throws(() => scoutInputFor("u1", "j1", { mode: "pack", name: "x", titles: ["nope"] }));
});
test("the job reaches only Commons for search and is registered, free by default", () => {
  assert.equal(kindDef("media.scout")?.kind, "media.scout");
  const s = scoutInputFor("u1", "j1", { mode: "search", queries: ["a b"] });
  const n = scout.network(s);
  assert.deepEqual(n.kind === "allowlist" ? n.domains : [], ["commons.wikimedia.org", "upload.wikimedia.org"]);
  assert.equal(scout.price(s), 0);
  assert.equal(scout.stageCount!(s), 1);
});
test("search queries are passed as separate quoted arguments", async () => {
  const s = scoutInputFor("u1", "j1", { mode: "search", queries: ["a; rm -rf /", "$(x)"], limit: 5 });
  const st = await scout.stage!({} as never, 0, s);
  assert.deepEqual(st.args, ["search.sh", "5", "a; rm -rf /", "$(x)"]);
  assert.ok(st.files?.some((f) => f.path === "loc/location_refs.py"));
});
test("Atlas tools", () => {
  assert.deepEqual(SCOUT_TOOLS.map((t) => t.name), ["scout_photos", "scout_pack", "check_scout"]);
  assert.ok(isScoutTool("scout_pack") && !isScoutTool("web_search"));
});
