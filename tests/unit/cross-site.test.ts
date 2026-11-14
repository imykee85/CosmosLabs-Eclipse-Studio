import test from "node:test";
import assert from "node:assert/strict";
import { crossSiteWrite } from "../../src/lib/cross-site";

const H = "eclipse.cosmoslabsai.com";
test("a write from another site is refused; the same site, no Origin and exempt paths pass", () => {
  assert.equal(crossSiteWrite("POST", "/api/generate", "https://evil.example", H), true);
  assert.equal(crossSiteWrite("DELETE", "/api/projects/x", "https://eclipse.cosmoslabsai.com.evil.example", H), true);
  assert.equal(crossSiteWrite("POST", "/api/generate", "null", H), true);
  assert.equal(crossSiteWrite("POST", "/api/generate", `https://${H}`, H), false);
  assert.equal(crossSiteWrite("POST", "/api/generate", null, H), false, "no Origin: a server call, not a browser");
  assert.equal(crossSiteWrite("GET", "/api/generations", "https://evil.example", H), false, "reads are not writes");
  assert.equal(crossSiteWrite("POST", "/dashboard", "https://evil.example", H), false, "pages are not API routes");
  for (const p of ["/api/payments/webhook", "/api/webhooks/clerk", "/api/mcp", "/oauth/token", "/api/cron/finalize-renders", "/api/plans/abc/continue", "/api/agent/missions/abc/continue"]) assert.equal(crossSiteWrite("POST", p, "https://other.example", H), false, p);
});
