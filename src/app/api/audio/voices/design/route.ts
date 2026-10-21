import { gateFeature } from "@/lib/access";
import { NextResponse } from "next/server";
import { audioUser } from "@/lib/audio/route-helpers";
import { designOwnVoice } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Design a voice from a description: returns previews (short clips as data addresses, so nothing is stored) to listen to. Keeping one is /design/save.
export async function POST(req: Request) {
  const gated = await gateFeature("studios"); // Audio Studio and Soul ID are part of the paid plans
  if (gated) return gated;
  const u = await audioUser();
  if ("res" in u) return u.res;
  const b = (await req.json().catch(() => null)) as { provider?: unknown; description?: unknown } | null;
  const r = await designOwnVoice({ userId: u.userId, provider: b?.provider, description: b?.description });
  if (!r.ok) return NextResponse.json({ error: r.error, ...("code" in r && r.code ? { code: r.code } : {}) }, { status: r.status });
  return NextResponse.json({ previews: r.previews });
}
