import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Which apps the user has connected. Never returns the stored credential.
export async function GET() {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const rows = await db.connectorLink.findMany({ where: { userId: u.userId } });
  return NextResponse.json({ items: rows.map((l) => ({ id: l.connector, label: l.label, since: l.createdAt.toISOString() })) });
}
