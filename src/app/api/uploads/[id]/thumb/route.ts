import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { storageEnabled } from "@/lib/storage";
import { thumbForKey, thumbHeaders } from "@/lib/thumbs";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// A small WebP of one of the signed-in user's uploaded pictures, for tiles and pickers (cached by the browser for a week).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!storageEnabled) return NextResponse.json({ error: "Storage is not set up." }, { status: 503 });
  try {
    const row = await db.upload.findFirst({ where: { id: params.id, userId }, select: { storageKey: true } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(await thumbForKey(row.storageKey)), { headers: thumbHeaders });
  } catch (err) {
    console.error("making an upload thumbnail failed", params.id, err);
    return NextResponse.json({ error: "Could not read the picture." }, { status: 500 });
  }
}
