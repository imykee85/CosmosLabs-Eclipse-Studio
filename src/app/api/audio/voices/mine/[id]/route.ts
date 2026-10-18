import { NextResponse } from "next/server";
import { audioUser } from "@/lib/audio/route-helpers";
import { deleteOwnVoice } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Delete one of the person's own voices (also at the provider). Another person's id is simply "not found".
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const r = await deleteOwnVoice(u.userId, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
