import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanDraft } from "@/lib/portfolio";
import { signedMediaUrl, storageEnabled } from "@/lib/storage";

// One picture or video of a PUBLISHED portfolio, for its visitors: only when it belongs to the page's owner, sits in one of the projects the owner chose and is finished and not in the bin.
// Sends the browser to a short-lived signed link; the bucket itself stays private.
export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = await db.portfolio.findUnique({ where: { slug: params.slug } });
  if (!p || !p.published) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const draft = cleanDraft(p.data);
  const g = await db.generation.findFirst({ where: { id: params.id, userId: p.userId, status: "completed", deletedAt: null, projectId: { in: draft.projectIds } }, select: { storageKey: true, contentType: true } });
  if (!g?.storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await signedMediaUrl(g.storageKey, { ttlSeconds: 3600, contentType: g.contentType ?? undefined });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=600" } });
}
