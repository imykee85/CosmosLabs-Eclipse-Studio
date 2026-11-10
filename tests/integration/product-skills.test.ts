// The four product image skills in Core (2026-11-09), run end to end the way their playbooks say: Core's own tools (list_skills, use_skill, generate_image,
// check_render, remember, recall) -> startRender -> the image service. Every call uses the model, aspect ratio, resolution and picture order the playbook
// names (read from the playbook text itself), and the test checks what reaches the image service and that each render finishes and is stored.
// Throwaway Postgres, fake R2, fake Google (Nano Banana 2) and fake OpenAI (GPT Image 2.5 Sunburst); no real keys. Skips itself when DATABASE_URL is not set.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const U = "user_product_skills";
const objects = new Map<string, Buffer>();
let r2: Server, gg: Server, oa: Server;
const googleSeen: Record<string, unknown>[] = [];
const openaiSeen: Record<string, unknown>[] = [];
const googleOut: [number, number, number][] = []; // the colour of each picture the fake Google returned, in order
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const ctx = () => ({ userId: U, projectId: null, chatId: "c1", onRender: () => {}, onSend: () => {} });

async function png(rgb: [number, number, number], w = 120, h = 160) {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
}
// The colour of a picture sent to an image service (base64, or a data URL inside an object).
async function colourOf(x: unknown): Promise<[number, number, number]> {
  const s = typeof x === "string" ? x : JSON.stringify(x);
  const b64 = (s.match(/base64,([A-Za-z0-9+/=]+)/) ?? [])[1] ?? s;
  const sharp = (await import("sharp")).default;
  const st = await sharp(Buffer.from(b64, "base64")).stats();
  return [Math.round(st.channels[0].mean), Math.round(st.channels[1].mean), Math.round(st.channels[2].mean)];
}
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 6);

const C = { front: [200, 40, 40], back: [40, 200, 40], detail: [40, 40, 200], composition: [220, 200, 20], lighting: [20, 200, 220], product: [200, 20, 200] } as const;

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    if (req.method === "HEAD") { const o = objects.get(path); res.statusCode = o ? 200 : 404; if (o) res.setHeader("Content-Length", o.length); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  gg = createServer(async (req, res) => {
    googleSeen.push(JSON.parse((await body(req)).toString()));
    const n = googleOut.length + 1;
    const rgb: [number, number, number] = [(n * 37) % 200 + 30, (n * 71) % 200 + 30, (n * 113) % 200 + 30];
    googleOut.push(rgb);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ output_image: { type: "image", mime_type: "image/png", data: (await png(rgb, 120, 160)).toString("base64") }, usage: { total_tokens: 1 } }));
  });
  oa = createServer(async (req, res) => {
    openaiSeen.push(JSON.parse((await body(req)).toString()));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: (await png([90, 90, 90])).toString("base64") }], output_format: "png", usage: { total_tokens: 1 } }));
  });
  const port = (s: Server) => new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as { port: number }).port)));
  const [p1, p2, p3] = [await port(r2), await port(gg), await port(oa)];
  Object.assign(process.env, {
    R2_ENDPOINT: `http://127.0.0.1:${p1}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt",
    GEMINI_API_KEY: "test", GEMINI_BASE_URL: `http://127.0.0.1:${p2}`, OPENAI_API_KEY: "test", OPENAI_BASE_URL: `http://127.0.0.1:${p3}`, CREDITS_ENABLED: "0", RENDERS_PER_MINUTE: "500",
  });
  lib = { tools: await import("../../src/lib/connect-tools"), skills: await import("../../src/lib/skills"), db: (await import("../../src/lib/db")).db };
  await clean();
  for (const [k, rgb] of Object.entries(C)) objects.set(`/bkt/u/ps/${k}.png`, await png([...rgb] as [number, number, number]));
});
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: U } });
  await lib.db.upload.deleteMany({ where: { userId: U } });
  await lib.db.memory.deleteMany({ where: { userId: U } });
  await lib.db.usageEvent.deleteMany({ where: { userId: U } });
};
after(async () => { if (skip) return; await new Promise((r) => setTimeout(r, 300)); await clean(); await lib.db.$disconnect(); r2.close(); gg.close(); oa.close(); });

