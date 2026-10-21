import { gateFeature } from "@/lib/access";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { audioUser } from "@/lib/audio/route-helpers";
import { signedPutUrl, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// A recording to transcribe goes from the browser straight to private storage (a Vercel request body is limited to 4.5 MB): this hands out a one-time signed link for it.
// The key is the person's own (audio/<user>/in/...); the job later checks the key and the size, and the file is deleted once it has been transcribed.
const TYPES: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "aac",
  "audio/ogg": "ogg", "audio/opus": "opus", "audio/flac": "flac", "audio/webm": "webm", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
const maxInputMb = () => (Number(process.env.AUDIO_STT_MAX_MB) > 0 ? Number(process.env.AUDIO_STT_MAX_MB) : 200);

export async function POST(req: Request) {
  const gated = await gateFeature("studios"); // Audio Studio and Soul ID are part of the paid plans
  if (gated) return gated;
  const u = await audioUser();
  if ("res" in u) return u.res;
  if (!storageEnabled) return NextResponse.json({ error: "Audio storage is not set up yet." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { contentType?: unknown; size?: unknown } | null;
  const type = typeof b?.contentType === "string" ? b.contentType.split(";")[0].trim().toLowerCase() : "";
  const size = typeof b?.size === "number" ? b.size : 0;
  const ext = TYPES[type];
  if (!ext) return NextResponse.json({ error: "That file type is not supported. Use MP3, WAV, M4A, OGG, FLAC, WebM, MP4 or MOV." }, { status: 400 });
  if (!Number.isFinite(size) || size < 1000) return NextResponse.json({ error: "That recording is empty." }, { status: 400 });
  if (size > maxInputMb() * 1048576) return NextResponse.json({ error: `That recording is too large. The limit is ${maxInputMb()} MB.` }, { status: 413 });
  if (!(await claimUsage(u.userId, "audio-input", 30, 3600_000))) return NextResponse.json({ error: "You are adding recordings very quickly. Please try again later." }, { status: 429 });
  const key = `audio/${u.userId}/in/${randomUUID()}.${ext}`;
  return NextResponse.json({ key, url: await signedPutUrl(key, type) });
}
