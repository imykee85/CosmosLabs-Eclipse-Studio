import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { fmtCredits, toLedger, toCredits, LEDGER_UNITS_PER_CREDIT } from "../../src/lib/credit-units";
import { allImageModels, chargeFor, getModelById, imageCredits, toPublic } from "../../src/lib/models";
import { imageCost } from "../../src/lib/image-render";
import { VIDEO_MODELS, videoCredits, videoPrice, videoModelById } from "../../src/lib/video-models";
import { CUSTOM_PACK_ID, creditPacks, plans, productById } from "../../src/lib/plans";
import { BEST_VALUE_PACK_ID, KLING_YARDSTICK_CREDITS, planSaving, planValue } from "../../src/lib/plan-copy";
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
test("plans and packs grant what the brief says (ledger units) and show whole credits", () => {
  assert.deepEqual(plans.map((p) => [p.id, p.price, p.credits, p.seats]), [["starter", 19, 2000, 1], ["growth", 49, 6000, 3], ["scale", 199, 25000, 10]]);
  assert.deepEqual(plans.map((p) => fmtCredits(p.credits)), ["200", "600", "2,500"]);
  assert.deepEqual(creditPacks.map((p) => [p.id, p.price, p.credits, p.name]), [["topup_500", 6, 500, "50 credits"], ["topup_2000", 22, 2000, "200 credits"], ["topup_6000", 60, 6000, "600 credits"]]);
  assert.equal(productById("growth")?.credits, 6000);
  assert.equal(productById("topup_6000")?.price, 60);
  assert.equal(productById(CUSTOM_PACK_ID, 1000)?.name, "100 credits");
});

