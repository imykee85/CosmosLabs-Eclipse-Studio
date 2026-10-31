import test from "node:test";
import assert from "node:assert/strict";
import { priceList } from "../../src/components/landing/price-list";
import { getModelById, imageCredits } from "../../src/lib/models";
import { videoModelById } from "../../src/lib/video-models";
import { videoMargin, videoCreditUsd } from "../../src/lib/price-constants";

const find = (group: string, label: string) => priceList.find((g) => g.name === group)!.lines.find((l) => l.label === label)!.price;
const d = (n: number, unit: string) => `$${n.toFixed(2)} / ${unit}`;
const imageUsd = (id: string, res: string) => imageCredits(getModelById(id)!, res)! * 0.1;

test("price list: Seedance 2.5 at the provider's own per-second cost", () => {
  const p = videoModelById("seedance_2_5").live!.price.directUsd!;
  assert.equal(find("Seedance 2.5", "480p"), d(p["480p"], "second"));
  assert.equal(find("Seedance 2.5", "720p"), d(p["720p"], "second"));
  assert.equal(find("Seedance 2.5", "1080p"), d(p["1080p"], "second"));
});

test("price list: Kling 3.0 at the maker's cost per second (no sound)", () => {
  const per = (id: string) => videoModelById(id).live!.price.usd.default * videoMargin();
  assert.equal(find("Kling 3.0", "Standard"), d(per("kling_3_std"), "second"));
  assert.equal(find("Kling 3.0", "Pro"), d(per("kling_3_pro"), "second"));
  assert.equal(videoCreditUsd(), 0.1);
  assert.equal(videoMargin(), 1); // video is charged at cost
});

test("price list: images at the maker's cost rounded up to the cent (credits x $0.10)", () => {
  assert.equal(find("Nano Banana Pro", "1K and 2K"), d(imageUsd("nano_banana_pro", "1k"), "image"));
  assert.equal(imageUsd("nano_banana_pro", "1k"), imageUsd("nano_banana_pro", "2k"));
  assert.equal(find("Nano Banana Pro", "4K"), d(imageUsd("nano_banana_pro", "4k"), "image"));
  assert.equal(find("GPT Image 2.5", "1K"), d(imageUsd("gpt_image_2_5_sunburst", "1k"), "image"));
  assert.equal(find("GPT Image 2.5", "2K"), d(imageUsd("gpt_image_2_5_sunburst", "2k"), "image"));
  assert.equal(find("Seedream 5.0 Pro", "1K"), d(imageUsd("seedream_5_pro", "1k"), "image"));
  assert.equal(find("Seedream 5.0 Pro", "2K"), d(imageUsd("seedream_5_pro", "2k"), "image"));
});
