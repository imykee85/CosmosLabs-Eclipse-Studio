import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { AUTO_MONTHLY_CAPS, AUTO_THRESHOLDS, creditPacks, plans, productById } from "../../src/lib/plans";
import { refsFrom } from "../../src/lib/payments/whop";
import { USER_TABLES } from "../../src/lib/account-delete";

test("a payment is for a plan or a top-up pack, and nothing else", () => {
  assert.equal(productById("starter")?.kind, "plan");
  assert.equal(productById("topup_500")?.kind, "pack");
  assert.equal(productById("topup_500")?.credits, 400);
  assert.equal(productById("nope"), null);
  assert.equal(productById(undefined), null);
  const ids = [...plans.map((p) => p.id), ...creditPacks.map((p) => p.id)];
  assert.equal(new Set(ids).size, ids.length, "plan and pack ids are unique");
});

test("top-up packs cost more per credit than the Growth and Scale plans, but stay within about twice Growth (emergency use, not a rip-off)", () => {
  const rate = (x: { price: number; credits: number }) => x.price / x.credits;
  const growth = rate(plans.find((p) => p.id === "growth")!);
  const scale = rate(plans.find((p) => p.id === "scale")!);
  for (const pack of creditPacks) {
    assert.ok(rate(pack) > growth && rate(pack) > scale, `${pack.id} is dearer per credit than Growth and Scale`);
    assert.ok(rate(pack) <= growth * 2.1, `${pack.id} is not far above the Growth rate`);
  }
});

test("the auto top-up choices are small whole-number lists", () => {
  assert.ok(AUTO_THRESHOLDS.every((n) => Number.isInteger(n) && n > 0));
  assert.ok(AUTO_MONTHLY_CAPS.every((n) => Number.isInteger(n) && n > 0));
});

test("saved-card references are read from ids or objects, whichever the provider sends", () => {
  assert.deepEqual(refsFrom({ member: { id: "mem_1" }, payment_method: { id: "pm_1" }, membership: { id: "ms_1" } }), { memberId: "mem_1", paymentMethodId: "pm_1", membershipId: "ms_1" });
  assert.deepEqual(refsFrom({ member_id: "mem_2", payment_method_id: "pm_2" }), { memberId: "mem_2", paymentMethodId: "pm_2", membershipId: undefined });
  assert.equal(refsFrom({ id: "pay_1" }), undefined);
  assert.equal(refsFrom({ member: 5, payment_method: "" }), undefined);
});

test("deleting an account covers every table that holds a user_id", () => {
  const covered = new Set(USER_TABLES.map((t) => t.toLowerCase()));
  const missing = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "userId"))
    .map((m) => m.name)
    .filter((name) => !covered.has(name.toLowerCase()));
  assert.deepEqual(missing, [], `account deletion would leave rows behind in: ${missing.join(", ")}`);
});
