import test from "node:test";
import assert from "node:assert/strict";
import { buildCsp, cspHeaders, cspMode, newNonce, wantsCsp } from "../../src/lib/csp";

test("the nonce is fresh and well formed every time", () => {
  const a = newNonce(), b = newNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});

test("the policy trusts only nonce'd scripts and what they load", () => {
  const csp = buildCsp("abc==");
  const script = csp.split("; ").find((d) => d.startsWith("script-src "))!;
  assert.ok(script.includes("'nonce-abc=='") && script.includes("'strict-dynamic'"));
  assert.ok(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'") && csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("report-uri /api/csp-report"));
  assert.ok(!/script-src[^;]*\*[^.]/.test(script.replace(/https:\/\/\*\./g, "")), "no bare wildcard in script-src");
});

test("report mode never blocks, enforce mode does", () => {
  assert.equal(cspHeaders("n==", "report")[0].name, "Content-Security-Policy-Report-Only");
  assert.equal(cspHeaders("n==", "enforce")[0].name, "Content-Security-Policy");
  const old = process.env.CSP_MODE;
  delete process.env.CSP_MODE;
  assert.equal(cspMode(), "report");
  process.env.CSP_MODE = "enforce";
  assert.equal(cspMode(), "enforce");
  if (old === undefined) delete process.env.CSP_MODE; else process.env.CSP_MODE = old;
});

test("pages get the policy; API routes, share links and the tool frame do not", () => {
  assert.equal(wantsCsp("/"), true);
  assert.equal(wantsCsp("/dashboard"), true);
  assert.equal(wantsCsp("/api/generate"), false);
  assert.equal(wantsCsp("/api/core/tools/abc/frame"), false);
  assert.equal(wantsCsp("/s/token"), false);
});
