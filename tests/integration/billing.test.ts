// Top-ups, auto top-up and account deletion against a throwaway Postgres, a fake Whop and a fake R2 (nothing leaves this machine).
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration   (skips itself when DATABASE_URL is not set)
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

const DB = process.env.DATABASE_URL;
const skip = DB ? false : "DATABASE_URL not set";

const whopState = { charges: [] as { body: Record<string, unknown>; key: string | undefined }[], mode: "paid" as "paid" | "pending" | "decline", cancels: [] as string[], cancelFails: false, n: 0, cards: [] as { id: string; brand: string; last4: string; exp_month: number; exp_year: number }[], removed: [] as string[], setups: [] as Record<string, unknown>[] };
const objects = new Map<string, Buffer>();
let whopSrv: Server, r2: Server;
const SECRET = "whsec_" + Buffer.from("billing-test-secret").toString("base64");

const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const listen = (s: Server) => new Promise<number>((res) => s.listen(0, "127.0.0.1", () => res((s.address() as { port: number }).port)));
const json = (res: import("node:http").ServerResponse, status: number, data: unknown) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(data)); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;
const USER = "user_bill_a", OTHER = "user_bill_b";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  if (skip) return;
  whopSrv = createServer(async (req, res) => {
    const b = await body(req);
    if (req.url === "/payments") {
      whopState.charges.push({ body: JSON.parse(b.toString()), key: req.headers["idempotency-key"] as string | undefined });
      if (whopState.mode === "decline") return json(res, 402, { error: "card_declined" });
      return json(res, 200, { id: `pay_auto_${++whopState.n}`, status: whopState.mode === "paid" ? "paid" : "processing" });
    }
    if (req.method === "GET" && (req.url ?? "").startsWith("/payment_methods?member_id=mem_1")) return json(res, 200, { data: whopState.cards.map((c) => ({ id: c.id, card: { brand: c.brand, last4: c.last4, exp_month: c.exp_month, exp_year: c.exp_year } })) });
    const pm = /^\/payment_methods\/([^/]+)$/.exec(req.url ?? "");
    if (pm && req.method === "DELETE") { whopState.removed.push(pm[1]); whopState.cards = whopState.cards.filter((c) => c.id !== pm[1]); return json(res, 200, {}); }
    if (req.url === "/checkout_configurations") { whopState.setups.push(JSON.parse(b.toString())); return json(res, 200, { purchase_url: "https://whop.test/setup" }); }
    const m = /^\/memberships\/([^/]+)\/cancel$/.exec(req.url ?? "");
    if (m) { whopState.cancels.push(m[1]); return whopState.cancelFails ? json(res, 500, { error: "boom" }) : json(res, 200, {}); }
    json(res, 404, {});
  });
  r2 = createServer(async (req, res) => {
    const url = new URL(req.url ?? "", "http://x");
    const path = decodeURIComponent(url.pathname);
    if (req.method === "PUT") { objects.set(path, await body(req)); res.setHeader("etag", '"x"'); res.end(); return; }
    if (req.method === "DELETE") { objects.delete(path); res.statusCode = 204; res.end(); return; }
    if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = "/bkt/" + (url.searchParams.get("prefix") ?? "");
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice("/bkt/".length));
      res.setHeader("content-type", "application/xml");
      res.end(`<?xml version="1.0"?><ListBucketResult><Name>bkt</Name><IsTruncated>false</IsTruncated>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}</ListBucketResult>`);
      return;
    }
    const o = objects.get(path); if (!o) { res.statusCode = 404; res.end(); return; } res.end(o);
  });
  const [wp, rp] = [await listen(whopSrv), await listen(r2)];
  Object.assign(process.env, {
    WHOP_API_KEY: "k", WHOP_WEBHOOK_SECRET: SECRET, WHOP_API_BASE: `http://127.0.0.1:${wp}`,
    R2_ENDPOINT: `http://127.0.0.1:${rp}`, R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "bkt",
    CREDITS_ENABLED: "1",
  });
  lib = {
    billing: await import("../../src/lib/billing"), credits: await import("../../src/lib/credits"), res: await import("../../src/lib/reservations"),
    del: await import("../../src/lib/account-delete"), webhook: await import("../../src/app/api/payments/webhook/route"), db: (await import("../../src/lib/db")).db,
  };
});
after(async () => { if (skip) return; await wipe(); await lib.db.$disconnect(); whopSrv.close(); r2.close(); });

