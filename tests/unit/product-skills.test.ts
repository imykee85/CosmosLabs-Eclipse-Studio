import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { skills } from "../../src/lib/skills";
import { getModelById } from "../../src/lib/models";
import { ADD_MOTION_CRAFT, PRODUCT_VIDEO_CRAFT, wantsAddMotion, wantsProductVideo } from "../../src/lib/product-knowledge";

// The owner's six product skills (2026-11-09): four image workflows run in Core, two video workflows are Atlas knowledge notes.
const NEW = ["model", "packshot", "scene-product", "model-product"];
const OUTSIDE = /\b(fal|fal-ai|fal\.ai|python3?|nano-banana|higgsfield|seedance-2\.5\/|openai\/|\.claude\/skills|brands\/\[)\b|\.env\b|brands\/|\/model\b|\/packshot\b|\/product-shoot\b|\/add-motion\b|\/product-video\b/i;

test("Core has the four image skills, each with a preview picture and a playbook", () => {
  const ids = skills.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  for (const id of NEW) {
    const s = skills.find((x) => x.id === id);
    assert.ok(s, id);
    assert.equal(s!.kind, "photo");
    assert.ok(existsSync(`public${s!.image}`), `${id} preview exists`);
    assert.ok(s!.playbook.length > 1500, `${id} playbook is complete`);
    assert.ok(!OUTSIDE.test(s!.playbook), `${id} names no outside tool or folder`);
    assert.ok(s!.playbook.includes("generate_image"), `${id} uses Core's own tool`);
  }
});

test("the playbooks carry the owner's prompts and the models and ratios they name exist", () => {
  const pb = (id: string) => skills.find((s) => s.id === id)!.playbook;
  assert.ok(pb("model").includes("High-fidelity agency casting portrait") && pb("model").includes("Maintain 1:1 facial identity"));
  assert.ok(pb("model").includes("check_render") && pb("model").includes('"type":"render"') && pb("model").includes("remember"));
  assert.ok(pb("packshot").includes("Strict Negative Constraints") && pb("packshot").includes("Product Typography and Alignment Syntax") && pb("packshot").includes("--- Physical Characteristics ---"));
  assert.ok(pb("scene-product").includes("Adopt the lighting and tonal atmosphere of image 3") && pb("scene-product").includes("composition, product, lighting"));
  assert.ok(pb("model-product").includes("substituting the model with the one shown in image 3, wearing the clothes shown in image 4") && pb("model-product").includes("reference, product, model headshot, styled model picture"));
  // models and sizes the playbooks name are real, and every ratio they offer is one the model makes
  const nano = getModelById("nano_banana_2")!, sun = getModelById("gpt_image_2_5_sunburst")!;
  assert.ok(nano && sun);
  for (const m of [nano, sun]) assert.ok(m.resolutions.includes("2k"));
  assert.ok(nano.references.max >= 3 && sun.references.max >= 4, "enough reference pictures");
  for (const r of ["3:4", "1:1", "4:5", "2:3", "4:3", "16:9"]) assert.ok(nano.ratios.includes(r), `nano ${r}`);
  for (const id of ["scene-product", "model-product"]) {
    const offered = pb(id).match(/(?:default 3:4[,;] or )([0-9:, ]+?)[.)]/)?.[1].split(",").map((x) => x.trim()) ?? [];
    assert.ok(offered.length >= 4, `${id} lists its ratios`);
    for (const r of offered) assert.ok(sun.ratios.includes(r), `${id} offers ${r}, which GPT Image 2.5 Sunburst makes`);
  }
});

test("the two video notes match their docs, name no outside service, and hand over through the prompt box", () => {
  assert.equal(PRODUCT_VIDEO_CRAFT, readFileSync("docs/prompt-engines/knowledge/product-video-craft.md", "utf8").trim());
  assert.equal(ADD_MOTION_CRAFT, readFileSync("docs/prompt-engines/knowledge/add-motion-craft.md", "utf8").trim());
  for (const t of [PRODUCT_VIDEO_CRAFT, ADD_MOTION_CRAFT]) {
    assert.ok(!OUTSIDE.test(t), "names no outside tool or folder");
    assert.ok(t.includes("suggest_prompt") && t.includes("set_prompt_box") && t.includes("Generate"));
    assert.ok(!/\$\d/.test(t), "no dollar prices: prices are credits");
  }
  assert.ok(PRODUCT_VIDEO_CRAFT.includes("4 to 30 seconds") && PRODUCT_VIDEO_CRAFT.includes("image 1") && PRODUCT_VIDEO_CRAFT.includes("never @ tags"));
  assert.ok(ADD_MOTION_CRAFT.includes("3 to 15 seconds") && ADD_MOTION_CRAFT.includes("START FRAME") && ADD_MOTION_CRAFT.includes("voiceover"));
});

test("Atlas loads them only on their own topics", () => {
  const say = (t: string) => [{ content: t }];
  assert.equal(wantsProductVideo(say("a portrait of my dog on a beach"), ""), false);
  assert.equal(wantsProductVideo(say("write a UGC product video of her unboxing the serum"), ""), true);
  assert.equal(wantsProductVideo(say("rebuild this reference video with my model"), ""), true);
  assert.equal(wantsProductVideo([{ content: [{ type: "text", text: "a selfie-review of my socks" }] }], ""), true);
  assert.equal(wantsAddMotion(say("make a cute cat picture"), ""), false);
  assert.equal(wantsAddMotion(say("animate this product photo, slow rotate"), ""), true);
  assert.equal(wantsAddMotion(say("add motion to my packshot"), ""), true);
  assert.equal(wantsAddMotion(say("hello"), "Model: Kling 3.0 Pro"), true);
});

test("the owner's originals are kept unchanged beside a note", () => {
  const O = "docs/prompt-engines/knowledge/original/product-skills";
  for (const d of ["model", "packshot", "product-shoot", "model-product-shoot", "product-video", "add-motion"]) assert.ok(readFileSync(`${O}/${d}/SKILL.md`, "utf8").length > 3000, d);
  assert.ok(readFileSync(`${O}/README.md`, "utf8").includes("No licence file"));
});
