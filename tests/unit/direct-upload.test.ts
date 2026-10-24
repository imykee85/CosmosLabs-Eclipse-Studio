import test from "node:test";
import assert from "node:assert/strict";
import { ownKey, planUpload } from "../../src/lib/direct-upload";

test("upload plans follow the limits: pictures 50 MB, videos 500 MB", () => {
  const MB = 1024 * 1024;
  assert.ok(planUpload({ fileKind: "image", contentType: "image/jpeg", size: 50 * MB }).ok);
  assert.ok(!planUpload({ fileKind: "image", contentType: "image/jpeg", size: 50 * MB + 1 }).ok);
  assert.ok(planUpload({ fileKind: "video", contentType: "video/quicktime", size: 500 * MB }).ok);
  assert.ok(!planUpload({ fileKind: "video", contentType: "video/mp4", size: 500 * MB + 1 }).ok);
  assert.ok(planUpload({ fileKind: "video", contentType: "video/x-matroska", size: MB }).ok);
  assert.ok(planUpload({ fileKind: "image", contentType: "image/gif", size: MB }).ok); // any picture format is accepted and converted when finished
  assert.ok(!planUpload({ fileKind: "document" as "image", contentType: "application/pdf", size: MB }).ok);
  assert.ok(!planUpload({ fileKind: "image", contentType: "image/png", size: 0 }).ok);
});

test("a person can only finish a file under their own folder with our file-name pattern", () => {
  const id = "0b9e8f3a-1111-4222-8333-444455556666";
  assert.ok(ownKey("user_1", `u/user_1/up-${id}.png`, "image"));
  assert.ok(ownKey("user_1", `u/user_1/vid-${id}.mp4`, "video"));
  assert.ok(!ownKey("user_2", `u/user_1/up-${id}.png`, "image"));
  assert.ok(!ownKey("user_1", `u/user_1/vid-${id}.mp4`, "image"));
  assert.ok(!ownKey("user_1", `u/user_1/../user_2/up-${id}.png`, "image"));
  assert.ok(!ownKey("user_1", `u/user_1/up-${id}.exe`, "image"));
  assert.ok(!ownKey("user_1", 42, "image"));
});
