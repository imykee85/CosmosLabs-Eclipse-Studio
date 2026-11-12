import test from "node:test";
import assert from "node:assert/strict";
import { emailConfigured, emailOwner } from "../../src/lib/email";

const realFetch = globalThis.fetch;
const env = { ...process.env };
const reset = () => { globalThis.fetch = realFetch; process.env = { ...env }; };

test("nothing is sent without the key and a valid address", async () => {
  delete process.env.RESEND_API_KEY; delete process.env.ALERT_EMAIL;
  let calls = 0; globalThis.fetch = (async () => { calls++; return new Response("{}"); }) as typeof fetch;
  assert.equal(emailConfigured(), false); assert.equal(await emailOwner("s", "t"), false);
  process.env.RESEND_API_KEY = "re_x"; process.env.ALERT_EMAIL = "not an address";
  assert.equal(emailConfigured(), false); assert.equal(await emailOwner("s", "t"), false);
  process.env.ALERT_EMAIL = "a@b.com, c@d.com";
  assert.equal(emailConfigured(), false, "one address only");
  assert.equal(calls, 0); reset();
});

test("one request to Resend with the key, the owner as the only recipient, and no throw on failure", async () => {
  process.env.RESEND_API_KEY = "re_test"; process.env.ALERT_EMAIL = "owner@example.com";
  let seen: { url: string; auth: string | null; body: { to: string[]; subject: string; from: string } } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) }; return new Response("{}", { status: 200 }); }) as typeof fetch;
  assert.equal(await emailOwner("New sign-up", "hello"), true);
  assert.equal(seen!.url, "https://api.resend.com/emails"); assert.equal(seen!.auth, "Bearer re_test");
  assert.deepEqual(seen!.body.to, ["owner@example.com"]); assert.equal(seen!.body.subject, "New sign-up");
  globalThis.fetch = (async () => { throw new Error("network"); }) as typeof fetch;
  assert.equal(await emailOwner("s", "t"), false);
  globalThis.fetch = (async () => new Response("no", { status: 403 })) as typeof fetch;
  assert.equal(await emailOwner("s", "t"), false); reset();
});