async function wipe() {
  for (const u of [USER, OTHER]) for (const t of lib.del.USER_TABLES) await lib.db[t].deleteMany({ where: { userId: u } });
}
const reset = async (credits: number) => {
  await wipe();
  if (credits > 0) await lib.credits.grantCredits(USER, credits, { reason: "GRANT", note: "test" });
  Object.assign(whopState, { charges: [], mode: "paid", cancels: [], cancelFails: false, cards: [], removed: [], setups: [] });
  objects.clear();
};
const balance = () => lib.credits.getBalance(USER);

function signed(event: unknown) {
  const raw = JSON.stringify(event);
  const id = "msg_" + Math.random().toString(36).slice(2), ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from(SECRET.slice(6), "base64")).update(`${id}.${ts}.${raw}`).digest("base64");
  return new Request("http://x/api/payments/webhook", { method: "POST", body: raw, headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` } });
}
const payment = (id: string, planId: string, extra: Record<string, unknown> = {}, auto = false) => ({ type: "payment.succeeded", data: { id, metadata: { userId: USER, planId, ...(auto ? { auto: "1" } : {}) }, ...extra } });
const arm = (extra: Record<string, unknown> = {}) => lib.db.billingSettings.upsert({ where: { userId: USER }, create: { userId: USER, autoEnabled: true, providerMemberId: "mem_1", providerPaymentMethod: "pm_1", ...extra }, update: { autoEnabled: true, providerMemberId: "mem_1", providerPaymentMethod: "pm_1", autoLastAttemptAt: null, autoLastError: null, ...extra } });

test("a top-up pack payment grants its credits once and remembers the saved card", { skip }, async () => {
  await reset(0);
  const ev = payment("pay_1", "topup_500", { member: { id: "mem_9" }, payment_method: { id: "pm_9" }, membership: { id: "ms_9" } });
  assert.equal((await lib.webhook.POST(signed(ev))).status, 200);
  assert.equal(await balance(), 500);
  const again = await (await lib.webhook.POST(signed(ev))).json();
  assert.equal(again.duplicate, true);
  assert.equal(await balance(), 500, "the same payment delivered twice adds credits once");
  const s = await lib.db.billingSettings.findUnique({ where: { userId: USER } });
  assert.deepEqual([s.providerMemberId, s.providerPaymentMethod, s.providerMembershipId], ["mem_9", "pm_9", "ms_9"]);
  const row = await lib.db.creditLedger.findFirst({ where: { userId: USER } });
  assert.equal(row.note, "Top-up: 500 credits");
  assert.equal((await lib.webhook.POST(signed(payment("pay_2", "mystery")))).status, 422, "an unknown product is not granted");
  assert.equal((await lib.webhook.POST(new Request("http://x", { method: "POST", body: "{}" }))).status, 401, "unsigned is refused");
});

test("auto top-up choices are validated and saved", { skip }, async () => {
  await reset(0);
  assert.equal((await lib.billing.saveAutoTopup(USER, { threshold: 7 })).ok, false);
  assert.equal((await lib.billing.saveAutoTopup(USER, { packId: "topup_1" })).ok, false);
  assert.equal((await lib.billing.saveAutoTopup(USER, { maxPerMonth: 99 })).ok, false);
  assert.equal((await lib.billing.saveAutoTopup(USER, { enabled: "yes" })).ok, false);
  const ok = await lib.billing.saveAutoTopup(USER, { enabled: true, packId: "topup_500", threshold: 500, maxPerMonth: 5 });
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.view.enabled, ok.view.packId, ok.view.threshold, ok.view.maxPerMonth, ok.view.hasCard], [true, "topup_500", 500, 5, false]);
  const off = await lib.billing.saveAutoTopup(USER, { enabled: false });
  assert.equal(off.view.enabled, false);
  assert.equal(off.view.threshold, 500, "other choices are kept");
});

test("auto top-up charges the saved card once when credits are low, and not before", { skip }, async () => {
  await reset(900);
  await arm({ autoPack: "topup_2000", autoThreshold: 250 });
  assert.equal(await lib.billing.autoTopup(USER), false, "above the limit: nothing happens");
  assert.equal(whopState.charges.length, 0);
  await lib.credits.spendCredits(USER, 700, "test");
  await wait(400); // the background top-up started by the spend
  assert.equal(whopState.charges.length, 1);
  const c = whopState.charges[0];
  assert.equal(c.body.member_id, "mem_1");
  assert.equal(c.body.payment_method_id, "pm_1");
  assert.deepEqual(c.body.plan, { initial_price: 34, currency: "usd", plan_type: "one_time" });
  assert.deepEqual(c.body.metadata, { userId: USER, planId: "topup_2000", auto: "1" });
  assert.match(c.key ?? "", /^auto-user_bill_a-/);
  assert.equal(await balance(), 200 + 2000);
  assert.equal(await lib.billing.autoTopup(USER), false, "now above the limit again");
  // the provider's own confirmation of the same payment adds nothing more
  const r = await (await lib.webhook.POST(signed(payment("pay_auto_1", "topup_2000", {}, true)))).json();
  assert.equal(r.duplicate, true);
  assert.equal(await balance(), 2200);
});

test("a pending charge waits for the provider's confirmation, which grants the credits once", { skip }, async () => {
  await reset(10);
  await arm({ autoPack: "topup_500" });
  whopState.mode = "pending";
  assert.equal(await lib.billing.autoTopup(USER), false);
  assert.equal(await balance(), 10);
  await lib.webhook.POST(signed(payment(`pay_auto_${whopState.n}`, "topup_500", {}, true)));
  assert.equal(await balance(), 510);
  const row = await lib.db.creditLedger.findFirst({ where: { userId: USER, reason: "PURCHASE" } });
  assert.equal(row.note, "Auto top-up: 500 credits", "counted against the monthly limit");
});

test("a declined card switches auto top-up off and says why", { skip }, async () => {
  await reset(5);
  await arm();
  whopState.mode = "decline";
  assert.equal(await lib.billing.autoTopup(USER), false);
  const s = await lib.db.billingSettings.findUnique({ where: { userId: USER } });
  assert.equal(s.autoEnabled, false);
  assert.match(s.autoLastError, /could not be charged/);
  assert.equal(await balance(), 5);
  whopState.mode = "paid"; whopState.charges = [];
  assert.equal(await lib.billing.autoTopup(USER), false, "off means off");
  assert.equal(whopState.charges.length, 0);
});

test("the monthly limit stops further automatic top-ups", { skip }, async () => {
  await reset(0);
  await arm({ autoPack: "topup_500", autoMaxPerMonth: 1 });
  assert.equal(await lib.billing.autoTopup(USER), true);
  await lib.credits.spendCredits(USER, 480, "test");
  await lib.db.billingSettings.update({ where: { userId: USER }, data: { autoLastAttemptAt: null } });
  whopState.charges = [];
  assert.equal(await lib.billing.autoTopup(USER), false);
  assert.equal(whopState.charges.length, 0, "no second charge this month");
  const s = await lib.db.billingSettings.findUnique({ where: { userId: USER } });
  assert.match(s.autoLastError, /limit/);
  assert.equal(s.autoEnabled, true, "still on, it resumes next month");
});

test("two renders starting at once cause one top-up", { skip }, async () => {
  await reset(0);
  await arm({ autoPack: "topup_500" });
  const data = (n: number) => ({ userId: USER, prompt: `p${n}`, status: "pending", model: "soul_v2" });
  const [a, b] = await Promise.all([lib.res.createGenerationHeld(USER, 2, data(1)), lib.res.createGenerationHeld(USER, 2, data(2))]);
  assert.equal(whopState.charges.length, 1);
  assert.ok("row" in a || "row" in b, "at least one render started after the top-up");
  assert.equal(await balance(), 500);
});

test("a job that cannot start for lack of credits tops up and then starts", { skip }, async () => {
  await reset(1);
  await arm({ autoPack: "topup_500", autoThreshold: 100 });
  const r = await lib.res.createGenerationHeld(USER, 300, { userId: USER, prompt: "big", status: "pending", model: "soul_v2" });
  assert.ok("row" in r);
  assert.equal(await balance(), 501);
  // without auto top-up the same request is refused with the numbers
  await lib.db.billingSettings.update({ where: { userId: USER }, data: { autoEnabled: false } });
  const none = await lib.res.createGenerationHeld(USER, 9999, { userId: USER, prompt: "huge", status: "pending", model: "soul_v2" });
  assert.ok("have" in none);
});

test("deleting an account removes every row, every file, and only that person's", { skip }, async () => {
  await reset(100);
  const { db } = lib;
  await db.project.create({ data: { userId: USER, name: "P" } });
  await db.generation.create({ data: { userId: USER, prompt: "x", status: "completed", storageKey: `u/${USER}/a.png` } });
  await db.upload.create({ data: { userId: USER, kind: "asset", name: "n", storageKey: `u/${USER}/up-1.png`, contentType: "image/png", sizeBytes: 1 } });
  await db.audioJob.create({ data: { userId: USER, kind: "tts", provider: "elevenlabs", model: "m", status: "completed", chars: 1, text: "t", voiceId: "v" } }).catch(() => null);
  await db.memory.create({ data: { userId: USER, topic: "style", text: "t", source: "user" } });
  const chat = await db.connectChat.create({ data: { userId: USER, messages: { create: [{ seq: 0, role: "user", content: [] }] } } });
  await db.billingSettings.upsert({ where: { userId: USER }, create: { userId: USER, providerMembershipId: "ms_77" }, update: { providerMembershipId: "ms_77" } });
  await db.project.create({ data: { userId: OTHER, name: "mine" } });
  for (const k of [`u/${USER}/a.png`, `u/${USER}/up-1.png`, `audio/${USER}/j.mp3`, `thumbs/u/${USER}/a.png.webp`, `u/${OTHER}/keep.png`, `u/${USER}x/keep.png`]) objects.set(`/bkt/${k}`, Buffer.from("x"));

  const r = await lib.del.deleteAccount(USER, { closeSignIn: false });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(whopState.cancels, ["ms_77"], "the subscription was ended");
  for (const t of lib.del.USER_TABLES) assert.equal(await db[t].count({ where: { userId: USER } }), 0, `${t} is empty`);
  assert.equal(await db.connectMessage.count({ where: { chatId: chat.id } }), 0, "chat messages went with their chat");
  assert.deepEqual([...objects.keys()].sort(), [`/bkt/u/${OTHER}/keep.png`, `/bkt/u/${USER}x/keep.png`].sort(), "only the other people's files are left");
  assert.equal(await db.project.count({ where: { userId: OTHER } }), 1);
  await db.project.deleteMany({ where: { userId: OTHER } });
});

test("deleting is refused while something is still being made, and says when the subscription could not be ended", { skip }, async () => {
  await reset(0);
  await lib.db.generation.create({ data: { userId: USER, prompt: "x", status: "pending" } });
  const busy = await lib.del.deleteAccount(USER, { closeSignIn: false });
  assert.deepEqual([busy.ok, busy.status], [false, 409]);
  await lib.db.generation.deleteMany({ where: { userId: USER } });
  await lib.db.billingSettings.create({ data: { userId: USER, providerMembershipId: "ms_88" } });
  whopState.cancelFails = true;
  const r = await lib.del.deleteAccount(USER, { closeSignIn: false });
  assert.equal(r.ok, true);
  assert.match(r.notes[0], /cancel it in your payment account/);
});

const visa = { id: "pm_1", brand: "visa", last4: "4242", exp_month: 4, exp_year: 2030 };
const amex = { id: "pm_2", brand: "amex", last4: "0005", exp_month: 11, exp_year: 2028 };

test("saved cards are listed from the provider, one is the auto top-up card, and a person cannot touch a card that is not listed for them", { skip }, async () => {
  await reset(0);
  assert.deepEqual((await lib.billing.listCards(USER)).cards, [], "no member yet: no cards");
  await arm();
  whopState.cards = [visa, amex];
  const l = await lib.billing.listCards(USER);
  assert.deepEqual(l.cards.map((c: { id: string; isDefault: boolean; last4: string }) => [c.id, c.isDefault, c.last4]), [["pm_1", true, "4242"], ["pm_2", false, "0005"]]);
  assert.equal(l.cards[0].expMonth, 4);
  assert.equal((await lib.billing.removeCard(USER, "pm_other")).status, 404);
  assert.equal((await lib.billing.setDefaultCard(USER, "pm_other")).status, 404);
  assert.deepEqual(whopState.removed, [], "nothing was sent to the provider");
  assert.equal((await lib.billing.setDefaultCard(USER, "pm_2")).ok, true);
  assert.equal((await lib.db.billingSettings.findUnique({ where: { userId: USER } })).providerPaymentMethod, "pm_2");
});

test("removing the auto top-up card hands over to another one, and the only saved card cannot be removed", { skip }, async () => {
  await reset(0);
  await arm();
  whopState.cards = [visa, amex];
  const r = await lib.billing.removeCard(USER, "pm_1");
  assert.equal(r.ok, true);
  assert.deepEqual(whopState.removed, ["pm_1"]);
  assert.deepEqual(r.cards.map((c: { id: string; isDefault: boolean }) => [c.id, c.isDefault]), [["pm_2", true]]);
  const s = await lib.db.billingSettings.findUnique({ where: { userId: USER } });
  assert.deepEqual([s.providerPaymentMethod, s.autoEnabled], ["pm_2", true]);
  const last = await lib.billing.removeCard(USER, "pm_2");
  assert.equal(last.ok, false);
  assert.equal(last.status, 409);
  assert.deepEqual(whopState.removed, ["pm_1"], "the last card is never sent to the provider for removal");
});

test("the first card used becomes the default and later payments or added cards do not replace it", { skip }, async () => {
  await reset(0);
  await lib.billing.rememberRefs(USER, { memberId: "mem_1", paymentMethodId: "pm_1" });
  await lib.billing.rememberRefs(USER, { memberId: "mem_1", paymentMethodId: "pm_2" });
  assert.equal((await lib.db.billingSettings.findUnique({ where: { userId: USER } })).providerPaymentMethod, "pm_1");
  whopState.cards = [visa, amex];
  assert.equal((await lib.billing.setDefaultCard(USER, "pm_2")).ok, true);
  await lib.billing.rememberRefs(USER, { memberId: "mem_1", paymentMethodId: "pm_1" });
  assert.equal((await lib.db.billingSettings.findUnique({ where: { userId: USER } })).providerPaymentMethod, "pm_2", "a chosen default stays");
});

test("adding a card opens the provider's card page for this person, and its confirmation saves the references without granting credits", { skip }, async () => {
  await reset(0);
  const { whop } = await import("../../src/lib/payments/whop");
  const { url } = await whop.createCardSetup!({ userId: USER, returnUrl: "http://x/settings?tab=billing&card=1" });
  assert.equal(url, "https://whop.test/setup");
  assert.deepEqual([whopState.setups[0].mode, (whopState.setups[0].metadata as { userId: string }).userId, whopState.setups[0].redirect_url], ["setup", USER, "http://x/settings?tab=billing&card=1"]);
  const ev = { type: "setup_intent.succeeded", data: { id: "si_1", metadata: { userId: USER, kind: "card" }, member: { id: "mem_1" }, payment_method: { id: "pm_1" } } };
  assert.equal((await lib.webhook.POST(signed(ev))).status, 200);
  const s = await lib.db.billingSettings.findUnique({ where: { userId: USER } });
  assert.deepEqual([s.providerMemberId, s.providerPaymentMethod], ["mem_1", "pm_1"]);
  assert.equal(await balance(), 0, "saving a card grants nothing");
});

test("a custom amount is priced by us, sent as a one-time price, and granted from the confirmed payment", { skip }, async () => {
  await reset(0);
  const { whop } = await import("../../src/lib/payments/whop");
  const { productById } = await import("../../src/lib/plans");
  const prod = productById("topup_custom", 1000)!;
  assert.equal(prod.price, 18);
  await whop.createCheckout({ userId: USER, planId: prod.id, returnUrl: "http://x/", custom: { credits: prod.credits, price: prod.price } });
  const sent = whopState.setups[0];
  assert.deepEqual(sent.plan, { initial_price: 18, currency: "usd", plan_type: "one_time" });
  assert.equal(sent.plan_id, undefined, "no ready-made plan is used");
  assert.deepEqual(sent.metadata, { userId: USER, planId: "topup_custom", credits: 1000 });
  const ev = payment("pay_c1", "topup_custom", { member: { id: "mem_1" }, payment_method: { id: "pm_1" } });
  (ev.data.metadata as Record<string, unknown>).credits = 1000;
  assert.equal((await lib.webhook.POST(signed(ev))).status, 200);
  assert.equal(await balance(), 1000);
  assert.equal((await (await lib.webhook.POST(signed(ev))).json()).duplicate, true);
  assert.equal(await balance(), 1000);
  const bad = payment("pay_c2", "topup_custom");
  (bad.data.metadata as Record<string, unknown>).credits = 999999;
  assert.equal((await lib.webhook.POST(signed(bad))).status, 422, "an amount outside the range is never granted");
  assert.equal(await balance(), 1000);
});

test("auto top-up with a custom amount saves it, validates it and charges that price", { skip }, async () => {
  await reset(900);
  assert.equal((await lib.billing.saveAutoTopup(USER, { enabled: true, packId: "topup_custom", credits: 10 })).ok, false);
  assert.equal((await lib.billing.saveAutoTopup(USER, { enabled: true, packId: "topup_custom" })).ok, false, "an amount is required");
  const ok = await lib.billing.saveAutoTopup(USER, { enabled: true, packId: "topup_custom", credits: 1000 });
  assert.deepEqual([ok.ok, ok.view.packId, ok.view.credits], [true, "topup_custom", 1000]);
  const fixed = await lib.billing.saveAutoTopup(USER, { packId: "topup_500" });
  assert.equal(fixed.view.credits, null, "choosing a fixed pack clears the custom amount");
  await lib.billing.saveAutoTopup(USER, { packId: "topup_custom", credits: 1000 });
  await arm({ autoPack: "topup_custom", autoCredits: 1000, autoThreshold: 250 });
  await lib.credits.spendCredits(USER, 700, "test");
  await wait(400);
  assert.equal(whopState.charges.length, 1);
  assert.deepEqual(whopState.charges[0].body.plan, { initial_price: 18, currency: "usd", plan_type: "one_time" });
  assert.deepEqual(whopState.charges[0].body.metadata, { userId: USER, planId: "topup_custom", credits: 1000, auto: "1" });
  assert.equal(await balance(), 200 + 1000);
});
