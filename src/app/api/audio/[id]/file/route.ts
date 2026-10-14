import { NextResponse } from "next/server";
import { fileNameOf, getAudioJob } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";
import { signedMediaUrl, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Sends the browser to a short-lived signed link for the file. With ?download=1 the link makes the browser save it under its readable file name.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = audioUser();
  if ("res" in u) return u.res;
  const j = await getAudioJob(u.userId, params.id);
  if (!j || j.status !== "completed" || !j.storageKey || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const link = await signedMediaUrl(j.storageKey, { ttlSeconds: 120, contentType: j.contentType ?? "audio/mpeg", ...(download ? { download: fileNameOf(j) } : {}) });
  return NextResponse.redirect(link, 302);
}