const upload = async (k: keyof typeof C) => (await lib.db.upload.create({ data: { userId: U, kind: "asset", name: k, storageKey: `u/ps/${k}.png`, contentType: "image/png", sizeBytes: 100, width: 120, height: 160 } })).id as string;
const tool = async (name: string, args: Record<string, unknown>) => {
  const out = await lib.tools.runTool(name, args, ctx());
  assert.ok(!out.isError, `${name}: ${out.text}`);
  return out.text as string;
};
const gen = async (args: Record<string, unknown>) => JSON.parse(await tool("generate_image", args)).generation_id as string;
/** Waits through check_render (the tool Core uses), as the model playbook says, until the render is completed. */
async function finished(id: string) {
  for (let i = 0; i < 150; i++) {
    const r = JSON.parse(await tool("check_render", { generation_id: id }));
    if (r.status === "completed") return;
    if (r.status === "failed") assert.fail(`render failed: ${r.error}`);
    await new Promise((x) => setTimeout(x, 100));
  }
  assert.fail("render did not finish");
}
const playbook = (id: string) => (lib.skills.skills as { id: string; playbook: string }[]).find((s) => s.id === id)!.playbook;
/** The quoted prompt that follows `lead` in a playbook (the playbooks hold each prompt as a JSON string). */
function quoted(pb: string, lead: string): string {
  const i = pb.indexOf(lead);
  assert.ok(i >= 0, `playbook has "${lead}"`);
  const s = pb.slice(i + lead.length).trimStart();
  assert.equal(s[0], '"');
  let j = 1; while (j < s.length && !(s[j] === '"' && s[j - 1] !== "\\")) j++;
  return JSON.parse(s.slice(0, j + 1));
}

test("Core lists and loads the four new skills", { skip }, async () => {
  const listed = JSON.parse(await tool("list_skills", {})) as { id: string; name: string }[];
  for (const [id, name] of [["model", "Create a model"], ["packshot", "Packshot"], ["scene-product", "Product in a scene"], ["model-product", "Model with product"]]) {
    assert.ok(listed.some((s) => s.id === id && s.name === name), `${id} is listed`);
    const loaded = await tool("use_skill", { id });
    assert.ok(loaded.startsWith(`Skill: ${name}\n`) && loaded.includes("generate_image"), `${id} loads its playbook`);
  }
});

