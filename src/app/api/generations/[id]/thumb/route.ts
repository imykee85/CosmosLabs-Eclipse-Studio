import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { thumbForRender, thumbHeaders } from "@/lib/thumbs";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// A small WebP of one of the signed-in user's finished pictures, for tiles. The address never changes, so the browser keeps it
// (a week); the full picture stays at /file. Videos have no thumbnail here (their tiles play the clip).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const g = await db.generation.findFirst({ where: { id: params.id, userId, status: "completed" }, select: { imageUrl: true, storageKey: true, kind: true } });
    if (!g || g.kind === "video") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new Response(Buffer.from(await thumbForRender(g)), { headers: thumbHeaders });
  } catch (err) {
    console.error("making a thumbnail failed", params.id, err);
    return NextResponse.json({ error: "Could not read the image." }, { status: 500 });
  }
}
