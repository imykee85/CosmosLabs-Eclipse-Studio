import { NextResponse } from "next/server";
import { listAudioJobs, listBinnedAudio, toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The person's recent audio (newest first, at most 30); `?bin=1` lists the ones in the Bin, `?kind=upload` only sounds added from the device (Assets),
// `?scope=studio` what Audio Studio made (no uploads).
export async function GET(req: Request) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  try {
    const q = new URL(req.url).searchParams;
    const rows = q.get("bin") === "1" ? await listBinnedAudio(u.userId)
      : await listAudioJobs(u.userId, q.get("kind") === "upload" ? 100 : 30, q.get("kind") === "upload" ? { only: "upload" } : q.get("scope") === "studio" ? { without: "upload" } : {});
    return NextResponse.json({ items: await Promise.all(rows.map((r) => toAudioItem(r))) });
  } catch (err) {
    console.error("listing voices failed", err);
    return NextResponse.json({ error: "Could not load your voices." }, { status: 500 });
  }
}
