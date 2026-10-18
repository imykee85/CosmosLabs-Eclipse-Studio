import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { fileNameFor } from "@/lib/generation-jobs";
import { openImage, signedMediaUrl, storageEnabled } from "@/lib/storage";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// The image file of one of the signed-in user's renders, from our own address so the browser can download it or hand it to the
// share sheet without any cross-site restrictions. ?download=1 makes the browser save it under its file name.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const g = await db.generation.findFirst({ where: { id: params.id, userId, status: "completed", deletedAt: null } });
    if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // A video is not streamed through this server (it is large, and seeking needs range requests, which the storage link serves): send the browser to a short-lived signed link.
    if (g.kind === "video") {
      if (!g.storageKey || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const download = new URL(req.url).searchParams.get("download");
      return NextResponse.redirect(await signedMediaUrl(g.storageKey, { ttlSeconds: download ? 300 : 3600, ...(download ? { download: fileNameFor(g) } : {}), contentType: g.contentType ?? "video/mp4" }), 302);
    }
    const upstream = await openImage(g);
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Could not read the image." }, { status: 502 });
    const headers = new Headers({
      "Content-Type": g.contentType ?? upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=300",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    if (new URL(req.url).searchParams.get("download")) headers.set("Content-Disposition", `attachment; filename="${fileNameFor(g)}"`);
    return new Response(upstream.body, { headers });
  } catch (err) {
    console.error("opening image failed", err);
    return NextResponse.json({ error: "Could not read the image." }, { status: 500 });
  }
}