let headshotId = "", fullbodyId = "";
test("Create a model: headshot, then the full body made from the finished headshot, then remembered", { skip }, async () => {
  const pb = playbook("model");
  for (const must of ["model nano_banana_2", "aspect_ratio 3:4", "resolution 2k", "check_render", "topic characters"]) assert.ok(pb.includes(must), must);
  const characteristics = "Age: 23\nSex: Female\nEthnicity: Asian\nSkin tone: Slightly olive\nEye colour: Green\nHair colour: Light brown\nHair style: Mid-length, slight waves, centre part\nBody type: Slim\nTone: Natural, high fashion";
  const headPrompt = quoted(pb, "STEP 3 - HEADSHOT: call generate_image with model nano_banana_2, aspect_ratio 3:4, resolution 2k, no references, and this prompt, replacing {characteristics} with the confirmed list:");
  const fullPrompt = quoted(pb, "replacing {characteristics} the same way:");
  assert.ok(headPrompt.includes("{characteristics}") && fullPrompt.includes("{characteristics}"));

  googleSeen.length = 0;
  headshotId = await gen({ prompt: headPrompt.replace("{characteristics}", characteristics), model: "nano_banana_2", aspect_ratio: "3:4", resolution: "2k" });
  await finished(headshotId);
  const h = googleSeen[0];
  assert.equal(h.model, "gemini-3.1-flash-image");
  assert.equal(typeof h.input, "string", "the headshot is made from text alone");
  assert.deepEqual(h.response_format, { type: "image", mime_type: "image/jpeg", aspect_ratio: "3:4", image_size: "2K" });
  assert.match(String(h.input), /High-fidelity agency casting portrait[\s\S]*Age: 23[\s\S]*Hair style: Mid-length/);

  fullbodyId = await gen({ prompt: fullPrompt.replace("{characteristics}", characteristics), model: "nano_banana_2", aspect_ratio: "3:4", resolution: "2k", references: [{ type: "render", id: headshotId }] });
  await finished(fullbodyId);
  const f = googleSeen[1];
  const parts = f.input as { type: string; text?: string; data?: string }[];
  assert.ok(Array.isArray(parts) && parts[0].type === "text" && parts[0].text!.includes("Maintain 1:1 facial identity"));
  const pics = parts.filter((p) => p.type === "image");
  assert.equal(pics.length, 1, "the headshot is the one reference picture");
  assert.ok(near(await colourOf(pics[0].data), googleOut[0]), "and it is the finished headshot itself");
  assert.deepEqual(f.response_format, { type: "image", mime_type: "image/jpeg", aspect_ratio: "3:4", image_size: "2K" });

  const who = "Model Jade: 23, female, Asian, slightly olive skin, green eyes, light brown mid-length wavy hair with a centre part, slim; natural, high fashion.";
  const renders = `Model Jade renders: headshot ${headshotId}, full body ${fullbodyId}, 3:4, plain casting outfit`;
  assert.ok(who.length < 380 && renders.length < 380);
  await tool("remember", { topic: "characters", text: who });
  await tool("remember", { topic: "characters", text: renders });
  const found = JSON.parse(await tool("recall", { topic: "characters", query: "model jade" })) as { text: string }[];
  assert.equal(found.length, 2, "both lines come back for a later skill");
  assert.ok(found.some((m) => m.text.includes(headshotId) && m.text.includes(fullbodyId)));
  for (const id of [headshotId, fullbodyId]) {
    const g = await lib.db.generation.findUnique({ where: { id } });
    assert.equal(g.kind, "image"); assert.equal(g.resolution, "2k"); assert.ok(g.storageKey, "stored in the Library");
  }
});

test("Packshot: every product picture goes in, in order, with the full staging and render specification", { skip }, async () => {
  const pb = playbook("packshot");
  assert.ok(pb.includes("model nano_banana_2, resolution 2k"));
  const spec = quoted(pb, "STEP 3 - FULL PROMPT: take that answer and add this block after it, word for word, changing nothing:");
  // What Core writes in STEP 2 (its own analysis), followed by the block the playbook fixes.
  const analysis = "Produce a clean, professional top-down flat-lay packshot, oriented with surgical precision for e-commerce.\n\n Product Typography and Alignment Syntax:\nACME (front, centred)\n\n--- Physical Characteristics ---\nDense-knit fleece with ribbed cuffs.";
  const ids = [await upload("front"), await upload("back"), await upload("detail")];
  googleSeen.length = 0;
  const id = await gen({ prompt: `${analysis}\n\n${spec}`, model: "nano_banana_2", aspect_ratio: "3:4", resolution: "2k", references: ids.map((i) => ({ type: "upload", id: i })) });
  await finished(id);
  const parts = googleSeen[0].input as { type: string; text?: string; data?: string }[];
  assert.ok(parts[0].text!.includes("Strict Negative Constraints") && parts[0].text!.includes("Material & Identity Fidelity") && parts[0].text!.includes("flat-lay"));
  const pics = parts.filter((p) => p.type === "image");
  assert.equal(pics.length, 3);
  for (const [i, k] of (["front", "back", "detail"] as const).entries()) assert.ok(near(await colourOf(pics[i].data), [...C[k]]), `picture ${i + 1} is the ${k}`);
});

