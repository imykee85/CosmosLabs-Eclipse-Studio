import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { checkFields, SendError } from "../../src/lib/connector-send";

test("each pasted-credential app checks its fields and never accepts another host", () => {
  assert.throws(() => checkFields("discord", { token: "https://evil.example/api/webhooks/1/abc" }), SendError);
  assert.throws(() => checkFields("discord", { token: "https://discord.com/other/1/abc" }), SendError);
  assert.equal(checkFields("discord", { token: "https://discord.com/api/webhooks/123456/abc-DEF_1" }).token, "https://discord.com/api/webhooks/123456/abc-DEF_1");
  assert.throws(() => checkFields("slack", { token: "https://hooks.slack.com.evil.io/services/x" }), SendError);
  assert.throws(() => checkFields("twilio", { sid: "AC123", token: "x", from: "+1", to: "+1" }), SendError);
  const tw = checkFields("twilio", { sid: "AC" + "a".repeat(32), token: "b".repeat(32), from: "+15551234567", to: "+15557654321" });
  assert.equal(tw.to, "+15557654321");
  assert.throws(() => checkFields("sendgrid", { token: "SG.x.y", from: "a@b.co", to: "c@d.co" }), SendError);
  assert.equal(checkFields("notion", { token: "ntn_" + "a".repeat(30), pageId: "https://www.notion.so/My-page-0123456789abcdef0123456789abcdef" }).pageId, "0123456789abcdef0123456789abcdef");
  assert.throws(() => checkFields("jira", { site: "evil.com", email: "a@b.co", token: "x".repeat(24), project: "CREA" }), SendError);
  assert.equal(checkFields("jira", { site: "https://team.atlassian.net/jira", email: "a@b.co", token: "x".repeat(24), project: "crea" }).site, "team.atlassian.net");
  assert.throws(() => checkFields("github", { token: "ghp_" + "a".repeat(30), repo: "../etc" }), SendError);
  assert.throws(() => checkFields("gmail", { token: "x" }), SendError, "apps that need a registered sign-in cannot be pasted");
});

// Discord and SendGrid against stand-ins for their hosts: the request shape (file upload, attachment) is what is checked.
const calls: { url: string; init: RequestInit }[] = [];
const real = globalThis.fetch;
before(() => { globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url: String(url), init }); return new Response('{"id":"1"}', { status: 200 }); }) as typeof fetch; });
after(() => { globalThis.fetch = real; });

test("Discord uploads the picture as a file; SendGrid attaches it", async () => {
  const { sendTo } = await import("../../src/lib/connector-send");
  await sendTo("discord", { token: "https://discord.com/api/webhooks/1/a" }, "hello", { url: "https://x/y.png", bytes: new Uint8Array([1, 2, 3]), type: "image/png", name: "a.png" });
  assert.equal(calls[0].url, "https://discord.com/api/webhooks/1/a?wait=true");
  assert.ok(calls[0].init.body instanceof FormData);
  await sendTo("sendgrid", { token: "SG.a.b", from: "a@b.co", to: "c@d.co" }, "Title line\nbody", { url: "https://x/y.png", bytes: new Uint8Array([1]), type: "image/png", name: "a.png" });
  const sg = JSON.parse(String(calls[1].init.body));
  assert.equal(calls[1].url, "https://api.sendgrid.com/v3/mail/send");
  assert.equal(sg.subject, "Title line");
  assert.equal(sg.attachments[0].filename, "a.png");
  await sendTo("github", { token: "ghp_x", repo: "o/r" }, "Remake the logo", { url: "u", link7: "https://seven/day" });
  assert.equal(calls[2].url, "https://api.github.com/repos/o/r/issues");
  assert.match(JSON.parse(String(calls[2].init.body)).body, /seven\/day/);
});
