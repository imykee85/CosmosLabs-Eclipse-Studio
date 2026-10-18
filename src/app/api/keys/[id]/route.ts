import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";

// Revoke one of the signed-in person's keys: it stops working at once.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();if ("fail" in u) return u.fail;
  const r = await db.apiKey.updateMany({ where: { id: params.id, userId: u.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
