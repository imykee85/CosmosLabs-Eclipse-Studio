import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { publicTool } from "@/lib/core-tools";

export const dynamic = "force-dynamic";

// The person's own mini tools (built with Core). Tools are private to their owner.
export async function GET() {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const rows = await db.coreTool.findMany({ where: { userId: u.userId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 50 });
  return NextResponse.json({ tools: rows.map(publicTool) });
}
