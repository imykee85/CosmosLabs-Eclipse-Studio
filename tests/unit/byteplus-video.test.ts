import test from "node:test";
import assert from "node:assert/strict";
import { arkVideoBody, hasArkVideo, isArkUrl } from "../../src/lib/providers/byteplus-video";

test("text-to-video: one text item, the chosen ratio, watermark off", () => {
  const b = arkVideoBody("seedance_2_5", "t2v", { prompt: " a cat ", duration: 8, resolution: "720p", aspect_ratio: "9:16", generate_audio: true });
  assert.equal(b.model, "dreamina-seedance-2-5-260628");
  assert.deepEqual(b.content, [{ type: "text", text: "a cat" }]);
  assert.equal(b.ratio, "9:16"); assert.equal(b.duration, 8); assert.equal(b.resolution, "720p"); assert.equal(b.generate_audio, true); assert.equal(b.watermark, false);
  assert.equal("omni_reference_task_type" in b, false);
});

test("start and end frame get their roles and the ratio follows the picture", () => {
  const b = arkVideoBody("seedance_2_5", "i2v", { prompt: "x", duration: 5, image_url: "https://a/1.png", end_image_url: "https://a/2.png", aspect_ratio: "16:9" });
  assert.deepEqual(b.content, [{ type: "text", text: "x" }, { type: "image_url", image_url: { url: "https://a/1.png" }, role: "first_frame" }, { type: "image_url", image_url: { url: "https://a/2.png" }, role: "last_frame" }]);
  assert.equal(b.ratio, "adaptive");
});

test("references keep their order and roles, and 2.5 is told it is a reference task", () => {
  const b = arkVideoBody("seedance_2_5", "ref", { prompt: "see @Image1", duration: 10, image_urls: ["https://a/i1.png", "https://a/i2.png"], video_urls: ["https://a/v1.mp4"], audio_urls: ["https://a/a1.mp3"], aspect_ratio: "1:1" });
  const roles = (b.content as { role?: string }[]).map((c) => c.role ?? "text");
  assert.deepEqual(roles, ["text", "reference_image", "reference_image", "reference_video", "reference_audio"]);
  assert.equal(b.omni_reference_task_type, "reference"); assert.equal(b.ratio, "1:1");
});

test("edit keeps the clip's length and shape; extend asks for the extension length", () => {
  const e = arkVideoBody("seedance_2_5", "edit", { prompt: "remove the crowd", video_url: "https://a/s.mp4", resolution: "480p", generate_audio: false });
  assert.equal(e.duration, -1); assert.equal(e.ratio, "adaptive"); assert.equal(e.omni_reference_task_type, "edit");
  assert.deepEqual((e.content as { role?: string }[]).map((c) => c.role ?? "text"), ["text", "reference_video"]);
  const x = arkVideoBody("seedance_2_5", "extend", { prompt: "and then", video_url: "https://a/s.mp4", duration: 8, image_urls: ["https://a/i.png"] });
  assert.equal(x.duration, 8); assert.equal(x.ratio, "adaptive"); assert.equal(x.omni_reference_task_type, "extend");
  assert.deepEqual((x.content as { role?: string }[]).map((c) => c.role ?? "text"), ["text", "reference_video", "reference_image"]);
});

test("Seedance 2.0 uses its own id and never gets the 2.5-only task field", () => {
  const b = arkVideoBody("seedance_2_0", "ref", { prompt: "x", duration: 5, image_urls: ["https://a/i.png"], aspect_ratio: "16:9" });
  assert.equal(b.model, "dreamina-seedance-2-0-260128"); assert.equal("omni_reference_task_type" in b, false);
});

test("only Seedance has a direct video route; the address check compares the host", () => {
  assert.equal(hasArkVideo("seedance_2_5"), true); assert.equal(hasArkVideo("kling3"), false);
  assert.equal(isArkUrl("https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/cgt-1"), true);
  assert.equal(isArkUrl("https://platform.higgsfield.ai/requests/1/status"), false);
});
