import test from "node:test";
import assert from "node:assert/strict";
import { replayLedger, type ExpiryRules, type LedgerRow } from "../../src/lib/expiry";

const DAY = 86400000;
const T0 = Date.parse("2026-11-01T00:00:00Z");
const at = (days: number) => new Date(T0 + days * DAY);
let n = 0;
const row = (days: number, delta: number, note: string | null, reason?: string, externalId: string | null = null): LedgerRow => ({ id: `r${String(++n).padStart(4, "0")}`, delta, reason: reason ?? (delta > 0 ? "PURCHASE" : "CHARGE"), note, externalId, createdAt: at(days) });
const rules: ExpiryRules = { start: T0 - 100 * DAY, planDays: 33, topupDays: 90, graceDays: 7 }; // the rule has been on a long time
const left = (rows: LedgerRow[], days: number, r = rules) => replayLedger(rows, r, T0 + days * DAY);
const sum = (g: { remaining: number }[]) => g.reduce((a, x) => a + x.remaining, 0);

test("nothing expires until CREDIT_EXPIRY_START is set", () => {
  const rows = [row(0, 2000, "Plan: Starter"), row(0, 500, "Top-up: 50 credits")];
  const res = left(rows, 400, { ...rules, start: null });
  assert.equal(res.expiredUnswept, 0);
  assert.equal(res.topup, 500);
  assert.equal(res.next, null);
});

test("plan credits expire at the end of the period that granted them", () => {
  const rows = [row(0, 2000, "Plan: Starter")];
  assert.equal(left(rows, 32).expiredUnswept, 0);
  assert.equal(left(rows, 34).expiredUnswept, 2000);
  assert.equal(left(rows, 20).next?.amount, 2000);
});

test("the next plan payment removes what is left of the previous one (no rollover)", () => {
  const rows = [row(0, 2000, "Plan: Starter"), row(5, -500, null), row(30, 2000, "Plan: Starter")];
  const res = left(rows, 31);
  assert.equal(res.expiredUnswept, 1500, "the 1500 left from the first month are gone at renewal");
  assert.equal(sum(res.grants.filter((g) => g.expiresAt > T0 + 31 * DAY)), 2000);
});

test("a top-up credit is alive on day 89 and gone on day 91", () => {
  const rows = [row(0, 500, "Top-up: 50 credits")];
  assert.equal(left(rows, 89).topup, 500);
  assert.equal(left(rows, 89).expiredUnswept, 0);
  assert.equal(left(rows, 91).topup, 0);
  assert.equal(left(rows, 91).expiredUnswept, 500);
});

test("spend order: plan credits first, then credits that never expire, then top-ups oldest first", () => {
  const rows = [
    row(0, 500, "Top-up: 50 credits"), row(1, 300, "Top-up: 50 credits"), row(2, 400, "Added by the owner", "GRANT"), row(3, 2000, "Plan: Starter"),
    row(4, -2100, "spend"), // 2000 plan + 100 owner credit
  ];
  const res = left(rows, 5);
  const by = (note: string) => res.grants.filter((g) => g.amount === Number(note));
  assert.equal(by("2000")[0].remaining, 0);
  assert.equal(by("400")[0].remaining, 300, "owner credit pays after the plan");
  assert.equal(by("500")[0].remaining, 500, "top-ups untouched");
  const more = left([...rows, row(5, -800, "spend")], 6);
  const g = (amount: number) => more.grants.find((x) => x.amount === amount)!;
  assert.equal(g(400).remaining, 0);
  assert.equal(g(500).remaining, 0 + 0 + (500 - 500), "oldest top-up pays next");
  assert.equal(g(300).remaining, 300);
  assert.equal(more.topup, 300);
});

test("an expired credit is never spent: a charge after the date takes the next grant", () => {
  const rows = [row(0, 500, "Top-up: 50 credits"), row(60, 400, "Top-up: 40 credits"), row(95, -100, "spend")];
  const res = left(rows, 96);
  assert.equal(res.expiredUnswept, 500, "the first top-up ran out at day 90");
  assert.equal(res.grants.find((g) => g.amount === 400)!.remaining, 300, "the charge came out of the live top-up");
});

test("an EXPIRE row removes its grant, and the replay does not count it twice", () => {
  const first = row(0, 2000, "Plan: Starter");
  const rows = [first, row(34, -2000, "Plan credits expired", "EXPIRE", `expire:${first.id}`)];
  const res = left(rows, 40);
  assert.equal(res.expiredUnswept, 0);
  assert.equal(sum(res.grants), 0);
});

test("balances from before the start date get a grace instead of an instant wipe; old top-ups get 90 days from the start", () => {
  const start = T0 + 10 * DAY;
  const r2: ExpiryRules = { ...rules, start };
  const rows = [row(-200, 1000, "Plan: Starter"), row(-5, 2000, "Plan: Starter"), row(-300, 500, "Top-up: 50 credits")];
  assert.equal(replayLedger(rows, r2, start + 1 * DAY).expiredUnswept, 0, "nothing is gone on the first day");
  const week = replayLedger(rows, r2, start + 7 * DAY + 1000);
  assert.equal(week.expiredUnswept, 1000, "the older plan grant is gone after the 7 day grace; the latest payment keeps its natural period end (day 28)");
  assert.equal(replayLedger(rows, r2, T0 + 29 * DAY).expiredUnswept, 3000, "and then that one ends too");
  assert.equal(week.topup, 500, "the old top-up lives until start + 90 days");
  assert.equal(replayLedger(rows, r2, start + 91 * DAY).topup, 0);
});
