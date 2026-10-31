import { creditsForUsd, videoCreditsAtProviderRate } from "../../src/lib/price-constants";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { fmtCredits, toLedger, toCredits, LEDGER_UNITS_PER_CREDIT } from "../../src/lib/credit-units";
import { allImageModels, chargeFor, getModelById, imageCredits, toPublic } from "../../src/lib/models";
import { imageCost } from "../../src/lib/image-render";
import { VIDEO_MODELS, videoCredits, videoPrice, videoModelById } from "../../src/lib/video-models";
import { CUSTOM_PACK_ID, creditPacks, plans, productById } from "../../src/lib/plans";
import { BEST_VALUE_PACK_ID, IMAGE_YARDSTICK_CREDITS, SEEDANCE_CLIP_CREDITS, planSaving, planValue } from "../../src/lib/plan-copy";
import { DIRECT_KEY, registerDirectRoute, routeFor, startWithFallback, unregisterDirectRoute } from "../../src/lib/routes";
import { allPriceRows, netPerCredit } from "../../src/lib/price-table";
import { creditsFor, usdFor } from "../../src/lib/audio/pricing";
import { outOfCredits } from "../../src/lib/credit-message";

afterEach(() => { for (const k of Object.keys(process.env)) if (k.startsWith("ROUTE_")) delete process.env[k]; delete process.env.CREDITS_ENABLED; for (const k of new Set(Object.values(DIRECT_KEY))) delete process.env[k]; for (const id of Object.keys(DIRECT_KEY)) unregisterDirectRoute(id); });

// ---- units and display ------------------------------------------------------------------------------------------------------------------------------------
test("the ledger counts in tenths of a credit and people see whole credits, or one decimal", () => {
  assert.equal(LEDGER_UNITS_PER_CREDIT, 10);
  assert.equal(fmtCredits(10), "1");
  assert.equal(fmtCredits(1874), "187.4");
  assert.equal(fmtCredits(100), "10");
  assert.equal(fmtCredits(5), "0.5");
  assert.equal(fmtCredits(25000), "2,500");
  assert.equal(fmtCredits(0), "0");
  assert.equal(toLedger(10), 100);
  assert.equal(toCredits(2000), 200);
});

// ---- plans and packs -----------------------------------------------------------------------------------------------------------------------------------------
test("plans and packs grant what the owner set (ledger units) and show whole credits", () => {
  assert.deepEqual(plans.map((p) => [p.id, p.price, p.credits, p.seats]), [["starter", 19, 1500, 1], ["growth", 49, 4000, 3], ["scale", 199, 15000, 10]]);
  assert.deepEqual(plans.map((p) => fmtCredits(p.credits)), ["150", "400", "1,500"]);
  assert.deepEqual(creditPacks.map((p) => [p.id, p.price, p.credits, p.name]), [["topup_500", 6, 400, "40 credits"], ["topup_2000", 22, 1550, "155 credits"], ["topup_6000", 60, 4300, "430 credits"], ["topup_10000", 100, 7300, "730 credits"]]);
  assert.equal(productById("growth")?.credits, 4000);
  assert.equal(productById("topup_6000")?.price, 60);
  assert.equal(productById(CUSTOM_PACK_ID, 1000)?.name, "100 credits");
});

test("plan cards: what the credits buy, checked against the real price tables", () => {
  assert.deepEqual(plans.map(planValue), ["about 27 Seedance 2.5 clips or 375 images", "about 74 Seedance 2.5 clips or 1,000 images", "about 277 Seedance 2.5 clips or 3,750 images"]);
  assert.deepEqual(plans.map(planSaving), [0, 3, -5]);
  assert.equal(SEEDANCE_CLIP_CREDITS, videoCredits(videoModelById("seedance_2_5")!, "480p", 5, false, "direct"), "a 5 s Seedance 2.5 clip at 480p, direct route, no sound");
  assert.equal(IMAGE_YARDSTICK_CREDITS, imageCredits(getModelById("nano_banana_2_1"), "1k"), "a Nano Banana 2.1 image at 1K");
  assert.equal(BEST_VALUE_PACK_ID, creditPacks[creditPacks.length - 1].id, "the biggest pack is Best value");
});

