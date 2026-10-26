import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { canvasUser } from "@/lib/canvas-api";
import { addTemplate, listTemplates } from "@/lib/canvas-collab";

const MAX_BYTES = 400_000;

// The workspace's canvas templates (newest last). Shared with the team when a team is active.
export async function GET() {
  const u = await canvasUser();
  if ("res" in u) return u.res;
  try { return NextResponse.json({ items: await listTemplates(u.workspace) }); }
  catch (err) { console.error("list canvas templates failed", err); return NextResponse.json({ error: "Could not load templates." }, { status: 500 }); }
}

export async function POST(req: Request) {
  const gated = await gateFeature("canvas");
  if (gated) return gated;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "This template is too large to save." }, { status: 413 });
  let body: { name?: unknown; nodes?: unknown; edges?: unknown } | null = null;
  try { body = JSON.parse(text); } catch {}
  try {
    const r = await addTemplate(u.workspace, body?.name, body?.nodes, body?.edges);
    return r.ok ? NextResponse.json({ item: r.item }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) { console.error("save canvas template failed", err); return NextResponse.json({ error: "Could not save the template." }, { status: 500 }); }
}
