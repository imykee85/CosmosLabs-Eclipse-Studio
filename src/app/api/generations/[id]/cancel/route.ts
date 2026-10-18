import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { toItem } from "@/lib/generation-jobs";
import { cancelVideoRender } from "@/lib/video-jobs";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// Asks the provider to stop a running video. Best effort: the video only counts as canceled once the provider says so; until then it keeps running
// (or finishes, and is kept), so nothing the provider made is lost. A canceled or failed video costs no credits.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await db.generation.findFirst({ where: { id: params.id, userId, kind: "video" } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await toItem(await cancelVideoRender(row)));
  } catch (err) {
    console.error("canceling a video failed", err);
    return NextResponse.json({ error: "Could not cancel this video." }, { status: 500 });
  }
}
