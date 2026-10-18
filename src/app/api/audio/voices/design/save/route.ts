import { NextResponse } from "next/server";
import { audioUser } from "@/lib/audio/route-helpers";
import { saveDesignedVoice } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep one previewed design as the person's voice (the token and its signature come from /design and only work for the person it was made for).
export async function POST(req: Request) {
  const u = await audioUser();
  if ("res" in u) return u.res;
  const b = (await req.json().catch(() => null)) as { provider?: unknown; token?: unknown; sig?: unknown; name?: unknown; description?: unknown } | null;
  const r = await saveDesignedVoice({ userId: u.userId, provider: b?.provider, token: b?.token, sig: b?.sig, name: b?.name, description: b?.description });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ voice: r.voice });
}
