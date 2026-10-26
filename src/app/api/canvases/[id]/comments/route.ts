import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { canvasUser } from "@/lib/canvas-api";
import { addComment, listComments } from "@/lib/canvas-collab";
import { checkPrompt } from "@/lib/moderation";
import { claimUsage } from "@/lib/usage";

type Ctx = { params: Promise<{ id: string }> };

// Comments on one canvas of the workspace (everyone in the team sees them).
export async function GET(_req: Request, props: Ctx) {
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const r = await listComments(u.workspace, u.person, params.id);
  return r.ok ? NextResponse.json({ items: r.items }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export async function POST(req: Request, props: Ctx) {
  const gated = await gateFeature("canvas");
  if (gated) return gated;
  const params = await props.params;
  const u = await canvasUser();
  if ("res" in u) return u.res;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const check = checkPrompt(text);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });
  if (!(await claimUsage(u.person, "canvas-comment", 30, 60_000))) return NextResponse.json({ error: "Too many comments at once. Try again in a minute." }, { status: 429 });
  try {
    const me = await currentUser().catch(() => null);
    const email = me?.primaryEmailAddress?.emailAddress ?? "";
    const author = me?.fullName || me?.username || email.split("@")[0] || "Someone";
    const r = await addComment(u.workspace, u.person, author, params.id, text, body?.nodeId);
    return r.ok ? NextResponse.json({ item: r.item }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (err) { console.error("add canvas comment failed", err); return NextResponse.json({ error: "Could not add the comment." }, { status: 500 }); }
}
