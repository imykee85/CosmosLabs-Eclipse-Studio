// Applies prisma/schema.prisma to the database during a Vercel build, so a fresh deployment never runs against missing tables.
// It only runs on Vercel and only when DIRECT_URL is set (Prisma needs the direct, unpooled Neon connection for schema changes).
// Without those it skips quietly, so local builds and preview builds with no database still work.
// `db push` refuses changes that would lose data (it fails the build instead), so a deployment can never silently drop a column.
import { spawnSync } from "node:child_process";

if (!process.env.VERCEL || !process.env.DIRECT_URL) {
  console.log("db-push: skipped (runs on Vercel builds that have DIRECT_URL set)");
  process.exit(0);
}

// Skip when the schema has not changed since the commit Vercel last deployed (VERCEL_GIT_PREVIOUS_SHA): `db push` reads the whole database
// structure every time, and with hundreds of builds a month that was a large share of the Neon network transfer. When it cannot tell
// (no previous commit, shallow clone, git error, FORCE_DB_PUSH=1), it pushes as before, so a schema change is never skipped by mistake.
const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (prev && process.env.FORCE_DB_PUSH !== "1") {
  const diff = spawnSync("git", ["diff", "--quiet", prev, "HEAD", "--", "prisma/schema.prisma"], { stdio: "ignore" });
  if (diff.status === 0) {
    console.log(`db-push: skipped (prisma/schema.prisma unchanged since ${prev.slice(0, 7)})`);
    process.exit(0);
  }
}

console.log("db-push: applying prisma/schema.prisma");
const run = spawnSync("npx", ["--no-install", "prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });
process.exit(run.status ?? 1);
