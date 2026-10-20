import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { DIRECT_KEY, routeFor } from "@/lib/routes";
import { videoSettings } from "@/lib/start-video";

export const dynamic = "force-dynamic"; // settings are read at request time

// What the video screen needs to know that only the server can say: whether credits are charged (so the price is shown), whether video is paused, and the confirm threshold.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  if (!(await auth()).userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = videoSettings();
  return NextResponse.json({ creditsOn: s.creditsOn, paused: s.paused, ready: Boolean(process.env.HIGGSFIELD_API_KEY), maxRunning: s.maxRunning, confirmAbove: s.confirmAbove, direct: Object.keys(DIRECT_KEY).filter((id) => routeFor(id) === "direct") });
}
