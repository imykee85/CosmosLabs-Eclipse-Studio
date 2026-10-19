import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/certificates";
import { storageEnabled } from "@/lib/storage";
import { streamStored } from "@/lib/media-link";

export const maxDuration = 300;

// The certified file for the public certificate page, only when its owner chose to show it. Streamed from Eclipse's own address (never a storage-service link); nothing is public in the bucket.
export async function GET(req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const code = normalizeCode(params.code);
  if (!code || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await db.certificate.findUnique({ where: { code } });
  if (!c || !c.showMedia) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const key = c.sourceType === "audio"
    ? (await db.audioJob.findFirst({ where: { id: c.sourceId, userId: c.userId, deletedAt: null }, select: { storageKey: true } }))?.storageKey
    : (await db.generation.findFirst({ where: { id: c.sourceId, userId: c.userId, deletedAt: null, status: "completed" }, select: { storageKey: true } }))?.storageKey;
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return streamStored(req, key, (c.contentType ?? undefined) ?? "application/octet-stream", { cache: "public, max-age=600" });
}
