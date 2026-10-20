import { NextResponse } from "next/server";
import { startAudioJob } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The price of a sound job BEFORE it is started (Mirelo's own quote when it gives one, else the registry price). Nothing is held or charged. credits is null when credits are off.
export async function POST(req: Request) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await startAudioJob({
    userId: u.userId, kind: b.kind, text: b.text, model: b.model, durationSec: b.durationSec, loop: b.loop,
    videoId: b.videoId, variants: b.variants, negativePrompt: b.negativePrompt, preserveSpeech: b.preserveSpeech, format: b.format,
  }, { dryRun: true });
  if (!r.ok) return NextResponse.json({ error: r.error, ...("code" in r && r.code ? { code: r.code } : {}) }, { status: r.status });
  return NextResponse.json({ credits: r.quote });
}
