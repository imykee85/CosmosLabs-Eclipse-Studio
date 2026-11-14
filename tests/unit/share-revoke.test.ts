import test from "node:test";
import assert from "node:assert/strict";
import { shareToken, readShareToken, shareRevoked } from "../../src/lib/media-link";

process.env.CONNECT_SECRET_KEY = "test-secret-for-share-links";

test("a link made before Stop sharing no longer opens; a link made after does", async () => {
  const before = readShareToken(shareToken("gen1", 7))!;
  assert.ok(before && before.issuedAt > 0);
  const revokedAt = new Date(Date.now() + 5);
  await new Promise((r) => setTimeout(r, 12));
  const after = readShareToken(shareToken("gen1", 7))!;
  assert.equal(shareRevoked(before, revokedAt), true);
  assert.equal(shareRevoked(after, revokedAt), false);
  assert.equal(shareRevoked(before, null), false, "nothing revoked means every link opens");
});

test("a link without an issue time (made before this change) is cut off by any revocation", () => {
  assert.equal(shareRevoked({ issuedAt: 0 }, new Date()), true);
});

test("a tampered link is refused", () => {
  const t = shareToken("gen1", 7);
  assert.equal(readShareToken(t.slice(0, -2) + "xx"), null);
});
