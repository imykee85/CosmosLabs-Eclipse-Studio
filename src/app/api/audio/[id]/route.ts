import { NextResponse } from "next/server";
import { deleteAudioJob, getAudioJob, restoreAudioJob, toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The poll for one voice (and, once it is done, a fresh signed link to the file).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  try {
    const job = await getAudioJob(u.userId, params.id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await toAudioItem(job));
  } catch (err) {
    console.error("checking a voice failed", err);
    return NextResponse.json({ error: "Could not check this voice." }, { status: 500 });
  }
}

// Moves a take to the Bin; `?forever=1` removes a binned take for good.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const ok = await deleteAudioJob(u.userId, params.id, new URL(req.url).searchParams.get("forever") === "1").catch((err) => { console.error("deleting a voice failed", err); return false; });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Puts a take from the Bin back in the list.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const body = await req.json().catch(() => null);
  if (body?.action !== "restore") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const ok = await restoreAudioJob(u.userId, params.id).catch((err) => { console.error("restoring a voice failed", err); return false; });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
