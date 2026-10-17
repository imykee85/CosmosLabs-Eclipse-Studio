import { NextResponse } from "next/server";
import { listAudioJobs, listBinnedAudio, toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The person's recent voices (newest first, at most 30); `?bin=1` lists the ones in the Bin.
export async function GET(req: Request) {
  const u = audioUser();
  if ("res" in u) return u.res;
  try {
    const rows = new URL(req.url).searchParams.get("bin") === "1" ? await listBinnedAudio(u.userId) : await listAudioJobs(u.userId, 30);
    return NextResponse.json({ items: await Promise.all(rows.map((r) => toAudioItem(r))) });
  } catch (err) {
    console.error("listing voices failed", err);
    return NextResponse.json({ error: "Could not load your voices." }, { status: 500 });
  }
}
