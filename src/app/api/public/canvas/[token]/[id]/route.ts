import { NextResponse } from "next/server";
import { sharedMedia } from "@/lib/canvas-collab";
import { storageEnabled } from "@/lib/storage";
import { streamStored } from "@/lib/media-link";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// One picture, clip or sound of a SHARED canvas, for the people who open its read-only link (rules in sharedMedia). Streamed from Eclipse's own address; the bucket stays private.
export async function GET(req: Request, props: { params: Promise<{ token: string; id: string }> }) {
  const params = await props.params;
  if (!storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await sharedMedia(params.token, params.id).catch(() => null);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return streamStored(req, m.key, m.mime, { cache: "public, max-age=300" });
}
