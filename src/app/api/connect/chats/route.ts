import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { agentEnabled } from "@/lib/connect-agent";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The signed-in user's chats, newest first, plus whether the assistant is switched on.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.connectChat.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, updatedAt: true } });
  return NextResponse.json({ enabled: agentEnabled(), chats: rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() })) });
}
