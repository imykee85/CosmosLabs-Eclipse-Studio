import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { canvasUser } from "@/lib/canvas-api";
import { getShare, setShare } from "@/lib/canvas-collab";

// The read-only link of a canvas. GET says whether one is on; POST { enabled } turns it on (a new unguessable address) or off (the old address stops working at once).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const r = await getShare(u.workspace, params.id);
  return r.ok ? NextResponse.json({ enabled: r.enabled, path: r.path }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const gated = await gateFeature("canvas");
  if (gated) return gated;
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const body = await req.json().catch(() => null);
  try {
    const r = await setShare(u.workspace, params.id, body?.enabled === true);
    return r.ok ? NextResponse.json({ enabled: r.enabled, path: r.path }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) { console.error("share canvas failed", err); return NextResponse.json({ error: "Could not change the link." }, { status: 500 }); }
}
