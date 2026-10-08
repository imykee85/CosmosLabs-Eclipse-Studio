// Applies prisma/schema.prisma to the database during a Vercel build, so a fresh deployment never runs against missing tables.
// It only runs on Vercel and only when DIRECT_URL is set (Prisma needs the direct, unpooled Neon connection for schema changes).
// Without those it skips quietly, so local builds and preview builds with no database still work.
// `db push` refuses changes that would lose data (it fails the build instead), so a deployment can never silently drop a column.
import { spawnSync } from "node:child_process";

if (!process.env.VERCEL || !process.env.DIRECT_URL) {
  console.log("db-push: skipped (runs on Vercel builds that have DIRECT_URL set)");
  process.exit(0);
}

console.log("db-push: applying prisma/schema.prisma");
const run = spawnSync("npx", ["--no-install", "prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });
process.exit(run.status ?? 1);
