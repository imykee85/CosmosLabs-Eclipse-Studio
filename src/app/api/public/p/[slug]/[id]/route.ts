import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanDraft } from "@/lib/portfolio";
import { storageEnabled } from "@/lib/storage";
import { streamStored } from "@/lib/media-link";

export const maxDuration = 300;

// One picture or video of a PUBLISHED portfolio, for its visitors: only when it belongs to the page's owner, sits in one of the projects the owner chose and is finished and not in the bin.
// Streamed from Eclipse's own address (never a storage-service link); the bucket itself stays private.
export async function GET(req: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  if (!storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = await db.portfolio.findUnique({ where: { slug: params.slug } });
  if (!p || !p.published) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const draft = cleanDraft(p.data);
  const g = await db.generation.findFirst({ where: { id: params.id, userId: p.userId, status: "completed", deletedAt: null, projectId: { in: draft.projectIds } }, select: { storageKey: true, contentType: true } });
  if (!g?.storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return streamStored(req, g.storageKey, (g.contentType ?? undefined) ?? "application/octet-stream", { cache: "public, max-age=600" });
}
