import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { keepEdit } from "@/lib/edit/keep";
import { claimUsage } from "@/lib/usage";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// Keep one variation as a version of the picture it came from (the work is in src/lib/edit/keep.ts).
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const gated = await gateFeature("studios");
  if (gated) return gated;
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!(await claimUsage(userId, "edit-keep", 60, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  try {
    const r = await keepEdit(userId, body);
    return r.ok ? NextResponse.json({ id: r.id }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) {
    console.error("keeping an edit failed", err);
    return NextResponse.json({ error: "This edit could not be saved. Please try again." }, { status: 500 });
  }
}
