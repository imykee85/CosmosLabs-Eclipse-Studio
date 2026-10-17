import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/certificates";
import { signedMediaUrl, storageEnabled } from "@/lib/storage";

// The certified file for the public certificate page, only when its owner chose to show it. Sends the browser to a short-lived signed link; nothing is public in the bucket.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);
  if (!code || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await db.certificate.findUnique({ where: { code } });
  if (!c || !c.showMedia) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const key = c.sourceType === "audio"
    ? (await db.audioJob.findFirst({ where: { id: c.sourceId, userId: c.userId, deletedAt: null }, select: { storageKey: true } }))?.storageKey
    : (await db.generation.findFirst({ where: { id: c.sourceId, userId: c.userId, deletedAt: null, status: "completed" }, select: { storageKey: true } }))?.storageKey;
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await signedMediaUrl(key, { ttlSeconds: 3600, contentType: c.contentType ?? undefined });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=600" } });
}
