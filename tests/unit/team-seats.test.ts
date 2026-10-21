import test from "node:test";
import assert from "node:assert/strict";
import { seatsFor, syncTeamSeats, type SeatClient } from "../../src/lib/team-seats";

const fake = () => { const calls: [string, number][] = []; const c: SeatClient = { setMaxMembers: async (o, m) => { calls.push([o, m]); } }; return { c, calls }; };

test("a plan's seats are 1, 3 and 10", () => {
  assert.deepEqual(["starter", "growth", "scale"].map(seatsFor), [1, 3, 10]);
  assert.equal(seatsFor("topup_500"), null);
});

test("a plan payment on a team sets that team's member limit", async () => {
  const { c, calls } = fake();
  assert.equal(await syncTeamSeats("org_abc", "growth", c), "set");
  assert.equal(await syncTeamSeats("org_abc", "scale", c), "set");
  assert.deepEqual(calls, [["org_abc", 3], ["org_abc", 10]]);
});

test("a person's own workspace and non-plan payments change nothing", async () => {
  const { c, calls } = fake();
  assert.equal(await syncTeamSeats("user_1", "growth", c), "skipped");
  assert.equal(await syncTeamSeats("org_abc", "topup_500", c), "skipped");
  assert.equal(await syncTeamSeats("org_abc", "growth", null), "skipped");
  assert.equal(calls.length, 0);
});

test("a Clerk failure is reported, never thrown", async () => {
  const bad: SeatClient = { setMaxMembers: async () => { throw new Error("down"); } };
  const keep = console.error; console.error = () => {};
  try { assert.equal(await syncTeamSeats("org_abc", "starter", bad), "failed"); } finally { console.error = keep; }
});
