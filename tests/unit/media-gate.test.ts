import test from "node:test";
import assert from "node:assert/strict";
import { gatedMediaPath, mediaCookieLeft, mediaCookieNeedsRenewal, mediaCookieValue, mediaGateOn, MEDIA_TTL } from "../../src/lib/media-gate";

test("a fresh media cookie is valid for the full time and is not renewed", () => {
  const now = Date.now(), v = mediaCookieValue(now);
  assert.equal(mediaCookieLeft(v, now), MEDIA_TTL);
  assert.equal(mediaCookieNeedsRenewal(v, now), false);
});

test("an old, altered or missing cookie gives nothing", () => {
  const now = Date.now(), v = mediaCookieValue(now);
  assert.equal(mediaCookieLeft(v, now + (MEDIA_TTL + 5) * 1000), 0);
  assert.equal(mediaCookieNeedsRenewal(v, now + (MEDIA_TTL - 60) * 1000), true);
  const [exp, tag] = v.split(".");
  assert.equal(mediaCookieLeft(`${Number(exp) + 99999}.${tag}`, now), 0);
  assert.equal(mediaCookieLeft(`${exp}.${tag.slice(1)}x`, now), 0);
  assert.equal(mediaCookieLeft("1", now), 0);
  assert.equal(mediaCookieLeft(undefined, now), 0);
});

test("only the homepage media folders are gated", () => {
  for (const p of ["/landing/a.mp4", "/hero/hero.jpg", "/carousel/card-2.mp4"]) assert.equal(gatedMediaPath(p), true, p);
  for (const p of ["/dashboard/x.mp4", "/api/generations", "/", "/landingpage", "/icons/icon-192.png"]) assert.equal(gatedMediaPath(p), false, p);
});

test("the switch: off wins, on wins, unset follows preview builds", () => {
  const keep = { g: process.env.MEDIA_GATE, v: process.env.VERCEL_ENV };
  try {
    process.env.MEDIA_GATE = "off"; process.env.VERCEL_ENV = "preview"; assert.equal(mediaGateOn(), false);
    process.env.MEDIA_GATE = "on"; process.env.VERCEL_ENV = "production"; assert.equal(mediaGateOn(), true);
    delete process.env.MEDIA_GATE; process.env.VERCEL_ENV = "preview"; assert.equal(mediaGateOn(), true);
    process.env.VERCEL_ENV = "production"; assert.equal(mediaGateOn(), false);
  } finally { for (const [k, v] of [["MEDIA_GATE", keep.g], ["VERCEL_ENV", keep.v]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
