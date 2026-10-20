import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { fmtCredits, toLedger, toCredits, LEDGER_UNITS_PER_CREDIT } from "../../src/lib/credit-units";
import { allImageModels, chargeFor, getModelById, imageCredits, toPublic } from "../../src/lib/models";
import { imageCost } from "../../src/lib/image-render";
import { VIDEO_MODELS, videoCredits, videoPrice, videoModelById } from "../../src/lib/video-models";
import { CUSTOM_PACK_ID, creditPacks, plans, productById } from "../../src/lib/plans";
import { KLING_YARDSTICK_CREDITS, planSaving, planValue } from "../../src/lib/plan-copy";
import { DIRECT_KEY, registerDirectRoute, routeFor, startWithFallback, unregisterDirectRoute } from "../../src/lib/routes";
import { allPriceRows, netPerCredit } from "../../src/lib/price-table";
import { creditsFor } from "../../src/lib/audio/pricing";
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
test("plans and packs grant what the brief says (ledger units) and show whole credits", () => {
  assert.deepEqual(plans.map((p) => [p.id, p.price, p.credits, p.seats]), [["starter", 19, 2000, 1], ["growth", 49, 6000, 3], ["scale", 199, 25000, 10]]);
  assert.deepEqual(plans.map((p) => fmtCredits(p.credits)), ["200", "600", "2,500"]);
  assert.deepEqual(creditPacks.map((p) => [p.id, p.price, p.credits, p.name]), [["topup_500", 6, 500, "50 credits"], ["topup_2000", 22, 2000, "200 credits"], ["topup_6000", 60, 6000, "600 credits"]]);
  assert.equal(productById("growth")?.credits, 6000);
  assert.equal(productById("topup_6000")?.price, 60);
  assert.equal(productById(CUSTOM_PACK_ID, 1000)?.name, "100 credits");
});

test("plan cards: what the credits buy and the saving against Starter", () => {
  assert.deepEqual(plans.map(planValue), ["≈ 200 images or 9 Kling videos", "≈ 600 images or 28 Kling videos", "≈ 2,500 images or 119 Kling videos"]);
  assert.deepEqual(plans.map(planSaving), [0, 14, 16]);
  const kling = videoModelById("kling_3_pro")!;
  assert.equal(videoCredits(kling, undefined, 5, true), KLING_YARDSTICK_CREDITS, "the yardstick is Kling 3.0 Pro, 5 s, sound on");
});

// ---- images ---------------------------------------------------------------------------------------------------------------------------------------------------------
// [model, resolution, credits per image] copied from the owner's table (brief section 8).
const IMAGE_TABLE: [string, string | undefined, number][] = [
  ["soul_v2", "720p", 1], ["soul_v2", "1080p", 1], ["soul", "720p", 3], ["soul", "1080p", 5], ["soul_cinema", "720p", 1], ["soul_cinema", "1080p", 1],
  ["marketing_studio_image", "1k", 1], ["marketing_studio_image", "2k", 1], ["marketing_studio_image", "4k", 3],
  ["marketing_studio_image_flare", "1k", 1], ["marketing_studio_image_flare", "2k", 1], ["marketing_studio_image_sunburst", "1k", 1], ["marketing_studio_image_sunburst", "2k", 1],
  ["ads_studio", undefined, 3], ["grok_image_2", "1k", 1], ["grok_image_2", "2k", 2],
  ["recraft_v4_1", "1k", 1], ["recraft_v4_1_pro", "2k", 6], ["recraft_v4_1_utility", "1k", 1], ["recraft_v4_1_utility_pro", "2k", 6],
  ["qwen_image_3", "1k", 1], ["qwen_image_3", "2k", 2], ["qwen_image_3_edit", "1k", 1], ["qwen_image_3_edit", "2k", 2],
  ["ideogram_4", undefined, 1], ["z_image_turbo", "1k", 1], ["z_image_turbo", "2k", 1],
  ["nano_banana_2_1", "1k", 1], ["nano_banana_2_1", "2k", 2], ["nano_banana_2_1", "4k", 2], ["nano_banana_2_lite", "1k", 1],
  ["nano_banana_2", "1k", 2], ["nano_banana_2", "2k", 3], ["nano_banana_2", "4k", 4], ["nano_banana_pro", "1k", 4], ["nano_banana_pro", "2k", 4], ["nano_banana_pro", "4k", 6], ["nano_banana", undefined, 1],
  ["gpt_image_2_5_sunburst", "1k", 2], ["gpt_image_2_5_sunburst", "2k", 5], ["gpt_image_2_5_flare", "1k", 2], ["gpt_image_2_5_flare", "2k", 5],
  ["gpt_image_2", "1k", 2], ["gpt_image_2", "2k", 5], ["gpt_image_1_5", undefined, 2], ["gpt_image_1", undefined, 2], ["gpt_image_1_mini", undefined, 1],
  ["seedream_5_pro", "1k", 2], ["seedream_5_pro", "2k", 3], ["seedream_5_flash", "2k", 1], ["seedream_5_lite", "2k", 1], ["seedream_5_lite", "4k", 1],
  ["seedream_4_5", "2k", 1], ["seedream_4_5", "4k", 1], ["seedream_4", "1k", 1], ["seedream_4", "2k", 1], ["seedream_4", "4k", 1],
];

