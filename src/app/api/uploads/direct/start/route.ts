import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startUpload } from "@/lib/direct-upload";
import { claimUsage } from "@/lib/usage";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 30;

// Step 1 of a big upload: checks the file's declared type and size and returns a one-time link the browser PUTs the file to directly.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await claimUsage(userId, "upload", 30, 60_000))) return NextResponse.json({ error: "You are uploading very quickly. Wait a moment and try again." }, { status: 429 });
  const b = await req.json().catch(() => null);
  if (!b || (b.fileKind !== "image" && b.fileKind !== "video") || typeof b.contentType !== "string" || typeof b.size !== "number") return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    const r = await startUpload(userId, { fileKind: b.fileKind, contentType: b.contentType, size: b.size });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ url: r.url, key: r.key });
  } catch (err) {
    console.error("starting an upload failed", err);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
}
