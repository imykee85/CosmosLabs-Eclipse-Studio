import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startRender } from "@/lib/start-render";

export const maxDuration = 30;

// Starts a render and returns at once with a "pending" job. The render keeps running at Higgsfield even if the browser
// closes; GET /api/generations (or /api/generations/<id>) finishes it whenever someone next asks.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = await startRender({ userId, prompt: body?.prompt, model: body?.model, aspectRatio: body?.aspectRatio, resolution: body?.resolution, projectId: body?.projectId, references: body?.references, seed: body?.seed, lockSeed: body?.lockSeed });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.seedNote ? { ...result.item, seedNote: result.seedNote } : result.item);
}
