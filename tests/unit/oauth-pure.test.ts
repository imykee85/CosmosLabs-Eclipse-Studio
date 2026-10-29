import test from "node:test";
import assert from "node:assert/strict";
import { redirectAllowed, redirectBack } from "../../src/lib/oauth";
import { safeNext } from "../../src/lib/safe-next";

test("return addresses: Claude, loopback and editor schemes only", () => {
  for (const ok of ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback", "http://localhost:6274/oauth/callback", "http://127.0.0.1:33418/callback", "cursor://anysphere.cursor-retrieval/oauth/user-x/callback"]) assert.equal(redirectAllowed(ok), true, ok);
  for (const no of ["https://evil.example/cb", "http://claude.ai/cb", "https://claude.ai.evil.example/cb", "https://claude.ai/cb#frag", "https://user:pw@claude.ai/cb", "javascript:alert(1)", "data:text/html,x", "ftp://claude.ai/x", "", "not a url", "http://localhost.evil.com/cb", 5 as unknown as string]) assert.equal(redirectAllowed(no), false, String(no));
  process.env.OAUTH_REDIRECT_HOSTS = "app.example.com";
  assert.equal(redirectAllowed("https://app.example.com/cb"), true);
  delete process.env.OAUTH_REDIRECT_HOSTS;
  assert.equal(redirectAllowed("https://app.example.com/cb"), false);
});

test("redirectBack keeps the app's own query and adds code and state", () => {
  assert.equal(redirectBack("https://claude.ai/cb?x=1", { code: "abc" }, "st"), "https://claude.ai/cb?x=1&code=abc&state=st");
  assert.equal(redirectBack("https://claude.ai/cb", { error: "access_denied" }, ""), "https://claude.ai/cb?error=access_denied");
});

test("sign-in may only return to the connection page", () => {
  assert.equal(safeNext("/oauth/authorize?client_id=ecc_x&state=1"), "/oauth/authorize?client_id=ecc_x&state=1");
  for (const no of ["//evil.com", "/dashboard", "https://evil.com/oauth/authorize?x", "/oauth/authorize", "/oauth/authorize?x=\\evil", "/oauth/authorize?x\n", null, undefined, "x".repeat(2100)]) assert.equal(safeNext(no as string), null, String(no));
});
