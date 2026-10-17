import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { refreshSoulId, soulItem, startSoulId } from "@/lib/soul-id";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// The signed-in person's Soul IDs; ones still training are checked with Higgsfield on each ask.
export async function GET() {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const rows = await db.soulId.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: 50 });
  const fresh = await Promise.all(rows.map((r) => (r.status === "pending" ? refreshSoulId(r) : r)));
  return NextResponse.json({ items: fresh.map(soulItem) });
}

// Train a new Soul ID from 5 to 30 of the person's own pictures (ids only).
export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const b = await req.json().catch(() => null);
  const r = await startSoulId(u.userId, { name: b?.name, version: b?.version, pictures: b?.pictures });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.item);
}
