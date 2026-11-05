import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress } from "../../src/lib/fetch-page";
test("embedded IPv4 in IPv6 is judged by the IPv4 part", () => {
  for (const ip of ["::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:127.0.0.1", "::7f00:1", "64:ff9b::a00:1", "2002:7f00:1::", "fec0::1"]) assert.equal(isPrivateAddress(ip), true, ip);
  assert.equal(isPrivateAddress("::ffff:808:808"), false);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});