test("top-up credits are always dearer than a plan's and a bigger pack is always cheaper per credit", () => {
  const rate = (x: { price: number; credits: number }) => x.price / x.credits;
  const dearestPlan = Math.max(...plans.map(rate));
  for (const p of creditPacks) assert.ok(rate(p) > dearestPlan, `${p.id} costs more per credit than every plan`);
  for (let i = 1; i < creditPacks.length; i++) assert.ok(rate(creditPacks[i]) < rate(creditPacks[i - 1]), "bigger packs are cheaper per credit");
});

// ---- images ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Images are charged AT COST (owner 2026-10-31): the maker's price rounded UP to the next cent, as tenths of a credit (a credit is $0.10), never below 0.1.
const atCost = (usd: number) => Math.max(1, Math.ceil(Math.round(usd * 100 * 1e6) / 1e6)) / 10;

test("image credits are the maker's price rounded up to the next cent, for every model and resolution", () => {
  for (const m of allImageModels()) for (const [key, usd] of Object.entries(m.usd)) {
    assert.equal(imageCredits(m, key === "default" ? undefined : key, "higgsfield"), atCost(usd), `${m.id} ${key}`);
  }
  // a few rows written out by hand
  const c = (id: string, res: string | undefined) => imageCredits(getModelById(id), res);
  assert.equal(c("nano_banana_pro", "1k"), 1.4);
  assert.equal(c("nano_banana_pro", "4k"), 2.4);
  assert.equal(c("nano_banana_2_1", "1k"), 0.4);
  assert.equal(c("gpt_image_2_5_sunburst", "1k"), 0.6);
  assert.equal(c("gpt_image_2_5_sunburst", "2k"), 2);
  assert.equal(c("seedream_5_pro", "1k"), 0.7);
  assert.equal(c("soul_v2", "720p"), 0.1, "the cheapest image is a cent");
  assert.equal(creditsForUsd(0.07), 0.7, "float noise does not add a tenth");
});

test("a render at 2k holds and charges the 2k price, not the 1k one (credits on)", () => {
  process.env.CREDITS_ENABLED = "1";
  const gpt = getModelById("gpt_image_2")!;
  assert.equal(chargeFor(gpt, "1k"), 6);
  assert.equal(chargeFor(gpt, "2k"), 20);
  assert.equal(chargeFor(gpt, undefined), 6, "no resolution sent: the model's default");
  assert.equal(chargeFor(getModelById("soul")!, "1080p"), 19);
  delete process.env.CREDITS_ENABLED;
  assert.equal(chargeFor(gpt, "2k"), null, "nothing is charged while credits are off");
});

test("Soul 2 and Soul Cinema: every image pays its own price (no shared batch price any more)", () => {
  process.env.CREDITS_ENABLED = "1";
  for (const id of ["soul_v2", "soul_cinema"]) {
    const pub = toPublic(getModelById(id)!);
    assert.equal(imageCost(pub, "720p", 4), 4, "4 images = 4 x 0.1 credit = 4 ledger units");
    assert.equal(imageCost(pub, "1080p", 1), 1);
    assert.equal(imageCost(pub, "720p", 5), 5);
  }
  const grok = toPublic(getModelById("grok_image_2")!);
  assert.equal(imageCost(grok, "2k", 3), 24, "other models: price x images");
  assert.equal(getModelById("gpt_image_1")!.enabled, false, "GPT Image 1 retires 2026-10-23");
});

// ---- video ----------------------------------------------------------------------------------------------------------------------------------------------------------
// Video is charged AT COST too (owner 2026-10-31): the maker's price for the whole clip, rounded UP once to the next cent (tenth of a credit).
const clipAtCost = (usd: number) => Math.max(1, Math.ceil(Math.round(usd * 100 * 1e6) / 1e6)) / 10;

test("every connected video model and quality is charged the maker's price for the clip, rounded up once", () => {
  for (const m of VIDEO_MODELS as any[]) {
    if (!m.live) continue;
    for (const key of Object.keys(m.live.price.usd)) {
      const res = key === "default" ? undefined : key;
      for (const seconds of [4, 5, 10]) {
        const perSecond = m.live.price.usd[key];
        assert.equal(videoCredits(m, res, seconds, false, "higgsfield"), clipAtCost(perSecond * seconds), `${m.id} ${key} ${seconds} s`);
      }
    }
  }
});

