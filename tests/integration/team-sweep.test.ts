// Deleted teams: data goes only when Clerk says the team is gone (404) AND it has been quiet for 30 days. Needs the throwaway Postgres.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.DATABASE_URL ? false : "DATABASE_URL not set";
const OLD = "org_sweep_old", NEW = "org_sweep_new", LIVE = "org_sweep_live", ERR = "org_sweep_err";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: any;

before(async () => {
  if (skip) return;
  lib = { sweep: await import("../../src/lib/team-sweep"), db: (await import("../../src/lib/db")).db };
  const long = new Date(Date.now() - 40 * 86_400_000);
  for (const id of [OLD, LIVE, ERR]) {
    const p = await lib.db.project.create({ data: { userId: id, name: "t" } });
    await lib.db.$executeRawUnsafe(`UPDATE projects SET updated_at = $1, created_at = $1 WHERE id = $2`, long, p.id);
  }
  await lib.db.project.create({ data: { userId: NEW, name: "recent" } });
});
after(async () => {
  if (skip) return;
  await lib.db.project.deleteMany({ where: { userId: { in: [OLD, NEW, LIVE, ERR] } } });
  await lib.db.$disconnect();
});

test("only a team Clerk reports gone and that has been quiet for 30 days is removed", { skip }, async () => {
  const lookup = async (id: string) => (id === OLD || id === NEW ? "gone" : id === ERR ? "unknown" : "exists") as "gone" | "unknown" | "exists";
  const r = await lib.sweep.sweepDeletedTeams(lookup);
  assert.deepEqual(r.removed, [OLD]);
  const left = (await lib.db.project.findMany({ where: { userId: { in: [OLD, NEW, LIVE, ERR] } }, select: { userId: true } })).map((x: { userId: string }) => x.userId).sort();
  assert.deepEqual(left, [ERR, LIVE, NEW].sort());
});
