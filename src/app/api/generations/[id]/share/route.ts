import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { signedGetUrl, storageEnabled } from "@/lib/storage";

const SHARE_DAYS = 7; // the longest a signed link can last

// A link someone else can open without signing in, which stops working by itself after SHARE_DAYS. Asked for by the owner, one render at a time.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const g = await db.generation.findFirst({ where: { id: params.id, userId, status: "completed", deletedAt: null } });
    if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const url = g.storageKey && storageEnabled ? await signedGetUrl(g.storageKey, SHARE_DAYS * 24 * 3600) : g.imageUrl;
    return NextResponse.json({ url, days: g.storageKey && storageEnabled ? SHARE_DAYS : null });
  } catch (err) {
    console.error("creating share link failed", err);
    return NextResponse.json({ error: "Could not create a share link." }, { status: 500 });
  }
}