test("clip prices written out by hand", () => {
  const v = (id: string) => videoModelById(id)!;
  assert.equal(videoCredits(v("kling_3_std"), undefined, 5, false), 4.2, "0.084 x 5 = $0.42");
  assert.equal(videoCredits(v("kling_3_std"), undefined, 5, true), 6.3, "with sound 0.126 x 5");
  assert.equal(videoCredits(v("kling_3_pro"), undefined, 5, false), 5.6);
  assert.equal(videoCredits(v("kling_3_pro"), undefined, 5, true), 8.4);
  assert.equal(videoCredits(v("kling_3_4k"), undefined, 5, true), 31.5);
  assert.equal(videoPrice(v("kling_3_pro"), undefined, 5, true), 84, "the ledger unit is a tenth of a credit");
});

test("the video markup and credit value still come from VIDEO_MARGIN and VIDEO_CREDIT_USD (default 1 and $0.10)", () => {
  const m = videoModelById("kling_3_pro")!;
  assert.equal(videoCredits(m, undefined, 5, true), 8.4);
  process.env.VIDEO_MARGIN = "2.5"; process.env.VIDEO_CREDIT_USD = "0.10";
  try { assert.equal(videoCredits(m, undefined, 5, true), 21); } finally { delete process.env.VIDEO_MARGIN; delete process.env.VIDEO_CREDIT_USD; }
});

test("video is rounded ONCE for the whole clip, never per second", () => {
  const std = videoModelById("kling_3_std")!;
  // 0.084 a second without sound: 3 s = $0.252 -> 0.26 dollars -> 2.6 credits (not 3 x the per-second price rounded up)
  assert.equal(videoCredits(std, undefined, 3, false), 2.6);
  assert.equal(videoCredits(std, undefined, 10, false), 8.4);
  assert.ok(videoCredits(std, undefined, 5, false)! < videoCredits(std, undefined, 5, true)!);
  const seed = videoModelById("seedance_2_0")!;
  assert.equal(videoCredits(seed, "720p", 5, true), videoCredits(seed, "720p", 5, false));
  assert.equal(videoCredits(seed, "720p", 1, false), 3.1, "0.3024 a second at the maker's price: $0.31");
});

test("Seedance clips can be 4 s: the minimum comes from the model settings", () => {
  for (const id of ["seedance_2_0", "seedance_2_5"]) for (const wf of ["t2v", "i2v"] as const) assert.equal(videoModelById(id)!.live!.durations[wf].min, 4, `${id} ${wf}`);
});

test("Seedance direct is cheaper and follows the route that is really used", () => {
  const s25 = videoModelById("seedance_2_5")!;
  const s20 = videoModelById("seedance_2_0")!;
  assert.equal(videoCredits(s25, "480p", 5, false, "direct"), 5.4, "0.1075 x 5 = $0.5375 -> $0.54");
  assert.equal(videoCredits(s25, "720p", 5, false, "direct"), 11.6, "0.2311 x 5 = $1.1555 -> $1.16");
  assert.equal(videoCredits(s25, "1080p", 5, false, "direct"), 28.5, "0.5686 x 5 = $2.843 -> $2.85");
  assert.equal(videoCredits(s20, "720p", 5, false, "direct"), 7.5, "0.15 x 5 = $0.75");
  assert.equal(videoCredits(s20, "1080p", 5, false, "direct"), 18.5, "0.37 x 5 = $1.85");
  assert.equal(videoCredits(s20, "4k", 5, false, "direct"), 39, "0.78 x 5 = $3.90");
  assert.equal(videoCredits(s20, "480p", 4, false, "direct"), 2.8, "0.07 x 4 = $0.28");
  assert.equal(videoPrice(s25, "720p", 5, false, "direct"), 116, "the ledger unit is a tenth of a credit");
  assert.equal(videoCredits(s25, "720p", 5, false, "higgsfield"), videoCreditsAtProviderRate(s25.live!.price.usd["720p"] * 5), "on the other route, still at the maker's price");
});

