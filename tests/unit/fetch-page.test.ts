import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, htmlToText, isPrivateAddress } from "../../src/lib/fetch-page";

test("private and internal addresses are refused", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
  for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest", "http://localhost:3000", "file:///etc/passwd", "ftp://x.com", "https://a:b@x.com", "http://8.8.8.8:8080/", "http://[::1]/"]) await assert.rejects(() => assertPublicUrl(u), u);
  assert.equal((await assertPublicUrl("https://8.8.8.8/x")).hostname, "8.8.8.8");
});

test("html becomes readable text", () => {
  const { title, text } = htmlToText("<html><head><title>Brief &amp; plan</title><style>p{}</style><script>alert(1)</script></head><body><h1>Launch</h1><p>For runners&nbsp;aged 25&#8211;35.</p><!-- x --></body></html>");
  assert.equal(title, "Brief & plan");
  assert.match(text, /Launch\nFor runners aged 25–35\./);
  assert.doesNotMatch(text, /alert|p\{\}/);
});
