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
  route = await import("../../src/app/api/i18n/[lang]/route");
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

test("the dictionary the browser downloads: hash of the English text -> translation, only code-written wording, cached", { skip }, async () => {
  const { hash } = await import("../../src/lib/i18n/text");
  await lib.translateMany("it", ["Generate", "Library"]);
  const get = (lang: string) => route.GET(new Request(`http://x/api/i18n/${lang}`), { params: { lang } });
  assert.equal((await get("en")).status, 404);
  assert.equal((await get("ar")).status, 404);
  const r = await get("it");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.d[hash("Generate")], "ES(Generate)");
  assert.equal(j.d[hash("Library")], "ES(Library)");
  assert.ok(j.n >= 2 && j.t > 1000);
  assert.match(r.headers.get("cache-control") ?? "", /s-maxage/); // an edge-cached file
  assert.equal(Object.values(j.d).some((t) => /secret/i.test(String(t))), false);
});

test("warming a whole language translates every interface string once, in batches, and the dictionary then holds all of them", { skip }, async () => {
  let r = await lib.warmLanguage("nl", 240);
  assert.ok(r.added > 100 && r.remaining > 0 && r.total > 1000);
  for (let i = 0; i < 40 && r.remaining; i++) r = await lib.warmLanguage("nl", 240);
  assert.equal(r.remaining, 0);
  const before = calls.length;
  const again = await lib.warmLanguage("nl", 240);
  assert.deepEqual([again.added, again.remaining], [0, 0]);
  assert.equal(calls.length, before); // nothing left to ask
  const dict = await lib.dictionaryFor("nl");
  assert.equal(dict.count, dict.total);
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