// ---- routes ---------------------------------------------------------------------------------------------------------------------------------------------------------
test("a direct route is used only with the setting, the key AND an adapter; otherwise Higgsfield", async () => {
  assert.equal(routeFor("seedance_2_5"), "higgsfield");
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  assert.equal(routeFor("seedance_2_5"), "higgsfield", "no key, no adapter");
  process.env.ARK_API_KEY = "x";
  assert.equal(routeFor("seedance_2_5"), "direct", "setting + key + the BytePlus video adapter");
  delete process.env.ARK_API_KEY;
  assert.equal(routeFor("seedance_2_5"), "higgsfield", "key missing again");
  // the image prices follow the route too
  const qwen = getModelById("qwen_image_3")!;
  assert.equal(imageCredits(qwen, "2k"), 0.8);
  assert.equal(imageCredits(qwen, "2k", "direct"), 0.3);
  process.env.ROUTE_QWEN_IMAGE_3 = "direct"; process.env.DASHSCOPE_API_KEY = "x"; registerDirectRoute("qwen_image_3");
  assert.equal(imageCredits(qwen, "2k"), 0.3, "default route is the one really used");
  assert.equal(imageCredits(getModelById("grok_image_2")!, "2k", "direct"), 0.4);
  // a direct start that fails before the provider accepts falls back to Higgsfield
  const out = await startWithFallback("direct", async () => { throw new Error("provider down"); }, async () => "from higgsfield");
  assert.deepEqual(out, { route: "higgsfield", value: "from higgsfield" });
  assert.deepEqual(await startWithFallback("direct", async () => "from direct", async () => "from higgsfield"), { route: "direct", value: "from direct" });
});

// ---- audio, chat, messages ------------------------------------------------------------------------------------------------------------------------------------------
test("audio and chat default to a 2.5x margin at $0.01 a ledger unit", () => {
  assert.equal(creditsFor(0.004), 1);
  assert.equal(creditsFor(0.04), 10, "$0.04 of provider cost = 1 credit = 10 ledger units");
});

test("audio, sound, music and transcription match the master brief section 7 (tenths, shown with one decimal)", async () => {
  const { findAudioModel } = await import("../../src/lib/audio/registry");
  const rows: [string, number, string][] = [
    ["eleven_v4", 1000, "2"], ["eleven_v3", 1000, "2"], ["eleven_multilingual_v2", 1000, "2"], ["eleven_v4_turbo", 1000, "1"], ["eleven_flash_v2_5", 1000, "1"],
    ["s2.1-pro", 1000, "0.4"], ["s2-pro", 1000, "0.4"], ["speech-2.8-hd", 1000, "2.5"], ["speech-2.8-turbo", 1000, "1.5"], ["qwen3-tts-flash", 1000, "0.3"],
    ["seed-audio-1.0", 60, "4"], ["eleven_text_to_sound_v2", 10, "0.5"], ["music_v2_5", 60, "3.8"],
    ["scribe_v2", 600, "1"], ["transcribe-1-pro", 600, "1.5"], ["asr-1.0", 600, "1.6"],
  ];
  for (const [id, units, want] of rows) {
    const m = findAudioModel(id);
    assert.ok(m, id);
    assert.equal(fmtCredits(creditsFor(usdFor(m!, units))), want, `${id} per ${units}`);
  }
});

test("out-of-credits messages speak in credits", () => {
  assert.match(outOfCredits("Soul", 20, 5, 0, false, 0), /needs 2 credits\. You have 0\.5/);
  assert.match(outOfCredits("Soul", 20, 0, 0, true, 0), /used your free images/);
  assert.match(outOfCredits("Soul", 20, 5, 0, false, 1874), /187\.4 top-up credits/);
});

// ---- the owner's price check ----------------------------------------------------------------------------------------------------------------------------------------
test("no image or video row is sold below cost plus the payment fee on any plan; audio keeps its margin; the estimates are flagged", () => {
  const rows = allPriceRows();
  assert.ok(rows.length > 100);
  // The guard (owner 2026-10-31): at the maker's cost every plan must still earn something after the payment fee on EVERY row.
  for (const r of rows) for (const [plan, m] of Object.entries(r.margin)) assert.ok(m > (r.kind === "audio" ? 0.4 : 0.05), `${r.model} ${r.setting} on ${plan}: ${m}`);
  assert.deepEqual(plans.map((p) => Number(netPerCredit(p).toFixed(4))), [0.1168, 0.1142, 0.1242]);
  const flagged = (id: string, setting: string) => rows.find((r) => r.model === id && r.setting === setting)?.estimate;
  assert.equal(flagged("soul_cinema", "1080p"), true);
  assert.equal(flagged("grok_image_2", "2k"), true);
  assert.equal(flagged("nano_banana_2_lite", "1k"), true);
  assert.equal(flagged("kling_3_4k", "any, sound on"), true);
  assert.equal(flagged("kling_3_std", "any, sound on"), true);
  assert.equal(flagged("wan3_0_prime", "720p"), true);
  assert.equal(flagged("kling_mc_26_pro", "any"), true);
  assert.equal(flagged("kling_3_pro", "any, sound on"), false);
  assert.ok(VIDEO_MODELS.length > 0);
});