test("image credits match the table for every model and resolution", () => {
  for (const [id, res, want] of IMAGE_TABLE) assert.equal(imageCredits(getModelById(id), res), want, `${id} ${res ?? ""}`);
  // every priced resolution a model offers is in the table: nothing was left at a flat default
  for (const m of allImageModels()) for (const key of Object.keys(m.usd)) assert.ok(IMAGE_TABLE.some(([id, res]) => id === m.id && (res ?? "default") === key) || ["marketing_studio_image_flare", "marketing_studio_image_sunburst", "seedream_5_flash"].includes(m.id), `${m.id} ${key} has no row in the table`);
});

test("a render at 2k holds and charges the 2k price, not the 1k one (credits on)", () => {
  process.env.CREDITS_ENABLED = "1";
  const gpt = getModelById("gpt_image_2")!;
  assert.equal(chargeFor(gpt, "1k"), 20);
  assert.equal(chargeFor(gpt, "2k"), 50);
  assert.equal(chargeFor(gpt, undefined), 20, "no resolution sent: the model's default");
  assert.equal(chargeFor(getModelById("soul")!, "1080p"), 50);
  delete process.env.CREDITS_ENABLED;
  assert.equal(chargeFor(gpt, "2k"), null, "nothing is charged while credits are off");
});

test("Soul 2 and Soul Cinema: one credit for a batch of up to four images", () => {
  process.env.CREDITS_ENABLED = "1";
  for (const id of ["soul_v2", "soul_cinema"]) {
    const pub = toPublic(getModelById(id)!);
    assert.equal(pub.batch, 4);
    assert.equal(imageCost(pub, "720p", 4), 10, "a batch of 4 = 10 ledger units = 1 credit");
    assert.equal(imageCost(pub, "1080p", 1), 10);
    assert.equal(imageCost(pub, "720p", 5), 20);
  }
  const grok = toPublic(getModelById("grok_image_2")!);
  assert.equal(imageCost(grok, "2k", 3), 60, "other models: price x images");
  assert.equal(getModelById("gpt_image_1")!.enabled, false, "GPT Image 1 retires 2026-10-23");
});

// ---- video ----------------------------------------------------------------------------------------------------------------------------------------------------------
// [model, resolution, sound, credits for a 5 s clip] copied from the owner's table (brief section 8, "5 s clip with sound" column).
const VIDEO_TABLE: [string, string | undefined, boolean, number][] = [
  ["kling_3_std", undefined, true, 16], ["kling_3_pro", undefined, true, 21], ["kling_3_4k", undefined, true, 79], ["kling3_0_turbo", "720p", false, 14], ["kling3_0_turbo", "1080p", false, 18],
  ["kling2_6", undefined, true, 18], ["kling_2_5_turbo_pro", undefined, false, 9], ["kling_2_5_turbo_std", undefined, false, 6],
  ["seedance_2_0", "480p", false, 18], ["seedance_2_0", "720p", false, 38], ["seedance_2_0", "1080p", false, 86], ["seedance_2_0", "4k", false, 195],
  ["seedance_2_5", "480p", false, 26], ["seedance_2_5", "720p", false, 58], ["seedance_2_5", "1080p", false, 143],
  ["happy_horse_1_1", "720p", false, 18], ["happy_horse_1_1", "1080p", false, 23], ["happy_horse_video", "720p", false, 18], ["happy_horse_video", "1080p", false, 35],
  ["wan3_0", "480p", false, 7], ["wan3_0", "720p", false, 13], ["wan3_0", "1080p", false, 25], ["wan3_0_prime", "480p", false, 9], ["wan3_0_prime", "720p", false, 18], ["wan3_0_prime", "1080p", false, 35],
  ["wan2_7", "720p", false, 13], ["wan2_7", "1080p", false, 19], ["wan2_6", "720p", false, 13], ["wan2_6", "1080p", false, 19],
  ["minimax_h3", "2K", false, 17], ["minimax_hailuo", undefined, false, 7],
  ["ltx_2_5", "720p", false, 12], ["ltx_2_5", "1080p", false, 17], ["ltx_2_5", "2k", false, 24], ["ltx_2_5", "4k", false, 38], ["ltx_2_5_pro", "720p", false, 15], ["ltx_2_5_pro", "1080p", false, 22],
  ["grok_video_v15", "480p", false, 10], ["grok_video_v15", "720p", false, 18], ["grok_video_v15", "1080p", false, 32],
  ["cinematic_studio_video_4_0", "480p", false, 26], ["cinematic_studio_video_4_0", "720p", false, 58],
  ["pixverse_v6", "360p", false, 5], ["pixverse_v6", "540p", false, 6], ["pixverse_v6", "720p", false, 8], ["pixverse_v6", "1080p", false, 15],
  ["kling_mc_3_pro", undefined, false, 21], ["kling_mc_3_std", undefined, false, 16], ["kling_mc_26_pro", undefined, false, 21], ["kling_mc_26_std", undefined, false, 21],
  ["genjutsu_motion", "480p", false, 40], ["genjutsu_motion", "720p", false, 86], ["genjutsu_motion", "1080p", false, 204],
];

