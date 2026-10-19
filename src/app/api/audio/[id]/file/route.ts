import { NextResponse } from "next/server";
import { fileNameOf, getAudioJob, variantsOf } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";
import { signedMediaUrl, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Sends the browser to a short-lived signed link for the file. With ?download=1 the link makes the browser save it under its readable file name.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await audioUser();
  if ("res" in u) return u.res;
  const j = await getAudioJob(u.userId, params.id);
  if (!j || j.status !== "completed" || !j.storageKey || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const download = q.get("download") === "1";
  // ?variant=2 picks one of several alternatives (Mirelo); without it, the first.
  const n = Number(q.get("variant"));
  const v = Number.isInteger(n) && n >= 1 ? variantsOf(j)[n - 1] : undefined;
  if (q.get("variant") && !v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const link = await signedMediaUrl(v?.key ?? j.storageKey, { ttlSeconds: 120, contentType: v?.mime ?? j.contentType ?? "audio/mpeg", ...(download ? { download: fileNameOf({ ...j, contentType: v?.mime ?? j.contentType }, v ? n : undefined) } : {}) });
  return NextResponse.redirect(link, 302);
}
