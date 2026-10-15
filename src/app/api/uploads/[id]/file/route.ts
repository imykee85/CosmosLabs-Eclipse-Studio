import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { getObjectBytes, storageEnabled } from "@/lib/storage";

export const maxDuration = 30;

// The picture file of one of the signed-in user's uploads, from our own address (the signed storage links expire after ten minutes, this one does
// not), so a Canvas node can keep showing the picture it was given.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!storageEnabled) return NextResponse.json({ error: "Storage is not set up." }, { status: 503 });
  try {
    const row = await db.upload.findFirst({ where: { id: params.id, userId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const bytes = await getObjectBytes(row.storageKey);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": row.contentType, "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    console.error("opening upload failed", err);
    return NextResponse.json({ error: "Could not read the picture." }, { status: 500 });
  }
}
