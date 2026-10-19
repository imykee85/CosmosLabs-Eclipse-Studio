import { NextResponse } from "next/server";
import { fileNameOf, getAudioJob, variantsOf } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";
import { storageEnabled } from "@/lib/storage";
import { streamStored } from "@/lib/media-link";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The file, streamed from Eclipse's own address (never a storage-service link). With ?download=1 the browser saves it under its readable file name.
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
  return streamStored(req, v?.key ?? j.storageKey, v?.mime ?? j.contentType ?? "audio/mpeg", download ? { download: fileNameOf({ ...j, contentType: v?.mime ?? j.contentType }, v ? n : undefined) } : {});
}
