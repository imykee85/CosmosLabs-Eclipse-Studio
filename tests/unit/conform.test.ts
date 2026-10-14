import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conformImage, conformVideoFile, cropBox, ratioString, targetOf } from "../../src/lib/conform";
import { readImageSize } from "../../src/lib/image-info";
import { probeVideo } from "../../src/lib/video-frames";

const bin = () => process.env.FFMPEG_PATH || (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;

test("the crop is centred, trims only the difference and leaves matching pictures alone", () => {
  // 3:2 picture to 1:1: keep the full height, trim the sides evenly.
  assert.deepEqual(cropBox(1536, 1024, { w: 1, h: 1 }), { w: 1024, h: 1024, x: 256, y: 0 });
  // 16:9 to 9:16
  const b = cropBox(1920, 1080, { w: 9, h: 16 })!;
  assert.equal(b.h, 1080); assert.ok(Math.abs(b.w / b.h - 9 / 16) < 0.004);
  // already the right ratio (within 0.4%): nothing to do
  assert.equal(cropBox(1536, 1024, { w: 3, h: 2 }), null);
  assert.equal(cropBox(1920, 1080, { w: 1921, h: 1080 }), null);
  // video sizes stay even
  const v = cropBox(1280, 720, { w: 1000, h: 1000 }, true)!;
  assert.ok(v.w % 2 === 0 && v.h % 2 === 0);
});

test("the target is read from the saved params and written as a reduced ratio", () => {
  assert.deepEqual(targetOf({ conform: { w: 1500, h: 1000 } }), { w: 1500, h: 1000 });
  assert.equal(targetOf({ workflow: "t2v" }), null);
  assert.equal(targetOf(null), null);
  assert.equal(ratioString({ w: 1500, h: 1000 }), "3:2");
  assert.equal(ratioString({ w: 1080, h: 1350 }), "4:5");
});

test("a picture in another ratio comes out in the reference's ratio", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-conform-"));
  try {
    const png = join(dir, "a.png");
    execFileSync(bin(), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=1536x1024:rate=1:duration=1", "-frames:v", "1", png]);
    const bytes = new Uint8Array(readFileSync(png));
    const r = await conformImage(bytes, "image/png", { w: 4, h: 5 });
    assert.ok(r && r !== "ok");
    const size = readImageSize((r as { bytes: Uint8Array }).bytes)!;
    assert.ok(Math.abs(size.width / size.height - 4 / 5) < 0.004, `${size.width}x${size.height}`);
    assert.equal(size.height, 1024); // the full height is kept, only the sides were trimmed
    assert.equal(await conformImage(bytes, "image/png", { w: 3, h: 2 }), "ok");
    assert.equal(await conformImage(new Uint8Array([1, 2, 3]), "image/png", { w: 1, h: 1 }), null); // not a picture: the caller keeps the original
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a clip in another ratio is trimmed to the reference's ratio and keeps its length", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-conform-"));
  try {
    const src = join(dir, "in.mp4"), dest = join(dir, "out.mp4");
    execFileSync(bin(), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest", "-pix_fmt", "yuv420p", src]);
    assert.equal(await conformVideoFile(src, dest, { w: 9, h: 16 }), true);
    const out = await probeVideo(dest);
    assert.ok(out && Math.abs(out.width / out.height - 9 / 16) < 0.01, `${out?.width}x${out?.height}`);
    assert.equal(out!.height, 360);
    assert.ok(Math.abs(out!.duration - 2) < 0.3 && out!.hasAudio);
    assert.equal(await conformVideoFile(src, join(dir, "same.mp4"), { w: 16, h: 9 }), "ok");
    assert.equal(await conformVideoFile(join(dir, "missing.mp4"), join(dir, "x.mp4"), { w: 1, h: 1 }), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
