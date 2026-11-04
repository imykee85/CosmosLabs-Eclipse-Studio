import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeature } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";
import { cleanSpec } from "@/lib/agent-plan";
import { quoteFull } from "@/lib/agent-plan-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The plan as the card shows it, with its total price (voiceover and music included). Nothing is started or held.
export async function POST(req: Request) {
  const gated = await gateFeature("plans");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const spec = cleanSpec(b?.spec);
  if (!spec) return NextResponse.json({ error: "This plan could not be read." }, { status: 400 });
  const { plan } = await quoteFull(userId, spec);
  return NextResponse.json({ plan });
}
