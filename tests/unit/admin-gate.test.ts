import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_SESSION_MS, adminPasswordSet, passwordMatches, signAdminCookie, verifyAdminCookie } from "../../src/lib/admin-gate";

const env = { ...process.env };
test.afterEach(() => { process.env = { ...env }; });

test("a cookie works for the account it was made for, and only until it expires", () => {
  const t = 1_000_000;
  const c = signAdminCookie("user_owner", t);
  assert.equal(verifyAdminCookie(c, t + 1000), "user_owner");
  assert.equal(verifyAdminCookie(c, t + ADMIN_SESSION_MS + 1), null, "expired");
});

test("a changed, swapped, shortened or empty cookie is refused", () => {
  const t = Date.now();
  const [id, exp, sig] = signAdminCookie("user_owner", t).split(".");
  assert.equal(verifyAdminCookie(`user_other.${exp}.${sig}`, t), null, "another account");
  assert.equal(verifyAdminCookie(`${id}.${Number(exp) + 99999}.${sig}`, t), null, "later expiry");
  assert.equal(verifyAdminCookie(`${id}.${exp}.${sig.slice(0, -2)}`, t), null, "shorter signature");
  assert.equal(verifyAdminCookie(`${id}.${exp}`, t), null);
  assert.equal(verifyAdminCookie("", t), null); assert.equal(verifyAdminCookie(undefined, t), null); assert.equal(verifyAdminCookie("a.b.c.d", t), null);
});

test("the password: unset or too short means no lock; the right one passes and others fail", () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(adminPasswordSet(), false); assert.equal(passwordMatches("anything"), false);
  process.env.ADMIN_PASSWORD = "short"; assert.equal(adminPasswordSet(), false); assert.equal(passwordMatches("short"), false);
  process.env.ADMIN_PASSWORD = "correct horse battery";
  assert.equal(adminPasswordSet(), true);
  assert.equal(passwordMatches("correct horse battery"), true);
  assert.equal(passwordMatches("correct horse batter"), false); assert.equal(passwordMatches(""), false);
  assert.equal(passwordMatches(undefined as unknown as string), false);
});
