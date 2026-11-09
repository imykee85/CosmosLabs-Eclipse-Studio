import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frameAt, framesInOnePass, probeVideo, readFrames, spacedTimes } from "../../src/lib/video-frames";
import { sniffVideo } from "../../src/lib/direct-upload";

// Atlas (and Core, and the upload check) must read any video someone gives them: every common container, and videos from phone editors (CapCut, InShot)
// whose keyframes are far apart. The files are made with the same ffmpeg the app uses.
const bin = () => process.env.FFMPEG_PATH || (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
const make = (file: string, args: string[]) => execFileSync(bin(), ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=25:duration=3", ...args, file]);

const CONTAINERS: [string, string[]][] = [
  ["mp4", ["-c:v", "libx264", "-pix_fmt", "yuv420p"]],
  ["mov", ["-c:v", "libx264", "-pix_fmt", "yuv420p"]],
  ["3gp", ["-c:v", "mpeg4"]],
  ["mkv", ["-c:v", "libx264", "-pix_fmt", "yuv420p"]],
  ["webm", ["-c:v", "libvpx-vp9", "-deadline", "realtime"]],
  ["avi", ["-c:v", "mpeg4"]],
  ["ts", ["-c:v", "libx264", "-pix_fmt", "yuv420p"]],
  ["mpg", ["-c:v", "mpeg2video"]],
  ["flv", ["-c:v", "flv"]],
  ["wmv", ["-c:v", "wmv2"]],
  ["ogv", ["-c:v", "libtheora"]],
];

test("every common video container is accepted at upload and read frame by frame", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-any-"));
  try {
    for (const [ext, args] of CONTAINERS) {
      const file = join(dir, `clip.${ext}`);
      make(file, args);
      assert.ok(sniffVideo(new Uint8Array(readFileSync(file).subarray(0, 512))), `${ext} is recognised as a video`);
      const info = await probeVideo(file);
      assert.ok(info && info.duration > 2 && info.width === 320, `${ext} probes (${JSON.stringify(info)})`);
      const frames = await readFrames(file, spacedTimes(0, info!.duration, 4), 160);
      assert.equal(frames.length, 4, `${ext}: four frames`);
      for (const f of frames) assert.ok(f.b[0] === 0xff && f.b[1] === 0xd8, `${ext}: JPEG frames`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a phone-edited video with a single keyframe is read in one pass, and the frames are the right ones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-gop-"));
  try {
    const file = join(dir, "capcut-like.mp4");
    execFileSync(bin(), ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=12", "-c:v", "libx264", "-g", "100000", "-keyint_min", "100000", "-sc_threshold", "0", "-pix_fmt", "yuv420p", file]);
    const times = spacedTimes(0, 12, 8);
    const one = await framesInOnePass(file, times, 320);
    assert.equal(one.length, 8);
    assert.deepEqual(one.map((f) => f.t), times, "labelled with the moments asked for, in order");
    // The same moments read by separate jumps give exactly the same pictures.
    const same = await Promise.all(one.map(async (f) => (await frameAt(file, f.t, 320, 4, 60_000)).equals(f.b)));
    assert.equal(same.filter(Boolean).length, 8, `${same.filter(Boolean).length} of 8 identical`);
    const all = await readFrames(file, times, 320);
    assert.equal(all.length, 8);
    // a window in the middle
    const mid = await framesInOnePass(file, spacedTimes(4, 8, 4), 320);
    assert.equal(mid.length, 4);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a cover picture embedded by an editor is skipped: frames come from the video itself", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eclipse-cover-"));
  try {
    const video = join(dir, "v.mp4"), cover = join(dir, "c.jpg"), withCover = join(dir, "vc.mp4");
    make(video, ["-c:v", "libx264", "-pix_fmt", "yuv420p"]);
    execFileSync(bin(), ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:size=320x180", "-frames:v", "1", cover]);
    execFileSync(bin(), ["-v", "error", "-y", "-i", cover, "-i", video, "-map", "0", "-map", "1", "-c", "copy", "-disposition:v:0", "attached_pic", withCover]);
    const plain = await frameAt(video, 1.5, 160);
    const fromCover = await frameAt(withCover, 1.5, 160);
    assert.ok(plain.equals(fromCover), "same frame as the file without a cover");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("only binary video containers pass the upload check: playlists and other files do not", () => {
  const bytes = (s: string) => new Uint8Array(Buffer.from(s));
  assert.equal(sniffVideo(bytes("#EXTM3U\n#EXT-X-VERSION:3\nhttps://example.com/a.ts\n")), false);
  assert.equal(sniffVideo(bytes("ffconcat version 1.0\nfile 'https://example.com/a.mp4'\n")), false);
  assert.equal(sniffVideo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])), false); // PNG
  assert.equal(sniffVideo(new Uint8Array(600)), false);
  // QuickTime files from phone apps may start with a wide box before the media data
  assert.equal(sniffVideo(new Uint8Array([0, 0, 0, 8, 0x77, 0x69, 0x64, 0x65, 0, 0, 0, 0])), true);
});
