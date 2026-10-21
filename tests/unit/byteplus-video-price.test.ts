import test from "node:test";
import assert from "node:assert/strict";
import { videoCreditsWithVideo, videoModelById } from "../../src/lib/video-models";
import { videoCreditsForUsd } from "../../src/lib/price-constants";

// BytePlus' own price tables (pricing page, 16:9, 5 s output, USD per video); the lowest figure is the minimum billing (2 to 4 s input), the highest the longest input.
const s25 = videoModelById("seedance_2_5")!;
const s20 = videoModelById("seedance_2_0")!;
const rows: [typeof s25, string, number, number, number][] = [
  [s25, "480p", 3, 0.553, 0.553], [s25, "480p", 30, 2.152, 2.152],
  [s25, "720p", 3, 1.244, 1.244], [s25, "720p", 30, 4.838, 4.838],
  [s25, "1080p", 3, 3.062, 3.062], [s25, "1080p", 30, 11.907, 11.907],
  [s20, "480p", 3, 0.39, 0.39], [s20, "480p", 15, 0.86, 0.86],
  [s20, "720p", 3, 0.84, 0.84], [s20, "720p", 15, 1.86, 1.86],
  [s20, "1080p", 3, 2.06, 2.06], [s20, "1080p", 15, 4.57, 4.57],
  [s20, "4k", 3, 4.2, 4.2], [s20, "4k", 15, 9.33, 9.33],
];
test("the token formula reproduces BytePlus' with-video price tables (within a credit)", () => {
  for (const [m, res, inSec, usd] of rows.map((r) => [r[0], r[1], r[2], r[3]] as const)) {
    const got = videoCreditsWithVideo(m, res, 5, inSec)!;
    const want = videoCreditsForUsd(usd);
    assert.ok(Math.abs(got - want) <= 1, `${m.id} ${res} ${inSec}s input: got ${got}, table says ${want}`);
  }
});

test("a short input is billed at the minimum, a long one by its length, and more input costs more", () => {
  const c = (inSec: number) => videoCreditsWithVideo(s25, "720p", 5, inSec)!;
  assert.equal(c(1), c(4), "2 to 4 s of input costs the same minimum");
  assert.ok(c(10) > c(4) && c(30) > c(10));
  assert.equal(videoCreditsWithVideo(s25, "4k", 5, 5), null, "2.5 has no 4k price");
  assert.equal(videoCreditsWithVideo(videoModelById("kling3")!, "720p", 5, 5), null, "only Seedance has a direct video price");
});
