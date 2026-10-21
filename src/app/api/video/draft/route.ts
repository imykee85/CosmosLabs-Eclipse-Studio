import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startDraftFinal } from "@/lib/video-draft";
import { workspaceSession } from "@/lib/workspace";
import { gateFeature } from "@/lib/access";

export const maxDuration = 60;

// Turns a finished Seedance 2.5 draft (made with POST /api/video { draft: true }) into the final 1080p video (src/lib/video-draft.ts).
export async function POST(req: Request) {
  const gated = await gateFeature("studios");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const r = await startDraftFinal({ userId, draftId: b?.draftId, confirm: b?.confirm });
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.needsConfirm ? { needsConfirm: true, cost: r.cost } : {}) }, { status: r.status });
  return NextResponse.json(r.item);
}