test("a 5 second clip costs what the table says for every model and resolution", () => {
  for (const [id, res, sound, want] of VIDEO_TABLE) {
    const m = videoModelById(id);
    assert.ok(m?.live, `${id} is connected`);
    assert.equal(videoCredits(m!, res, 5, sound), want, `${id} ${res ?? ""}${sound ? " sound" : ""}`);
    assert.equal(videoPrice(m!, res, 5, sound), want * 10, "the ledger unit is a tenth of a credit");
  }
});

test("video is rounded ONCE for the whole clip, never per second", () => {
  const std = videoModelById("kling_3_std")!;
  // 2.10 credits a second without sound: 3 s = 6.3 -> 7, not 3 x ceil(2.1) = 9
  assert.equal(videoCredits(std, undefined, 3, false), 7);
  assert.equal(videoCredits(std, undefined, 10, false), 21);
  // sound off costs less than sound on where the provider charges differently, and the same where it does not
  assert.ok(videoCredits(std, undefined, 5, false)! < videoCredits(std, undefined, 5, true)!);
  const seed = videoModelById("seedance_2_0")!;
  assert.equal(videoCredits(seed, "720p", 5, true), videoCredits(seed, "720p", 5, false));
  assert.equal(videoCredits(seed, "720p", 1, false), 8, "never below 1 credit, and 7.56 rounds up");
});

test("Seedance direct is cheaper and follows the route that is really used", () => {
  const s25 = videoModelById("seedance_2_5")!;
  assert.equal(videoCredits(s25, "720p", 5, false, "direct"), 29);
  assert.equal(videoPrice(s25, "720p", 5, false, "direct"), 290);
  assert.equal(videoCredits(s25, "720p", 5, false, "higgsfield"), 58);
  const s20 = videoModelById("seedance_2_0")!;
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s20, r, 5, false, "direct")), [9, 18, 39]);
  assert.equal(videoCredits(s20, "4k", 5, false, "direct"), 195, "4k stays on Higgsfield");
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s25, r, 5, false, "direct")), [14, 29, 72]);
});

// ---- routes ---------------------------------------------------------------------------------------------------------------------------------------------------------
test("a direct route is used only with the setting, the key AND an adapter; otherwise Higgsfield", async () => {
  assert.equal(routeFor("seedance_2_5"), "higgsfield");
  process.env.ROUTE_SEEDANCE_2_5 = "direct";
  assert.equal(routeFor("seedance_2_5"), "higgsfield", "no key, no adapter");
  process.env.ARK_API_KEY = "x";
  assert.equal(routeFor("seedance_2_5"), "higgsfield", "no adapter yet");
  registerDirectRoute("seedance_2_5");
  assert.equal(routeFor("seedance_2_5"), "direct");
  delete process.env.ARK_API_KEY;
  assert.equal(routeFor("seedance_2_5"), "higgsfield", "key missing again");
  // the image prices follow the route too
  const qwen = getModelById("qwen_image_3")!;
  assert.equal(imageCredits(qwen, "2k"), 2);
  assert.equal(imageCredits(qwen, "2k", "direct"), 1);
  process.env.ROUTE_QWEN_IMAGE_3 = "direct"; process.env.DASHSCOPE_API_KEY = "x"; registerDirectRoute("qwen_image_3");
  assert.equal(imageCredits(qwen, "2k"), 1, "default route is the one really used");
  assert.equal(imageCredits(getModelById("grok_image_2")!, "2k", "direct"), 1);
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

test("out-of-credits messages speak in credits", () => {
  assert.match(outOfCredits("Soul", 20, 5, 0, false, 0), /needs 2 credits\. You have 0\.5/);
  assert.match(outOfCredits("Soul", 20, 0, 0, true, 0), /used your free images/);
  assert.match(outOfCredits("Soul", 20, 5, 0, false, 1874), /187\.4 top-up credits/);
});

// ---- the owner's price check ----------------------------------------------------------------------------------------------------------------------------------------
test("every plan earns a margin above 40 percent on every row, and the estimates are flagged", () => {
  const rows = allPriceRows();
  assert.ok(rows.length > 100);
  for (const r of rows) for (const [plan, m] of Object.entries(r.margin)) assert.ok(m > 0.4, `${r.model} ${r.setting} on ${plan}: ${m}`);
  assert.deepEqual(plans.map((p) => Number(netPerCredit(p).toFixed(4))), [0.0876, 0.0761, 0.0745]);
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
