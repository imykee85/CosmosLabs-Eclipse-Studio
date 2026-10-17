import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { SETTING, baseSnapshotId, chromePath, getSetting, sandboxOn } from "@/lib/sandbox";
import { usageNow, ALERT_AT, BLOCK_AT } from "@/lib/sandbox/usage";

export const dynamic = "force-dynamic";

// Owner only: this month's sandbox use against the plan's free allowance, and how the platform is set up.
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const u = await usageNow();
  return NextResponse.json({
    usage: { ...u, alertAt: ALERT_AT, blockAt: BLOCK_AT },
    setup: {
      provider: process.env.SANDBOX_PROVIDER ?? null, on: sandboxOn(), killSwitch: process.env.SANDBOX_KILL_SWITCH === "1", mux: process.env.SANDBOX_MUX === "on",
      snapshot: await baseSnapshotId(), snapshotFromEnv: Boolean(process.env.SANDBOX_BASE_SNAPSHOT_ID), previousSnapshot: await getSetting(SETTING.previousSnapshot),
      smokePassed: await getSetting(SETTING.smokePassed), chrome: await chromePath(), baseReport: await getSetting(SETTING.baseReport),
    },
  });
}
