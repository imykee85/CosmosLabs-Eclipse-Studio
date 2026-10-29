// "Sign in with Eclipse" for the MCP endpoint, end to end against a throwaway Postgres: discovery, registration, the authorization request checks, the code and token exchange with PKCE,
// refresh rotation and reuse detection, revocation, and the MCP endpoint accepting (and refusing) tokens.
// Run: DATABASE_URL=postgresql://postgres@localhost:5444/jobs npm run test:integration
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const U = "user_oauth_a", V = "user_oauth_b";
const ORIGIN = "http://x";
const CB = "https://claude.ai/api/mcp/auth_callback";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any; let clientId = "";
const verifier = () => randomBytes(48).toString("base64url");
const challenge = (v: string) => createHash("sha256").update(v).digest("base64url");

before(async () => {
  if (skip) return;
  lib = {
    oauth: await import("../../src/lib/oauth"), db: (await import("../../src/lib/db")).db, mcp: await import("../../src/app/api/mcp/route"),
    token: await import("../../src/app/oauth/token/route"), register: await import("../../src/app/oauth/register/route"), revoke: await import("../../src/app/oauth/revoke/route"),
    as: await import("../../src/app/.well-known/oauth-authorization-server/route"), pr: await import("../../src/app/.well-known/oauth-protected-resource/[[...path]]/route"),
    approve: await import("../../src/app/api/oauth/approve/route"),
  };
  await clean();
  for (const u of [U, V]) await lib.db.billingSettings.upsert({ where: { userId: u }, create: { userId: u, planOverride: "starter" }, update: { planOverride: "starter" } });
  const reg = await lib.register.POST(new Request(`${ORIGIN}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [CB] }) }));
  clientId = (await reg.json()).client_id;
});
after(async () => { if (skip) return; await clean(); await lib.db.$disconnect(); });
const clean = async () => {
  for (const u of [U, V]) { await lib.db.oauthGrant.deleteMany({ where: { userId: u } }); await lib.db.oauthCode.deleteMany({ where: { userId: u } }); await lib.db.billingSettings.deleteMany({ where: { userId: u } }); await lib.db.usageEvent.deleteMany({ where: { userId: u } }).catch(() => {}); }
  await lib.db.oauthClient.deleteMany({ where: { name: "Claude" } });
};
const form = (path: string, p: Record<string, string>) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(p).toString() });
const tokenReq = (p: Record<string, string>) => lib.token.POST(form("/oauth/token", p));
const mcp = (token: string | null, method = "tools/list") => lib.mcp.POST(new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }) }));
const req0 = (v: string, extra: Record<string, string> = {}) => ({ client_id: clientId, redirect_uri: CB, response_type: "code", code_challenge: challenge(v), code_challenge_method: "S256", state: "st1", ...extra });
async function connect(user = U) {
  const v = verifier();
  const check = await lib.oauth.checkAuthRequest(req0(v), ORIGIN);
  assert.equal(check.ok, true);
  const code = await lib.oauth.issueCode(user, check.req);
  const r = await tokenReq({ grant_type: "authorization_code", code, redirect_uri: CB, client_id: clientId, code_verifier: v });
  return { v, code, r, body: await r.json() };
}

test("discovery documents point at Eclipse's own endpoints and ask for PKCE S256", { skip }, async () => {
  const m = await (await lib.as.GET(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`))).json();
  assert.equal(m.issuer, ORIGIN); assert.equal(m.token_endpoint, `${ORIGIN}/oauth/token`); assert.equal(m.registration_endpoint, `${ORIGIN}/oauth/register`);
  assert.deepEqual(m.code_challenge_methods_supported, ["S256"]); assert.deepEqual(m.token_endpoint_auth_methods_supported, ["none"]);
  const r = await (await lib.pr.GET(new Request(`${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`))).json();
  assert.equal(r.resource, `${ORIGIN}/api/mcp`); assert.deepEqual(r.authorization_servers, [ORIGIN]);
  assert.equal((await lib.as.OPTIONS()).status, 204);
});

