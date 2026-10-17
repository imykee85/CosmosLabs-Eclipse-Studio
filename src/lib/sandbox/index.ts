import { db } from "@/lib/db";
import { FakeSandboxProvider } from "./fake";
import type { SandboxProvider } from "./provider";
import { VercelSandboxProvider } from "./vercel";

// Which provider runs the sandboxes: `SANDBOX_PROVIDER` (Config value) = vercel. Tests install the fake with setSandboxProvider. Unset = the
// platform is off, and every feature that needs it says so plainly.
let cached: SandboxProvider | null | undefined;
export function sandboxProvider(): SandboxProvider | null {
  if (cached !== undefined) return cached;
  const name = process.env.SANDBOX_PROVIDER;
  if (name === "vercel") cached = new VercelSandboxProvider();
  else if (name === "fake" && process.env.NODE_ENV !== "production") cached = new FakeSandboxProvider();
  else cached = null;
  return cached;
}
/** For tests: install a provider (or none). */
export function setSandboxProvider(p: SandboxProvider | null) { cached = p; }
export const sandboxOn = () => sandboxProvider() !== null;

// Owner settings kept in the database by build-base (the env var wins when it is set).
export const SETTING = { snapshot: "base_snapshot_id", previousSnapshot: "previous_snapshot_id", chrome: "chrome_path", baseReport: "base_report", smokePassed: "smoke_passed_snapshot" } as const;
export async function getSetting(key: string): Promise<string | null> {
  return (await db.sandboxSetting.findUnique({ where: { key } }))?.value ?? null;
}
export async function setSetting(key: string, value: string | null) {
  if (value === null) await db.sandboxSetting.deleteMany({ where: { key } });
  else await db.sandboxSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
export async function baseSnapshotId(): Promise<string | null> {
  return process.env.SANDBOX_BASE_SNAPSHOT_ID || (await getSetting(SETTING.snapshot));
}
export async function chromePath(): Promise<string | null> {
  return process.env.SANDBOX_CHROME_PATH || (await getSetting(SETTING.chrome));
}
