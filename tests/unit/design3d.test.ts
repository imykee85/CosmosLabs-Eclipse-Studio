import test from "node:test";
import assert from "node:assert/strict";
import { MODELS_3D, buildBody3D, cleanOptions, find3D, modelsFor, path3D, price3D } from "../../src/lib/design/models3d";
import { pickGlbUrl } from "../../src/lib/design/jobs3d";

test("every mode has at least one model, and ids are unique", () => {
  for (const m of ["image", "multi", "text"] as const) assert.ok(modelsFor(m).length >= 1, m);
  assert.equal(new Set(MODELS_3D.map((m) => m.id)).size, MODELS_3D.length);
  assert.equal(find3D("nope"), undefined);
});

test("prices are whole ledger tenths, at least one credit, and can be overridden", () => {
  for (const m of MODELS_3D) { const p = price3D(m); assert.ok(Number.isInteger(p) && p >= 10, m.id); }
  const m = MODELS_3D[0];
  process.env[`DESIGN3D_USD_${m.id.toUpperCase()}`] = "1";
  assert.equal(price3D(m), 100);
  delete process.env[`DESIGN3D_USD_${m.id.toUpperCase()}`];
});

test("endpoint path defaults to the model id and can be overridden", () => {
  const m = MODELS_3D[0];
  assert.equal(path3D(m), m.id);
  process.env[`HIGGSFIELD_3D_PATH_${m.id.toUpperCase()}`] = "/v1/x/y";
  assert.equal(path3D(m), "v1/x/y");
  delete process.env[`HIGGSFIELD_3D_PATH_${m.id.toUpperCase()}`];
});

test("options are clamped to the model's range; realistic materials need texture", () => {
  const m = find3D("tripo_h3_1_image_to_3d")!;
  assert.equal(cleanOptions(m, { polycount: 5 }).polycount, m.polyMin);
  assert.equal(cleanOptions(m, { polycount: 1e9 }).polycount, m.polyMax);
  assert.equal(cleanOptions(m, { polycount: "x" }).polycount, null);
  assert.deepEqual(cleanOptions(m, { textured: false, pbr: true }), { textured: false, pbr: false, polycount: null });
  assert.deepEqual(cleanOptions(m, null), { textured: true, pbr: false, polycount: null });
});

test("request bodies: one picture, several views, or words", () => {
  const meshy = find3D("meshy_v7_image_to_3d")!, multi = find3D("tripo_h3_1_multiview_to_3d")!, text = find3D("meshy_v6_text_to_3d")!;
  const o = { textured: true, pbr: true, polycount: 20000 };
  const a = buildBody3D(meshy, "image", { prompt: "", urls: ["https://x/1.png"], options: o });
  assert.equal(a.image_url, "https://x/1.png"); assert.equal(a.enable_pbr, true); assert.equal(a.target_polycount, 20000);
  const b = buildBody3D(multi, "multi", { prompt: "", urls: ["https://x/1.png", "https://x/2.png"], options: o });
  assert.deepEqual(b.image_urls, ["https://x/1.png", "https://x/2.png"]); assert.equal(b.face_limit, 20000); assert.equal("image_url" in b, false);
  const c = buildBody3D(text, "text", { prompt: "a boat", urls: [], options: { textured: false, pbr: false, polycount: null } });
  assert.equal(c.prompt, "a boat"); assert.equal(c.mode, "preview"); assert.equal("image_url" in c, false);
});

test("the .glb address is found wherever the maker puts it, https only", () => {
  assert.equal(pickGlbUrl({ result: { model: { url: "https://cdn.x/a/b.glb?sig=1" } } }), "https://cdn.x/a/b.glb?sig=1");
  assert.equal(pickGlbUrl({ outputs: [{ preview: "https://x/p.png" }, { glb: "https://x/m.GLB" }] }), "https://x/m.GLB");
  assert.equal(pickGlbUrl({ url: "http://x/m.glb" }), null);
  assert.equal(pickGlbUrl({ url: "https://x/m.png" }), null);
  assert.equal(pickGlbUrl(null), null);
});
