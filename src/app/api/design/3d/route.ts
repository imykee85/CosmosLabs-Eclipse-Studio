import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeature } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";
import { db } from "@/lib/db";
import { price3D, visible3D } from "@/lib/design/models3d";
import { finalize3D, start3D, toItem3D } from "@/lib/design/jobs3d";
import { creditsOn } from "@/lib/billing";
import { toCredits } from "@/lib/credit-units";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The person's 3D models (newest first), each running one checked once. ?models=1 also returns the maker list with prices.
export async function GET(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ items: [], models: catalog() });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.model3D.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 40 });
  const items = await Promise.all(rows.map(async (r) => toItem3D(await finalize3D(r).catch(() => r))));
  return NextResponse.json({ items, ...(new URL(req.url).searchParams.get("models") ? { models: catalog() } : {}) });
}

function catalog() {
  return visible3D().map((m) => ({ id: m.id, label: m.label, maker: m.maker, modes: m.modes, minImages: m.minImages, maxImages: m.maxImages, blurb: m.blurb, polyMin: m.polyMin, polyMax: m.polyMax, polyDefault: m.polyDefault, rig: m.rig === true, credits: creditsOn() ? toCredits(price3D(m)) : null }));
}

export async function POST(req: Request) {
  const gated = await gateFeature("studios");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const r = await start3D({ userId, model: b?.model, mode: b?.mode, prompt: b?.prompt, refs: b?.refs, options: b?.options, name: b?.name, projectId: b?.projectId });
  if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status });
  return NextResponse.json(r.item);
}
