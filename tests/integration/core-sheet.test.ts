// Core's character sheet, end to end in code: Core's generate_image tool -> startRender -> OpenAI edit request, with the person's attached picture as the
// reference. Throwaway Postgres, fake R2 and fake OpenAI (no real keys). Skips itself when DATABASE_URL is not set.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const objects = new Map<string, Buffer>();
let r2: Server, oa: Server;
const seen: Record<string, unknown>[] = [];
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const U = "user_core_sheet";
const SHEET = "Professional 9:16 character design reference sheet of this one character. Clean seamless light grey studio background.";

async function png(w: number, h: number, rgb: [number, number, number]) {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
}

before(async () => {
  if (skip) return;
  r2 = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.end(); return; }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const out = await png(200, 300, [30, 30, 30]);
  oa = createServer(async (req, res) => {
    seen.push(JSON.parse((await body(req)).toString()));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: out.toString("base64") }], output_format: "png", usage: { total_tokens: 1 } }));
  });
  const p1 = await new Promise<number>((r) => r2.listen(0, "127.0.0.1", () => r((r2.address() as { port: number }).port)));
  const p2 = await new Promise<number>((r) => oa.listen(0, "127.0.0.1", () => r((oa.address() as { port: number }).port)));
  Object.assign(process.env, { R2_ENDPOINT: `http://127.0.0.1:${p1}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt", OPENAI_API_KEY: "test", OPENAI_BASE_URL: `http://127.0.0.1:${p2}`, CREDITS_ENABLED: "0" });
  lib = { start: await import("../../src/lib/start-render"), tools: await import("../../src/lib/connect-tools"), db: (await import("../../src/lib/db")).db };
  await clean();
  objects.set("/bkt/u/core/pic.png", await png(200, 300, [200, 30, 30]));
});
const clean = async () => {
  await lib.db.generation.deleteMany({ where: { userId: U } });
  await lib.db.upload.deleteMany({ where: { userId: U } });
};
after(async () => { if (skip) return; await new Promise((r) => setTimeout(r, 300)); await clean(); await lib.db.$disconnect(); r2.close(); oa.close(); });

test("Core's sheet uses the attached picture as a reference, at 9:16 and 2K, and the render is saved as an image", { skip }, async () => {
  const pic = await lib.db.upload.create({ data: { userId: U, kind: "asset", name: "Character", storageKey: "u/core/pic.png", contentType: "image/png", sizeBytes: 100, width: 200, height: 300 } });
  const rendered: string[] = [];
  const out = await lib.tools.runTool("generate_image", { prompt: SHEET, model: "gpt_image_2_5_sunburst", aspect_ratio: "9:16", resolution: "2k", references: [{ type: "upload", id: pic.id }] },
    { userId: U, projectId: null, chatId: "c1", onRender: (id: string) => rendered.push(id), onSend: () => {} });
  assert.ok(!out.isError, out.text);
  const id = JSON.parse(out.text).generation_id as string;
  assert.ok(rendered.includes(id));
  for (let i = 0; i < 100 && !seen.length; i++) await new Promise((x) => setTimeout(x, 100));
  assert.equal(seen.length, 1, "the picture edit request reached OpenAI");
  const req = seen[0];
  assert.equal(req.model, "gpt-image-2.5-sunburst");
  assert.equal(req.size, "1152x2048", "9:16 at 2K");
  assert.equal((req.images as unknown[]).length, 1, "the attached picture is sent as the reference");
  assert.match(String(req.prompt), /reference sheet/);
  for (let i = 0; i < 100; i++) {
    const g = await lib.db.generation.findUnique({ where: { id } });
    if (g?.status === "completed") { assert.equal(g.kind, "image", "stored as an image, not a video"); assert.equal(g.resolution, "2k"); return; }
    if (g?.status === "failed") assert.fail(`render failed: ${g.error} ${JSON.stringify(g.params)}`);
    await new Promise((x) => setTimeout(x, 100));
  }
  assert.fail("render did not finish");
});
