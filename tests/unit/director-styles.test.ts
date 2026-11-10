import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DIRECTOR_STYLES } from "../../src/lib/director-styles";
import { DIRECTORS, directorLensBlock, directorsIn, pickDirector } from "../../src/lib/director-lens";
// @ts-expect-error plain script shared with the build
import { transform } from "../../scripts/director-styles-transform.mjs";

const dir = "docs/prompt-engines/knowledge/original/director-craft/director_styles";

test("all twenty modules are carried word for word (only links to files Eclipse does not have are taken out)", () => {
  const files = readdirSync(dir).filter((f) => /^\d\d_.*\.md$/.test(f)).sort();
  assert.equal(files.length, 20);
  assert.equal(Object.keys(DIRECTOR_STYLES).length, 20);
  for (const f of files) {
    const id = f.replace(/^\d\d_/, "").replace(/\.md$/, "");
    assert.equal(DIRECTOR_STYLES[id], transform(readFileSync(`${dir}/${f}`, "utf8")), id);
    assert.ok(DIRECTORS.some((d) => d.id === id), `${id} can be named`);
    // the parts that carry the practical weight survive
    for (const part of ["## 风格参数 / Style parameters", "## 提示词模板 / Prompt templates", "## 落地示例 / Worked example", "negative_prompt_adds", "What this lens is NOT"]) assert.ok(DIRECTOR_STYLES[id].includes(part), `${id}: ${part}`);
    assert.ok(!/\]\(\.\.\//.test(DIRECTOR_STYLES[id]) && !/^配套参考/m.test(DIRECTOR_STYLES[id]), `${id}: no pointers to files that are not carried`);
    assert.doesNotMatch(DIRECTOR_STYLES[id], /higgsfield|runway|midjourney/i);
  }
});

test("each of the twenty directors is found by name, including common misspellings", () => {
  const names: Record<string, string[]> = {
    spielberg: ["Spielberg"], hitchcock: ["Hitchcockian"], kubrick: ["a Kubrick shot"], kurosawa: ["Kurosawa"], scorsese: ["Scorsese"], fellini: ["Felliniesque"], bergman: ["Bergman"],
    tarkovsky: ["Tarkovsky"], wong_kar_wai: ["Wong Kar-wai", "wong kar wai"], nolan: ["Nolan"], villeneuve: ["Villeneuve", "Denis Villeneuve", "Venuela", "villenueve"], fincher: ["Fincher"],
    refn: ["Refn"], bi_gan: ["Bi Gan"], zhang_yimou: ["Zhang Yimou"], hou_hsiao_hsien: ["Hou Hsiao-hsien"], park_chan_wook: ["Park Chan-wook"], malick: ["Malick"],
    michael_mann: ["Michael Mann"], coen_brothers: ["the Coen brothers", "Coens"],
  };
  for (const [id, list] of Object.entries(names)) for (const n of list) assert.deepEqual(directorsIn(`make this in the style of ${n}, please`), [id], n);
  assert.deepEqual(directorsIn("a plain sentence about a red cup, a mann, a park and a refund"), []);
});

test("the newest message that names a director decides; one module only; others are listed", () => {
  const msgs = [{ content: "in the style of Kubrick" }, { content: "actually make it Fincher" }, { content: "darker" }];
  assert.deepEqual(pickDirector(msgs, ""), { id: "fincher", others: [] });
  assert.deepEqual(pickDirector([{ content: "Nolan or Villeneuve?" }], ""), { id: "nolan", others: ["villeneuve"] });
  assert.equal(pickDirector([{ content: "a red cup" }], ""), null);
  assert.deepEqual(pickDirector([{ content: [{ type: "text", text: "Malick light" }] }], "")?.id, "malick");
});

test("the block gives the module whole, with the skill's rules for using it", () => {
  const b = directorLensBlock({ id: "villeneuve", others: ["nolan"] });
  assert.ok(b.startsWith("DIRECTOR LENS: Denis Villeneuve"));
  assert.ok(b.includes(DIRECTOR_STYLES.villeneuve) && b.includes("style_id: villeneuve") && b.includes("Christopher Nolan"));
  for (const rule of ["lens, then genre, then the project's tone", "keyframe", "negative_prompt_adds", "never copy a real film"]) assert.ok(b.toLowerCase().includes(rule.toLowerCase()), rule);
});
