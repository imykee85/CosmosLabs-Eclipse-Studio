import { NextResponse } from "next/server";
import { deleteAudioJob, getAudioJob, toAudioItem } from "@/lib/audio/jobs";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The poll for one voice (and, once it is done, a fresh signed link to the file).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = audioUser();
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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = audioUser();
  if ("res" in u) return u.res;
  const ok = await deleteAudioJob(u.userId, params.id).catch((err) => { console.error("deleting a voice failed", err); return false; });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
