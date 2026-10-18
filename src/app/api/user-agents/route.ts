import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { MAX_AGENTS, parseAgentInput } from "@/lib/user-agents";

export const dynamic = "force-dynamic";

const view = (a: { id: string; name: string; role: string; instructions: string }) => ({ id: a.id, name: a.name, role: a.role, instructions: a.instructions });

export async function GET() {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const rows = await db.userAgent.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "asc" }, take: MAX_AGENTS });
  return NextResponse.json({ items: rows.map(view) });
}

export async function POST(req: Request) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const parsed = parseAgentInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.error.startsWith("Eclipse can't") ? 422 : 400 });
  if ((await db.userAgent.count({ where: { userId: u.userId } })) >= MAX_AGENTS) return NextResponse.json({ error: `You can have up to ${MAX_AGENTS} agents of your own. Delete one to make another.` }, { status: 409 });
  try {
    const a = await db.userAgent.create({ data: { userId: u.userId, ...parsed.value } });
    return NextResponse.json(view(a));
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return NextResponse.json({ error: "You already have an agent with that name." }, { status: 409 });
    console.error("creating an agent failed", err);
    return NextResponse.json({ error: "Could not save the agent. Please try again." }, { status: 500 });
  }
}
