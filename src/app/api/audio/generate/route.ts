import { NextResponse } from "next/server";
import { startAudioJob } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

// 300 s: the job runs in the background of this request (waitUntil), so the function must be allowed to live as long as the provider call and the copy into storage.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Starts a voice, a transcript, a sound effect or a piece of music and returns at once with a "pending" job. The browser then asks GET /api/audio/<id>.
export async function POST(req: Request) {
  const u = audioUser();
  if ("res" in u) return u.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await startAudioJob({
    userId: u.userId, kind: b.kind, text: b.text, model: b.model, voiceId: b.voiceId, voiceName: b.voiceName, speed: b.speed, projectId: b.projectId,
    durationSec: b.durationSec, loop: b.loop, instrumental: b.instrumental, inputKey: b.inputKey, inputName: b.inputName, diarize: b.diarize, language: b.language,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.item);
}
