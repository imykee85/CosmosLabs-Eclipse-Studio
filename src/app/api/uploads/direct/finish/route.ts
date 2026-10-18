import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { finishImage, finishVideo, ownKey } from "@/lib/direct-upload";
import { toItem } from "@/lib/generation-jobs";
import { toUploadItem } from "@/lib/uploads";
import { workspaceSession } from "@/lib/workspace";

// Reading and checking a large file takes a while (a video is checked from storage with ffmpeg, frame by frame).
export const maxDuration = 300;

// Step 2: the file is in storage. The real type is read from its bytes, the automatic content check runs, and only then is it recorded. A file that fails is deleted.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const fileKind = b?.fileKind === "video" ? "video" : b?.fileKind === "image" ? "image" : null;
  if (!fileKind || !ownKey(userId, b?.key, fileKind)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    if (fileKind === "image") {
      if (b.rights !== true) return NextResponse.json({ error: "Confirm that you have the right to use this picture." }, { status: 400 });
      const r = await finishImage(userId, b.key, { kind: b.kind, name: b.name, projectId: b.projectId });
      return r.ok ? NextResponse.json(await toUploadItem(r.item)) : NextResponse.json({ error: r.error }, { status: r.status });
    }
    const r = await finishVideo(userId, b.key, { name: b.name, projectId: b.projectId });
    return r.ok ? NextResponse.json(await toItem(r.item)) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) {
    console.error("finishing an upload failed", err);
    return NextResponse.json({ error: "Could not finish the upload. Please try again." }, { status: 500 });
  }
}
