import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startUpscale } from "@/lib/topaz/jobs";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 120;

// Upscale a finished picture or video of the person's own: { sourceId, preset: auto|faithful|creative, scale (pictures: 2|4) or target (clips: "1080p"|"4k"), creativity? }.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const r = await startUpscale(userId, body as Record<string, unknown>);
    if (r.ok) return NextResponse.json({ item: r.item });
    return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status });
  } catch (err) {
    console.error("upscale failed", err);
    return NextResponse.json({ error: "Upscale could not be started. Please try again." }, { status: 500 });
  }
}