test("plan cards: what the credits buy and the saving against Starter", () => {
  assert.deepEqual(plans.map(planValue), ["≈ 200 images or 12 Kling videos", "≈ 600 images or 37 Kling videos", "≈ 2,500 images or 156 Kling videos"]);
  assert.deepEqual(plans.map(planSaving), [0, 14, 16]);
  assert.equal(KLING_YARDSTICK_CREDITS, 16, "Kling 3.0 Pro, 5 s, sound on (checked against the price table in batch 3)");
  assert.equal(BEST_VALUE_PACK_ID, creditPacks[creditPacks.length - 1].id, "the biggest pack is Best value");
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
// [model, resolution, 5 s clip credits, 4 s clip credits] copied from the master brief section 5 ("sound on" columns; models without a separate sound price are the same).
const VIDEO_TABLE: [string, string | undefined, number, number][] = [
  ["kling_3_std", undefined, 12, 10], ["kling_3_pro", undefined, 16, 13], ["kling_3_4k", undefined, 57, 46], ["kling3_0_turbo", "720p", 11, 9], ["kling3_0_turbo", "1080p", 13, 11],
  ["kling2_6", undefined, 13, 11], ["kling_2_5_turbo_pro", undefined, 7, 6], ["kling_2_5_turbo_std", undefined, 4, 4],
  ["seedance_2_0", "480p", 13, 11], ["seedance_2_0", "720p", 28, 22], ["seedance_2_0", "1080p", 62, 49], ["seedance_2_0", "4k", 140, 112],
  ["seedance_2_5", "480p", 19, 15], ["seedance_2_5", "720p", 42, 34], ["seedance_2_5", "1080p", 103, 82],
  ["happy_horse_1_1", "720p", 13, 11], ["happy_horse_1_1", "1080p", 17, 13], ["happy_horse_video", "720p", 13, 11], ["happy_horse_video", "1080p", 26, 21],
  ["wan3_0", "480p", 5, 4], ["wan3_0", "720p", 9, 8], ["wan3_0", "1080p", 18, 15], ["wan3_0_prime", "480p", 7, 5], ["wan3_0_prime", "720p", 13, 11], ["wan3_0_prime", "1080p", 26, 21],
  ["wan2_7", "720p", 9, 8], ["wan2_7", "1080p", 14, 11], ["wan2_6", "720p", 9, 8], ["wan2_6", "1080p", 14, 11],
  ["minimax_h3", "2K", 12, 10], ["minimax_hailuo", undefined, 6, 5],
  ["ltx_2_5", "720p", 9, 7], ["ltx_2_5", "1080p", 12, 10], ["ltx_2_5", "2k", 18, 14], ["ltx_2_5", "4k", 27, 22], ["ltx_2_5_pro", "720p", 11, 9], ["ltx_2_5_pro", "1080p", 16, 13],
  ["grok_video_v15", "480p", 8, 6], ["grok_video_v15", "720p", 13, 11], ["grok_video_v15", "1080p", 23, 18],
  ["cinematic_studio_video_4_0", "480p", 19, 15], ["cinematic_studio_video_4_0", "720p", 42, 34],
  ["pixverse_v6", "360p", 4, 3], ["pixverse_v6", "540p", 5, 4], ["pixverse_v6", "720p", 6, 5], ["pixverse_v6", "1080p", 11, 9],
  ["kling_mc_3_pro", undefined, 16, 13], ["kling_mc_3_std", undefined, 12, 10], ["kling_mc_26_pro", undefined, 16, 13], ["kling_mc_26_std", undefined, 16, 13],
  ["genjutsu_motion", "480p", 29, 23], ["genjutsu_motion", "720p", 62, 50], ["genjutsu_motion", "1080p", 147, 118],
];

test("5 s and 4 s clips cost what the master brief table says for every model and resolution (1.8x)", () => {
  for (const [id, res, five, four] of VIDEO_TABLE) {
    const m = videoModelById(id);
    assert.ok(m?.live, `${id} is connected`);
    assert.equal(videoCredits(m!, res, 5, true), five, `${id} ${res ?? ""} 5 s`);
    assert.equal(videoCredits(m!, res, 4, true), four, `${id} ${res ?? ""} 4 s`);
    assert.equal(videoPrice(m!, res, 5, true), five * 10, "the ledger unit is a tenth of a credit");
  }
});

test("the video markup and credit value come from VIDEO_MARGIN and VIDEO_CREDIT_USD", () => {
  const m = videoModelById("kling_3_pro")!;
  assert.equal(videoCredits(m, undefined, 5, true), 16);
  process.env.VIDEO_MARGIN = "2.5"; process.env.VIDEO_CREDIT_USD = "0.10";
  try { assert.equal(videoCredits(m, undefined, 5, true), 21); } finally { delete process.env.VIDEO_MARGIN; delete process.env.VIDEO_CREDIT_USD; }
});

test("video is rounded ONCE for the whole clip, never per second", () => {
  const std = videoModelById("kling_3_std")!;
  // 0.084 x 1.8 / 0.10 = 1.512 credits a second without sound: 3 s = 4.536 -> 5, not 3 x ceil(1.512) = 6
  assert.equal(videoCredits(std, undefined, 3, false), 5);
  assert.equal(videoCredits(std, undefined, 10, false), 16);
  assert.ok(videoCredits(std, undefined, 5, false)! < videoCredits(std, undefined, 5, true)!);
  const seed = videoModelById("seedance_2_0")!;
  assert.equal(videoCredits(seed, "720p", 5, true), videoCredits(seed, "720p", 5, false));
  assert.equal(videoCredits(seed, "720p", 1, false), 6, "5.44 rounds up");
});

test("Seedance clips can be 4 s: the minimum comes from the model settings", () => {
  for (const id of ["seedance_2_0", "seedance_2_5"]) for (const wf of ["t2v", "i2v"] as const) assert.equal(videoModelById(id)!.live!.durations[wf].min, 4, `${id} ${wf}`);
});

test("Seedance direct is cheaper and follows the route that is really used", () => {
  const s25 = videoModelById("seedance_2_5")!;
  assert.equal(videoCredits(s25, "720p", 5, false, "direct"), 21);
  assert.equal(videoPrice(s25, "720p", 5, false, "direct"), 210);
  assert.equal(videoCredits(s25, "1080p", 4, false, "direct"), 41);
  assert.equal(videoPrice(s25, "1080p", 4, false, "direct"), 410);
  assert.equal(videoCredits(s25, "720p", 5, false, "higgsfield"), 42);
  const s20 = videoModelById("seedance_2_0")!;
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s20, r, 5, false, "direct")), [6, 13, 28]);
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s20, r, 4, false, "direct")), [5, 10, 23]);
  assert.equal(videoCredits(s20, "4k", 5, false, "direct"), 140, "4k stays on Higgsfield");
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s25, r, 5, false, "direct")), [10, 21, 52]);
  assert.deepEqual(["480p", "720p", "1080p"].map((r) => videoCredits(s25, r, 4, false, "direct")), [8, 17, 41]);
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
test("every plan earns the margin floor on every row (20% video, 40% the rest), and the estimates are flagged", () => {
  const rows = allPriceRows();
  assert.ok(rows.length > 100);
  for (const r of rows) for (const [plan, m] of Object.entries(r.margin)) assert.ok(m > (r.kind === "video" ? 0.2 : 0.4), `${r.model} ${r.setting} on ${plan}: ${m}`);
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
