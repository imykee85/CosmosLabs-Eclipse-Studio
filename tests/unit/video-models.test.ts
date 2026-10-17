import { test } from "node:test";
import assert from "node:assert/strict";
import { PICKER_MODELS, VIDEO_MODELS, buildVideoBody, capsFor, isLive, videoModelById, videoPrice, type VideoInput } from "../../src/lib/video-models";

const live = VIDEO_MODELS.filter(isLive);

test("every live text-to-video model builds a valid request from its own defaults", () => {
  let checked = 0;
  for (const m of live) {
    if (m.live.motion || !m.live.endpoints.t2v) continue;
    const caps = capsFor(m, "t2v");
    const input: VideoInput = { prompt: "a fox runs through snow", duration: caps.defaultDuration };
    if (caps.qualities.length) input.resolution = caps.defaultQuality;
    if (caps.ratios.length) input.aspectRatio = caps.defaultRatio;
    const r = buildVideoBody(m, input);
    assert.equal(r.ok, true, `${m.id}: ${r.ok ? "" : r.error}`);
    if (r.ok) {
      assert.equal(r.workflow, "t2v");
      assert.ok(r.endpoint.length > 0, m.id);
      assert.equal(r.body.prompt, "a fox runs through snow", m.id);
      assert.ok(!Object.values(r.body).includes(undefined), `${m.id} sends an undefined field`);
    }
    checked++;
  }
  assert.ok(checked >= 10, `only ${checked} models were checked`);
});

test("a duration the model cannot make is an error, never a silent change", () => {
  const m = videoModelById("kling_3_pro");
  assert.equal(buildVideoBody(m, { prompt: "x", duration: 999 }).ok, false);
});

test("prices are whole credits for live models and null for the rest", () => {
  for (const m of live) {
    if (m.live.motion) continue;
    const caps = capsFor(m, "t2v");
    const p = videoPrice(m, caps.qualities.length ? caps.defaultQuality : undefined, caps.defaultDuration, !!caps.audio);
    assert.ok(p != null && Number.isInteger(p) && p >= 1, `${m.id}: ${p}`);
  }
  const soon = VIDEO_MODELS.find((m) => !m.live);
  if (soon) assert.equal(videoPrice(soon, undefined, 5, false), null);
});

test("motion engines stay out of the model picker", () => {
  assert.ok(PICKER_MODELS.every((m) => !m.hidden));
  assert.ok(VIDEO_MODELS.filter((m) => m.hidden).length >= 5);
});

test("Kling motion transfer sends the picture, the clip and the orientation, and never a duration", () => {
  const m = videoModelById("kling_mc_3_pro");
  const base: VideoInput = { prompt: "", duration: 5, startUrl: "https://example.test/a.png", refVideoUrls: ["https://example.test/v.mp4"], keepSound: true };
  const a = buildVideoBody(m, { ...base, orientation: "video" });
  assert.equal(a.ok, true);
  if (a.ok) {
    assert.equal(a.body.image_url, "https://example.test/a.png");
    assert.equal(a.body.video_url, "https://example.test/v.mp4");
    assert.equal(a.body.keep_original_sound, "yes");
    assert.equal(a.body.character_orientation, "video");
    assert.ok(!("duration" in a.body));
  }
  const b = buildVideoBody(m, { ...base, orientation: "image", keepSound: false });
  if (b.ok) { assert.equal(b.body.character_orientation, "image"); assert.equal(b.body.keep_original_sound, "no"); } else assert.fail(b.error);
});

test("motion transfer needs both the picture and one clip", () => {
  const m = videoModelById("kling_mc_3_pro");
  assert.equal(buildVideoBody(m, { prompt: "", duration: 5, startUrl: "https://example.test/a.png" }).ok, false);
  assert.equal(buildVideoBody(m, { prompt: "", duration: 5, refVideoUrls: ["https://example.test/v.mp4"] }).ok, false);
  assert.equal(buildVideoBody(m, { prompt: "", duration: 5, startUrl: "https://example.test/a.png", refVideoUrls: ["https://example.test/1.mp4", "https://example.test/2.mp4"] }).ok, false);
});

test("Genjutsu motion transfer sends the picture as a list", () => {
  const m = videoModelById("genjutsu_motion");
  const r = buildVideoBody(m, { prompt: "", duration: 5, resolution: "720p", startUrl: "https://example.test/a.png", refVideoUrls: ["https://example.test/v.mp4"] });
  assert.equal(r.ok, true);
  if (r.ok) { assert.deepEqual(r.body.image_urls, ["https://example.test/a.png"]); assert.equal(r.body.video_url, "https://example.test/v.mp4"); }
});

test("reference sounds go to Seedance reference-to-video as audio_urls", async () => {
  const { buildVideoBody, capsFor, findVideoModel } = await import("../../src/lib/video-models");
  const s25 = findVideoModel("seedance_2_5")!, s20 = findVideoModel("seedance_2_0")!, kling = findVideoModel("kling_3_pro")!;
  assert.equal(capsFor(s25, "ref").refAudioMax, 10);
  assert.equal(capsFor(s20, "ref").refAudioMax, 3);
  assert.equal(capsFor(kling, "t2v").refAudioMax, 0);
  const ok = buildVideoBody(s25, { prompt: "dance to it", duration: 5, refAudioUrls: ["https://x/a.mp3"] });
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.workflow, "ref"); assert.deepEqual(ok.body.audio_urls, ["https://x/a.mp3"]); }
  const alone20 = buildVideoBody(s20, { prompt: "x", duration: 5, refAudioUrls: ["https://x/a.mp3"] });
  assert.equal(alone20.ok, false, "Seedance 2.0 needs a picture or clip with the sound");
  const with20 = buildVideoBody(s20, { prompt: "x", duration: 5, refUrls: ["https://x/p.png"], refAudioUrls: ["https://x/a.mp3"] });
  assert.equal(with20.ok, true);
  assert.equal(buildVideoBody(kling, { prompt: "x", duration: 5, refAudioUrls: ["https://x/a.mp3"] }).ok, false);
});

test("Kling 3.0 multi-shot: shots in order, their sum is the length", async () => {
  const { buildVideoBody, capsFor, findVideoModel } = await import("../../src/lib/video-models");
  const k = findVideoModel("kling_3_pro")!;
  assert.equal(capsFor(k, "t2v").multiShot?.max, 6);
  const shots = [{ prompt: "wide street", duration: 3 }, { prompt: "close on her face", duration: 4 }];
  const ok = buildVideoBody(k, { prompt: "a rainy night", duration: 7, shots });
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.body.multi_shots, true); assert.deepEqual(ok.body.multi_prompt, shots); assert.equal(ok.body.duration, 7); }
  assert.equal(buildVideoBody(k, { prompt: "x", duration: 6, shots }).ok, false, "length must equal the sum");
  assert.equal(buildVideoBody(k, { prompt: "x", duration: 20, shots: [{ prompt: "a", duration: 10 }, { prompt: "b", duration: 10 }] }).ok, false, "over 15 s");
  assert.equal(buildVideoBody(k, { prompt: "x", duration: 3, shots: [{ prompt: "", duration: 3 }] }).ok, false);
  assert.equal(buildVideoBody(findVideoModel("seedance_2_5")!, { prompt: "x", duration: 5, shots: [{ prompt: "a", duration: 5 }] }).ok, false, "only Kling 3.0");
});
