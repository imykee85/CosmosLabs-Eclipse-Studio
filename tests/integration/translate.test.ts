// The translator (src/lib/i18n/translate-server.ts) and its public routes against a throwaway Postgres and a fake Anthropic server.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";
let srv: Server;
let calls: { system: string; texts: string[] }[] = [];
let mode: "ok" | "short" | "lostPlaceholder" | "down" = "ok";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any, route: any, locale: any, dbm: any;

before(async () => {
  if (skip) return;
  srv = createServer((req, res) => {
    let b = ""; req.on("data", (d) => (b += d));
    req.on("end", () => {
      if (mode === "down") { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } })); return; }
      const j = JSON.parse(b);
      const texts = JSON.parse(j.messages[0].content) as string[];
      calls.push({ system: String(j.system), texts });
      let out = texts.map((t) => `ES(${t})`);
      if (mode === "short") out = out.slice(1);
      if (mode === "lostPlaceholder") out = texts.map((t) => t.replace(/\{\d+\}/g, "")) ;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", id: "t", name: "return_translations", input: { translations: out } }] }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  process.env.ANTHROPIC_API_KEY = "test";
  lib = await import("../../src/lib/i18n/translate-server");
  route = await import("../../src/app/api/translate/route");
  locale = await import("../../src/app/api/locale/route");
  dbm = (await import("../../src/lib/db")).db;
  await dbm.translation.deleteMany({});
});
after(async () => { if (!skip) { await dbm?.translation.deleteMany({}); await dbm?.$disconnect(); srv?.close(); } });

test("interface text is translated once, stored, and then served without another call", { skip }, async () => {
  const r1 = await lib.translateMany("es", ["Generate", "Library", "{0} min ago"]);
  assert.deepEqual(r1.translations, ["ES(Generate)", "ES(Library)", "ES({0} min ago)"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].system, /Spanish/);
  assert.match(calls[0].system, /Atlas/); // names that stay untranslated are told to the model
  const r2 = await lib.translateMany("es", ["Library", "Generate"]);
  assert.deepEqual(r2.translations, ["ES(Library)", "ES(Generate)"]);
  assert.equal(calls.length, 1); // nothing new asked
  const r3 = await lib.translateMany("pt", ["Library"]);
  assert.equal(r3.translations[0], "ES(Library)");
  assert.equal(calls.length, 2); // another language is its own row
});

test("text that is not in the code's manifest is never sent to the model or stored (people's own words stay private)", { skip }, async () => {
  const before = calls.length;
  const r = await lib.translateMany("es", ["a red sports car on a beach at sunset", "my secret product launch", "Generate"]);
  assert.deepEqual(r.translations.slice(0, 2), [false, false]);
  assert.equal(r.translations[2], "ES(Generate)");
  assert.equal(calls.length, before);
  assert.equal(await dbm.translation.count({ where: { source: { contains: "secret" } } }), 0);
});

test("a bad model answer (wrong count, lost number) leaves English and stores nothing", { skip }, async () => {
  mode = "short";
  let r = await lib.translateMany("fr", ["Gallery", "Assets"]);
  assert.deepEqual(r.translations, [null, null]);
  mode = "lostPlaceholder";
  r = await lib.translateMany("fr", ["{0} d ago"]);
  assert.deepEqual(r.translations, [null]);
  mode = "down";
  r = await lib.translateMany("fr", ["Gallery"]);
  assert.deepEqual(r.translations, [null]);
  assert.equal(await dbm.translation.count({ where: { lang: "fr" } }), 0);
  mode = "ok";
  r = await lib.translateMany("fr", ["Gallery"]);
  assert.equal(r.translations[0], "ES(Gallery)");
});

test("limits: unsupported language, oversize batch, kill switch, daily cap", { skip }, async () => {
  assert.equal((await lib.translateMany("en", ["Generate"])).ok, false);
  assert.equal((await lib.translateMany("ar", ["Generate"])).ok, false);
  assert.equal((await lib.translateMany("es", Array.from({ length: 61 }, (_, i) => `Generate ${i}`))).ok, false);
  const n = calls.length;
  process.env.TRANSLATE_KILL_SWITCH = "1";
  const k = await lib.translateMany("de", ["Generate"]);
  assert.deepEqual(k.translations, [null]);
  delete process.env.TRANSLATE_KILL_SWITCH;
  process.env.TRANSLATE_DAILY_NEW = "1";
  const c = await lib.translateMany("de", ["Generate", "Library"]);
  assert.deepEqual(c.translations, [null, null]);
  delete process.env.TRANSLATE_DAILY_NEW;
  assert.equal(calls.length, n);
});

test("the public route validates its input and answers", { skip }, async () => {
  const post = (body: unknown, ip = "1.1.1.1") => route.POST(new Request("http://x/api/translate", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));
  assert.equal((await post({ lang: "xx", texts: ["Generate"] })).status, 400);
  assert.equal((await post({ lang: "es", texts: [] })).status, 400);
  assert.equal((await post({ lang: "es", texts: [1] })).status, 400);
  const ok = await post({ lang: "es", texts: ["Generate"] });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).translations, ["ES(Generate)"]);
  let last = 200;
  for (let i = 0; i < 45; i++) last = (await post({ lang: "es", texts: ["Generate"] }, "9.9.9.9")).status;
  assert.equal(last, 429); // one address cannot hammer it
});

test("/api/locale reads the visitor's country from the host's header", { skip }, async () => {
  const get = async (h: Record<string, string>) => (await locale.GET(new Request("http://x/api/locale", { headers: h }))).json();
  const co = await get({ "x-vercel-ip-country": "CO", "accept-language": "en-US" });
  assert.equal(co.lang, "es");
  assert.equal(co.currency, "COP");
  assert.ok(co.rate > 100);
  const us = await get({ "x-vercel-ip-country": "US" });
  assert.deepEqual([us.lang, us.currency, us.rate], ["en", "USD", 1]);
  const none = await get({});
  assert.equal(none.country, null);
});
