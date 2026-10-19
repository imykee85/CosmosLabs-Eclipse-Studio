import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";
import { sniffAudio } from "@/lib/audio/voices";
import { deleteObject, getObjectHead, headObjectInfo, signedPutUrl, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// A sound added from the device to Assets (owner 2026-10-19: Assets takes every kind of media). Two steps, because a request body on the host is limited to 4.5 MB:
//  { step: "start", contentType, size }      -> a one-time signed link; the browser puts the file straight into private storage (audio/<user>/up/...)
//  { step: "finish", key, name, durationMs } -> the file's real type is read from its first bytes; it becomes a finished audio row (kind "upload")
// so it shows in Assets and the Library's Audio tab and can be picked as a reference sound. A file that is not real audio is deleted.
const TYPES: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/aac": "m4a", "audio/ogg": "ogg",
};
const MAX_MB = () => (Number(process.env.AUDIO_UPLOAD_MAX_MB) > 0 ? Number(process.env.AUDIO_UPLOAD_MAX_MB) : 100);
const MAX_ROWS = 300;
const keyPattern = (userId: string) => new RegExp(`^audio/${userId.replace(/[^A-Za-z0-9_-]/g, "")}/up/[A-Za-z0-9-]{36}\\.(mp3|wav|m4a|ogg)$`);
const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : "") || "Audio";

export async function POST(req: Request) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  if (!storageEnabled) return NextResponse.json({ error: "Audio storage is not set up yet." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (b?.step === "start") {
    const type = typeof b.contentType === "string" ? b.contentType.split(";")[0].trim().toLowerCase() : "";
    const size = typeof b.size === "number" ? b.size : 0;
    const ext = TYPES[type];
    if (!ext) return NextResponse.json({ error: "That sound file type is not supported. Use MP3, WAV, M4A or OGG." }, { status: 400 });
    if (!Number.isFinite(size) || size < 1000) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    if (size > MAX_MB() * 1048576) return NextResponse.json({ error: `That file is too large. The limit is ${MAX_MB()} MB.` }, { status: 413 });
    if (!(await claimUsage(u.userId, "audio-upload", 30, 3600_000))) return NextResponse.json({ error: "You are adding sounds very quickly. Please try again later." }, { status: 429 });
    if ((await db.audioJob.count({ where: { userId: u.userId, kind: "upload" } })) >= MAX_ROWS) return NextResponse.json({ error: `You can keep up to ${MAX_ROWS} sounds in Assets. Delete some first.` }, { status: 409 });
    const key = `audio/${u.userId}/up/${randomUUID()}.${ext}`;
    return NextResponse.json({ key, url: await signedPutUrl(key, type) });
  }

  if (b?.step === "finish") {
    const key = typeof b.key === "string" ? b.key : "";
    if (!keyPattern(u.userId).test(key)) return NextResponse.json({ error: "That upload could not be found." }, { status: 400 });
    const info = await headObjectInfo(key).catch(() => null);
    if (!info) return NextResponse.json({ error: "The file did not arrive. Please try again." }, { status: 400 });
    if (info.size > MAX_MB() * 1048576) { await deleteObject(key).catch(() => {}); return NextResponse.json({ error: `That file is too large. The limit is ${MAX_MB()} MB.` }, { status: 413 }); }
    const kind = sniffAudio(await getObjectHead(key, 64).catch(() => new Uint8Array()));
    if (!kind) { await deleteObject(key).catch(() => {}); return NextResponse.json({ error: "That file is not a sound file Eclipse can use. Use MP3, WAV, M4A or OGG." }, { status: 400 }); }
    if (await db.audioJob.findFirst({ where: { userId: u.userId, storageKey: key }, select: { id: true } })) return NextResponse.json({ error: "That sound was already added." }, { status: 409 });
    const name = cleanName(b.name);
    const ms = typeof b.durationMs === "number" && Number.isFinite(b.durationMs) && b.durationMs > 0 ? Math.min(Math.round(b.durationMs), 6 * 3600_000) : null;
    const now = new Date();
    const row = await db.audioJob.create({
      data: {
        userId: u.userId, projectId: typeof b.projectId === "string" && b.projectId.length > 0 && b.projectId.length <= 64 ? b.projectId : null, kind: "upload", provider: "upload", model: "upload", text: name,
        textHash: createHash("sha256").update(name).digest("hex"), chars: 0, status: "completed", storageKey: key, contentType: kind.mime, sizeBytes: info.size,
        durationMs: ms, params: { uploaded: true }, startedAt: now, finishedAt: now,
      },
    });
    return NextResponse.json({ item: await toAudioItem(row) });
  }

  return NextResponse.json({ error: "Unknown step." }, { status: 400 });
}
