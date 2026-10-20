import test from "node:test";
import assert from "node:assert/strict";
import { linePrice, CUSTOM_MAX_CREDITS, CUSTOM_MIN_CREDITS, CUSTOM_PACK_ID, creditPacks, customPrice, productById } from "../../src/lib/plans";

test("a custom top-up starts at $9 of credits and ends at the biggest pack", () => {
  assert.ok(customPrice(CUSTOM_MIN_CREDITS)! >= 9 && customPrice(CUSTOM_MIN_CREDITS - 10)! < 9, "the smallest whole-credit amount that reaches $9");
  assert.equal(customPrice(CUSTOM_MIN_CREDITS - 1), null);
  assert.equal(customPrice(CUSTOM_MIN_CREDITS + 5), null, "whole credits only");
  assert.equal(customPrice(CUSTOM_MAX_CREDITS), creditPacks[creditPacks.length - 1].price);
  assert.equal(customPrice(CUSTOM_MAX_CREDITS + 1), null);
});

test("a custom amount costs exactly a pack's price at the pack's size, and never less per credit than a bigger pack", () => {
  for (const p of creditPacks) assert.equal(linePrice(p.credits), p.price); // the line passes through every pack
  for (const p of creditPacks.filter((q) => q.credits >= CUSTOM_MIN_CREDITS)) assert.equal(customPrice(p.credits), p.price);
  let prev = 0;
  for (let c = CUSTOM_MIN_CREDITS; c <= CUSTOM_MAX_CREDITS; c += 40) {
    const price = customPrice(c)!;
    assert.ok(price >= prev, "price never falls as credits rise");
    prev = price;
    const big = creditPacks.find((p) => p.credits >= c)!;
    assert.ok(price >= (big.price / big.credits) * c - 0.01, `${c} credits is not cheaper per credit than the ${big.credits} pack`);
  }
});

test("only whole numbers in range are accepted", () => {
  for (const bad of [1.5, "1000", NaN, null, undefined, -5, 0]) assert.equal(customPrice(bad), null);
  assert.equal(productById(CUSTOM_PACK_ID, 1000)?.credits, 1000);
  assert.equal(productById(CUSTOM_PACK_ID, 10), null);
  assert.equal(productById(CUSTOM_PACK_ID), null);
});