test("registration accepts Claude and loopback addresses and refuses everything else", { skip }, async () => {
  const post = (b: unknown) => lib.register.POST(new Request(`${ORIGIN}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
  const ok = await post({ client_name: "Claude", redirect_uris: ["http://localhost:6274/cb"] });
  assert.equal(ok.status, 201); const j = await ok.json(); assert.match(j.client_id, /^ecc_/); assert.equal(j.token_endpoint_auth_method, "none");
  for (const bad of [{ redirect_uris: ["https://evil.example/cb"] }, { redirect_uris: [] }, { client_name: "x" }, { redirect_uris: ["https://claude.ai/a#f"] }]) { const r = await post(bad); assert.equal(r.status, 400); assert.equal((await r.json()).error, "invalid_redirect_uri"); }
});

test("the authorization request: a bad app or return address is shown, other problems go back to the app", { skip }, async () => {
  const v = verifier();
  const unknown = await lib.oauth.checkAuthRequest({ ...req0(v), client_id: "ecc_nope" }, ORIGIN);
  assert.equal(unknown.ok, false); assert.equal(unknown.kind, "page");
  const wrongUri = await lib.oauth.checkAuthRequest({ ...req0(v), redirect_uri: "https://claude.ai/other" }, ORIGIN);
  assert.equal(wrongUri.kind, "page");
  const evil = await lib.oauth.checkAuthRequest({ ...req0(v), redirect_uri: "https://evil.example/cb" }, ORIGIN);
  assert.equal(evil.kind, "page");
  for (const [mut, err] of [[{ response_type: "token" }, "unsupported_response_type"], [{ code_challenge: "" }, "invalid_request"], [{ code_challenge_method: "plain" }, "invalid_request"], [{ resource: "https://other.example/api/mcp" }, "invalid_target"]] as const) {
    const c = await lib.oauth.checkAuthRequest({ ...req0(v), ...mut }, ORIGIN);
    assert.equal(c.ok, false); assert.equal(c.kind, "redirect"); assert.equal(c.error, err); assert.equal(c.redirectUri, CB); assert.equal(c.state, "st1");
  }
  assert.equal((await lib.oauth.checkAuthRequest({ ...req0(v), resource: `${ORIGIN}/api/mcp` }, ORIGIN)).ok, true);
});

test("a full connection: code, token, the MCP works with it, refresh rotates, the old refresh token is dead", { skip }, async () => {
  const c = await connect();
  assert.equal(c.r.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.token_type, "Bearer"); assert.equal(c.body.expires_in, 3600); assert.match(c.body.access_token, /^eca_/); assert.match(c.body.refresh_token, /^ecr_/);
  assert.equal(c.r.headers.get("cache-control"), "no-store");
  const list = await (await mcp(c.body.access_token)).json();
  assert.ok(list.result.tools.some((t: { name: string }) => t.name === "generate_image"));
  const r2 = await (await tokenReq({ grant_type: "refresh_token", refresh_token: c.body.refresh_token, client_id: clientId })).json();
  assert.match(r2.access_token, /^eca_/); assert.notEqual(r2.access_token, c.body.access_token); assert.notEqual(r2.refresh_token, c.body.refresh_token);
  assert.equal((await mcp(c.body.access_token)).status, 401, "the old access token stopped working");
  assert.equal((await mcp(r2.access_token)).status, 200);
  // the replaced refresh token is shown again: the whole grant is closed
  const reuse = await tokenReq({ grant_type: "refresh_token", refresh_token: c.body.refresh_token, client_id: clientId });
  assert.equal(reuse.status, 400); assert.equal((await reuse.json()).error, "invalid_grant");
  assert.equal((await mcp(r2.access_token)).status, 401, "reuse revoked the grant");
});

test("the code is one-time, bound to the app, the address and the verifier, and replaying it revokes what it made", { skip }, async () => {
  const c = await connect();
  assert.equal(c.r.status, 200);
  const replay = await tokenReq({ grant_type: "authorization_code", code: c.code, redirect_uri: CB, client_id: clientId, code_verifier: c.v });
  assert.equal(replay.status, 400); assert.equal((await replay.json()).error, "invalid_grant");
  assert.equal((await mcp(c.body.access_token)).status, 401, "the token made from a replayed code is revoked");
  // wrong verifier, wrong redirect, wrong client, expired
  const v = verifier(); const check = await lib.oauth.checkAuthRequest(req0(v), ORIGIN);
  const code = await lib.oauth.issueCode(U, check.req);
  const base = { grant_type: "authorization_code", code, redirect_uri: CB, client_id: clientId };
  assert.equal((await tokenReq({ ...base, code_verifier: verifier() })).status, 400);
  assert.equal((await tokenReq({ ...base, redirect_uri: "https://claude.ai/other", code_verifier: v })).status, 400);
  assert.equal((await tokenReq({ ...base, code_verifier: "short" })).status, 400);
  assert.equal((await tokenReq({ ...base, client_id: "ecc_unknownunknownunknownunknown", code_verifier: v })).status, 401);
  const code2 = await lib.oauth.issueCode(U, check.req);
  await lib.db.oauthCode.updateMany({ where: { userId: U, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await tokenReq({ ...base, code: code2, code_verifier: v })).status, 400);
  assert.equal((await tokenReq({ grant_type: "password" })).status, 401, "no client");
  assert.equal((await tokenReq({ grant_type: "password", client_id: clientId })).status, 400);
});

test("only a hash of the code and the tokens is stored", { skip }, async () => {
  const c = await connect();
  const g = await lib.db.oauthGrant.findFirst({ where: { userId: U }, orderBy: { createdAt: "desc" } });
  assert.notEqual(g.accessHash, c.body.access_token); assert.notEqual(g.refreshHash, c.body.refresh_token);
  assert.equal(g.accessHash, createHash("sha256").update(c.body.access_token).digest("hex"));
  assert.equal(await lib.db.oauthCode.findUnique({ where: { hash: c.code } }), null, "the plain code is not a key in the table");
});

test("the MCP endpoint tells a client where to sign in, and refuses expired, wrong and unpaid tokens", { skip }, async () => {
  const none = await mcp(null);
  assert.equal(none.status, 401); assert.match(none.headers.get("www-authenticate"), /resource_metadata="http:\/\/x\/\.well-known\/oauth-protected-resource"/);
  const bad = await mcp("eca_" + "A".repeat(40));
  assert.equal(bad.status, 401); assert.match(bad.headers.get("www-authenticate"), /error="invalid_token"/);
  const c = await connect();
  await lib.db.oauthGrant.updateMany({ where: { userId: U, revokedAt: null }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await mcp(c.body.access_token)).status, 401, "an expired access token");
  const d = await connect(V);
  await lib.db.billingSettings.update({ where: { userId: V }, data: { planOverride: "free" } });
  assert.equal((await mcp(d.body.access_token)).status, 402, "a person whose plan lapsed");
  await lib.db.billingSettings.update({ where: { userId: V }, data: { planOverride: "starter" } });
  assert.equal((await mcp(d.body.access_token)).status, 200, "it works again after subscribing");
});

test("revoking ends the connection, from the app and from Settings, and only the owner can disconnect", { skip }, async () => {
  const c = await connect();
  assert.equal((await lib.revoke.POST(form("/oauth/revoke", { token: c.body.access_token, client_id: clientId }))).status, 200);
  assert.equal((await mcp(c.body.access_token)).status, 401);
  assert.equal((await tokenReq({ grant_type: "refresh_token", refresh_token: c.body.refresh_token, client_id: clientId })).status, 400);
  assert.equal((await lib.revoke.POST(form("/oauth/revoke", { token: "ecr_unknown", client_id: clientId }))).status, 200, "an unknown token is not an error");
  const d = await connect(); const grants = await lib.oauth.listGrants(U);
  const mine = grants.find((g: { id: string }) => true);
  assert.ok(mine); assert.equal(mine.name, "Claude");
  assert.equal(await lib.oauth.revokeGrant(V, mine.id), false, "another person cannot disconnect it");
  assert.equal(await lib.oauth.revokeGrant(U, mine.id), true);
  assert.equal(await lib.oauth.revokeGrant(U, mine.id), false);
  void d;
});

test("API keys still work next to tokens, and the approve route refuses a request that is not from our own page", { skip }, async () => {
  const k = await (await import("../../src/lib/api-keys")).createKey(U, "k");
  assert.equal(k.ok, true);
  assert.equal((await mcp((k as { key: string }).key)).status, 200);
  await lib.db.apiKey.deleteMany({ where: { userId: U } });
  const noOrigin = await lib.approve.POST(new Request(`${ORIGIN}/api/oauth/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  assert.equal(noOrigin.status, 403);
  const otherOrigin = await lib.approve.POST(new Request(`${ORIGIN}/api/oauth/approve`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" }));
  assert.equal(otherOrigin.status, 403);
});
