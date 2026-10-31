import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startVideoEdit } from "@/lib/video-edit";
import { workspaceSession } from "@/lib/workspace";
import { gateFeature } from "@/lib/access";

export const maxDuration = 60;

// Edit or extend one of the person's own finished videos with Seedance 2.5 (src/lib/video-edit.ts). Returns a pending video at once, followed like any other.
export async function POST(req: Request) {
  const gated = await gateFeature("studios");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const r = await startVideoEdit({ userId, personId, sourceId: b?.sourceId, mode: b?.mode, prompt: b?.prompt, duration: b?.duration, resolution: b?.resolution, audio: b?.audio, refs: b?.refs, projectId: b?.projectId, confirm: b?.confirm, model: b?.model });
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.need ? { need: r.need } : {}), ...(r.needsConfirm ? { needsConfirm: true, cost: r.cost } : {}) }, { status: r.status });
  return NextResponse.json(r.item);
}
