import test from "node:test";
import assert from "node:assert/strict";
import { buildVideoBody, videoModelById, type VideoInput } from "../../src/lib/video-models";

const base: VideoInput = { prompt: "", duration: 5, startUrl: "https://example.test/a.png", refVideoUrls: ["https://example.test/v.mp4"], keepSound: true };
test("scene control is sent as background_source for Kling 3.0 only", () => {
  const a = buildVideoBody(videoModelById("kling_mc_3_pro"), { ...base, background: "image" });
  assert.ok(a.ok && a.body.background_source === "input_image");
  const b = buildVideoBody(videoModelById("kling_mc_3_pro"), { ...base, background: "video" });
  assert.ok(b.ok && b.body.background_source === "input_video");
  const c = buildVideoBody(videoModelById("kling_mc_3_pro"), base);
  assert.ok(c.ok && !("background_source" in c.body));
});
