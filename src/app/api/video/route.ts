import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startVideoRender } from "@/lib/start-video";

// 60 s: handing the start and end frames to the provider can take a moment. The video itself runs at Higgsfield for minutes; this only starts it.
export const maxDuration = 60;

// Starts a video and returns at once with a "pending" job. The browser then asks GET /api/generations/<id>/status every few seconds.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const result = await startVideoRender({
    userId, prompt: b?.prompt, model: b?.model, duration: b?.duration, resolution: b?.resolution, aspectRatio: b?.aspectRatio, audio: b?.audio, seed: b?.seed, lockSeed: b?.lockSeed,
    negativePrompt: b?.negativePrompt, cfgScale: b?.cfgScale, start: b?.start, end: b?.end, refs: b?.refs, videoRefs: b?.videoRefs, audioRefs: b?.audioRefs, shots: b?.shots, motion: b?.motion, confirm: b?.confirm, projectId: b?.projectId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, ...(result.needsConfirm ? { needsConfirm: true, cost: result.cost } : {}) }, { status: result.status });
  return NextResponse.json(result.seedNote ? { ...result.item, seedNote: result.seedNote } : result.item);
}
