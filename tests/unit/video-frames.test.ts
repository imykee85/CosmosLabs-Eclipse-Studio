import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frameAt, probeDuration, shrinkPicture, spacedTimes } from "../../src/lib/video-frames";

test("spaced moments sit in the middle of equal slices", () => {
  assert.deepEqual(spacedTimes(0, 8, 4), [1, 3, 5, 7]);
  assert.deepEqual(spacedTimes(2, 4, 2), [2.5, 3.5]);
});

test("ffmpeg reads the length of a video and a frame from it", async () => {
  // Needs the packaged ffmpeg (or FFMPEG_PATH); the test file is made with the same binary.
  const bin = process.env.FFMPEG_PATH || (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
  const dir = mkdtempSync(join(tmpdir(), "eclipse-vf-"));
  try {
    const file = join(dir, "t.mp4");
    execFileSync(bin, ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=3", "-pix_fmt", "yuv420p", file]);
    const d = await probeDuration(file);
    assert.ok(d !== null && Math.abs(d - 3) < 0.2, `duration ${d}`);
    const jpg = await frameAt(file, 1.5, 160);
    assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8); // a JPEG
    await assert.rejects(frameAt(join(dir, "missing.mp4"), 1, 160));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a picture over the size limit is redrawn as a smaller JPEG", async () => {
  const bin = process.env.FFMPEG_PATH || (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
  const dir = mkdtempSync(join(tmpdir(), "eclipse-vf-"));
  try {
    const png = join(dir, "big.png");
    execFileSync(bin, ["-v", "error", "-f", "lavfi", "-i", "mandelbrot=size=4000x3000", "-frames:v", "1", png]);
    const big = readFileSync(png);
    assert.ok(big.byteLength > 3_000_000, `test picture is ${big.byteLength} bytes`);
    const small = await shrinkPicture(new Uint8Array(big));
    assert.ok(small && small.byteLength < 3_000_000 && small[0] === 0xff && small[1] === 0xd8);
    assert.equal(await shrinkPicture(new Uint8Array([1, 2, 3])), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
