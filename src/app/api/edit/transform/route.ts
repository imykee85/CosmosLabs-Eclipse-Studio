import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { transformPicture } from "@/lib/edit/transform";
import { claimUsage } from "@/lib/usage";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// Crop a picture to an aspect ratio, or adjust its light and colour (free: no model, the work is in src/lib/edit/transform.ts).
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!(await claimUsage(userId, "edit-transform", 60, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  try {
    const r = await transformPicture(userId, body);
    return r.ok ? NextResponse.json({ id: r.id }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) {
    console.error("transforming a picture failed", err);
    return NextResponse.json({ error: "This edit could not be made. Please try again." }, { status: 500 });
  }
}
