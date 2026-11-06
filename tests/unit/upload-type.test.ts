import { test } from "node:test";
import assert from "node:assert/strict";
import { videoUploadType } from "../../src/lib/upload-type";

test("a real video type is kept", () => {
  assert.equal(videoUploadType({ name: "a.mp4", type: "video/mp4" }), "video/mp4");
  assert.equal(videoUploadType({ name: "IMG_0001.MOV", type: "video/quicktime" }), "video/quicktime");
});

test("a missing or generic type is worked out from the file name", () => {
  assert.equal(videoUploadType({ name: "clip.MKV", type: "" }), "video/x-matroska");
  assert.equal(videoUploadType({ name: "clip.avi", type: "application/octet-stream" }), "video/x-msvideo");
  assert.equal(videoUploadType({ name: "clip.mov", type: "application/octet-stream" }), "video/quicktime");
  assert.equal(videoUploadType({ name: "old.3gp", type: "" }), "video/3gpp");
});

test("an unknown extension keeps the browser's type", () => {
  assert.equal(videoUploadType({ name: "clip.xyz", type: "" }), "");
});
