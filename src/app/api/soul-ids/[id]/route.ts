import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";

// Remove a Soul ID from this account (it can no longer be chosen; renders already made keep their pictures).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const r = await db.soulId.deleteMany({ where: { id: params.id, userId: u.userId } });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