test("Product in a scene: composition, product, lighting reach GPT Image 2.5 Sunburst in that order, at 2k", { skip }, async () => {
  const pb = playbook("scene-product");
  assert.ok(pb.includes("model gpt_image_2_5_sunburst, resolution 2k") && pb.includes("composition, product, lighting"));
  const withLight = quoted(pb, "Use this prompt WITH a lighting reference:");
  const without = quoted(pb, "and this one WITHOUT:");
  const [comp, prod, light] = [await upload("composition"), await upload("product"), await upload("lighting")];
  openaiSeen.length = 0;
  const a = await gen({ prompt: `${withLight} Add a slight shadow beneath the product.`, model: "gpt_image_2_5_sunburst", aspect_ratio: "3:4", resolution: "2k", references: [comp, prod, light].map((id) => ({ type: "upload", id })) });
  await finished(a);
  const b = await gen({ prompt: without, model: "gpt_image_2_5_sunburst", aspect_ratio: "3:4", resolution: "2k", references: [comp, prod].map((id) => ({ type: "upload", id })) });
  await finished(b);
  const [ra, rb] = openaiSeen as { model: string; size: string; prompt: string; images: unknown[] }[];
  assert.equal(ra.model, "gpt-image-2.5-sunburst");
  assert.match(ra.prompt, /Adopt the lighting and tonal atmosphere of image 3\.[\s\S]*slight shadow/);
  assert.ok(!rb.prompt.includes("image 3"), "the prompt without lighting never mentions a third picture");
  assert.equal(ra.images.length, 3); assert.equal(rb.images.length, 2);
  for (const [i, k] of (["composition", "product", "lighting"] as const).entries()) assert.ok(near(await colourOf(ra.images[i]), [...C[k]]), `image ${i + 1} is the ${k}`);
  const [w, h] = ra.size.split("x").map(Number);
  assert.ok(Math.abs(w / h - 3 / 4) < 0.02 && Math.max(w, h) >= 1500, `3:4 at 2k (${ra.size})`);
});

test("Model with product: reference, product, the model's headshot and full body, in that order", { skip }, async () => {
  assert.ok(headshotId && fullbodyId, "needs the model made above");
  const pb = playbook("model-product");
  assert.ok(pb.includes("model gpt_image_2_5_sunburst, resolution 2k") && pb.includes("reference, product, model headshot, styled model picture"));
  const prompt = quoted(pb, "Use this prompt:");
  // The model's render ids come back from memory, as the playbook says.
  const mem = JSON.parse(await tool("recall", { topic: "characters", query: "renders" })) as { text: string }[];
  const [, head, full] = mem[0].text.match(/headshot (\S+), full body (\S+?),/) ?? [];
  assert.equal(head, headshotId); assert.equal(full, fullbodyId);
  const [comp, prod] = [await upload("composition"), await upload("product")];
  openaiSeen.length = 0;
  const id = await gen({ prompt, model: "gpt_image_2_5_sunburst", aspect_ratio: "3:4", resolution: "2k", references: [{ type: "upload", id: comp }, { type: "upload", id: prod }, { type: "render", id: head }, { type: "render", id: full }] });
  await finished(id);
  const r = openaiSeen[0] as { prompt: string; images: unknown[] };
  assert.ok(r.prompt.includes("substituting the model with the one shown in image 3, wearing the clothes shown in image 4"));
  assert.equal(r.images.length, 4);
  const want = [[...C.composition], [...C.product], googleOut[0], googleOut[1]];
  for (let i = 0; i < 4; i++) assert.ok(near(await colourOf(r.images[i]), want[i]), `image ${i + 1} is in the right place`);
});

test("every aspect ratio a playbook offers is one its model accepts", { skip }, async () => {
  const offered = (pb: string) => (pb.match(/default 3:4[,;] or ([0-9:, ]+?)[.)]/)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const cases: [string, string][] = [
    ...offered(playbook("packshot")).map((r) => ["nano_banana_2", r] as [string, string]),
    ...offered(playbook("scene-product")).map((r) => ["gpt_image_2_5_sunburst", r] as [string, string]),
    ...offered(playbook("model-product")).map((r) => ["gpt_image_2_5_sunburst", r] as [string, string]),
  ];
  assert.ok(cases.length >= 14);
  const done = new Set<string>();
  for (const [model, ratio] of cases) {
    if (done.has(`${model}${ratio}`)) continue;
    done.add(`${model}${ratio}`);
    await finished(await gen({ prompt: "A bottle on a seamless grey backdrop.", model, aspect_ratio: ratio, resolution: "2k" }));
  }
});
