import { NextResponse } from "next/server";
import { removeCard, setDefaultCard } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { claimUsage } from "@/lib/usage";
import { NOT_TEAM_ADMIN, workspaceSession } from "@/lib/workspace";

async function guard() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { workspaceId: userId, isAdmin } = await workspaceSession();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin) return { res: NextResponse.json({ error: NOT_TEAM_ADMIN }, { status: 403 }) };
  if (!(await claimUsage(userId, "card-change", 30, 3600_000))) return { res: NextResponse.json({ error: "Too many changes. Try again in a little while." }, { status: 429 }) };
  return { userId };
}

// Removes one saved card (the id must be one of the person's own, checked against the provider's list).
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.userId) return g.res;
  const { id } = await props.params;
  const r = await removeCard(g.userId, id);
  return r.ok ? NextResponse.json({ cards: r.cards }) : NextResponse.json({ error: r.error }, { status: r.status });
}

// Makes this card the one auto top-up charges.
export async function PUT(_req: Request, props: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.userId) return g.res;
  const { id } = await props.params;
  const r = await setDefaultCard(g.userId, id);
  return r.ok ? NextResponse.json({ cards: r.cards }) : NextResponse.json({ error: r.error }, { status: r.status });
}
