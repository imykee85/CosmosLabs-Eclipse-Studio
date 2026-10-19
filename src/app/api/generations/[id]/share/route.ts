import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";
import { storageEnabled } from "@/lib/storage";
import { shareToken } from "@/lib/media-link";
import { workspaceSession } from "@/lib/workspace";

const SHARE_DAYS = 7; // the longest a signed link can last

// A link someone else can open without signing in, which stops working by itself after SHARE_DAYS. Asked for by the owner, one render at a time.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await claimUsage(userId, "share", 30, 60_000))) return NextResponse.json({ error: "Too many share links at once. Wait a moment and try again." }, { status: 429 });
  try {
    const g = await db.generation.findFirst({ where: { id: params.id, userId, status: "completed", deletedAt: null } });
    if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // An Eclipse address (/s/<token>), never the storage service's: the file is streamed through our own site until the link expires.
    if (!g.storageKey || !storageEnabled) return NextResponse.json({ error: "This file cannot be shared yet." }, { status: 409 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    return NextResponse.json({ url: `${origin}/s/${shareToken(g.id, SHARE_DAYS)}`, days: SHARE_DAYS });
  } catch (err) {
    console.error("creating share link failed", err);
    return NextResponse.json({ error: "Could not create a share link." }, { status: 500 });
  }
}
