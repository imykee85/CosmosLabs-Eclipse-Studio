import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { gateFeature } from "@/lib/access";
import { claimUsage } from "@/lib/usage";
import { findItem } from "@/lib/premium";
import { premiumPrompts } from "@/lib/premium-prompts";

// The prompt behind one premium item. Only Growth and Scale (and the owner) get it; anyone else gets the upgrade answer (HTTP 402, code UPGRADE).
export async function GET(_req: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  if (!(await claimUsage(u.userId, "premium-prompt", 60, 60_000))) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const gated = await gateFeature("premium");
  if (gated) return gated;
  if (!findItem(slug, id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const prompt = premiumPrompts[`${slug}/${id}`];
  if (!prompt) return NextResponse.json({ error: "This prompt is not available yet." }, { status: 404 });
  return NextResponse.json({ prompt }, { headers: { "Cache-Control": "private, no-store" } });
}
