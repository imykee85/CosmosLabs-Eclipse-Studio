import { NextResponse } from "next/server";
import { fetchXVideo } from "@/lib/x-video";

export const dynamic = "force-dynamic";

// GET /api/motion/video?id=<post id>: where the video of a post on X can be played from, or 404 when it cannot be found.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const video = await fetchXVideo(id);
  if (!video) return NextResponse.json({ error: "No video found for this post." }, { status: 404, headers: { "cache-control": "private, max-age=300" } });
  return NextResponse.json(video, { headers: { "cache-control": "private, max-age=3600" } });
}
