import { NextResponse } from "next/server";
import { listAudioJobs, toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The person's recent voices (newest first, at most 30).
export async function GET() {
  const u = audioUser();
  if ("res" in u) return u.res;
  try {
    const rows = await listAudioJobs(u.userId, 30);
    return NextResponse.json({ items: await Promise.all(rows.map((r) => toAudioItem(r))) });
  } catch (err) {
    console.error("listing voices failed", err);
    return NextResponse.json({ error: "Could not load your voices." }, { status: 500 });
  }
}
