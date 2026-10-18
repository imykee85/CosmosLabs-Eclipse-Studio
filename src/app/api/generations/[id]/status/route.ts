import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { finalizeGeneration, toItem } from "@/lib/generation-jobs";
import { finalizeVideo, rescueLateVideo } from "@/lib/video-jobs";
import { workspaceSession } from "@/lib/workspace";

// Long enough to copy a finished video into storage (as high as the plan allows; the copy is resumable: a cut-off one is retried on the next ask).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The lazy poll: the browser asks every few seconds while a render runs. Each ask checks the provider once and finishes the render if it is done.
// Only one ask can finish a render (it is claimed atomically), so asking from two tabs never saves or charges twice.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await db.generation.findFirst({ where: { id: params.id, userId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await toItem(row.kind === "video" ? await rescueLateVideo(await finalizeVideo(row)) : await finalizeGeneration(row)));
  } catch (err) {
    console.error("checking a render failed", err);
    return NextResponse.json({ error: "Could not check this render." }, { status: 500 });
  }
}
