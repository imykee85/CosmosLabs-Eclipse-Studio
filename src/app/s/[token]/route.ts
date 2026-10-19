import { db } from "@/lib/db";
import { fileNameFor } from "@/lib/generation-jobs";
import { readShareToken, streamStored } from "@/lib/media-link";
import { storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A shared render, opened by anyone with the link until it expires (see src/lib/media-link.ts). Served from Eclipse's own address.
export async function GET(req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const t = readShareToken(token);
  if (!t || !storageEnabled) return new Response("This link has expired or is not valid.", { status: 404 });
  const g = await db.generation.findFirst({ where: { id: t.id, status: "completed", deletedAt: null }}).catch(() => null);
  if (!g?.storageKey) return new Response("This link has expired or is not valid.", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") ? fileNameFor(g) : undefined;
  return streamStored(req, g.storageKey, g.contentType ?? (g.kind === "video" ? "video/mp4" : "image/png"), { download, cache: "public, max-age=3600" });
}
