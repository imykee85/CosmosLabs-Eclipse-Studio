import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { createKey } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";
import { gateFeature } from "@/lib/access";

// The signed-in person's API keys (never the keys themselves: only the name, the first characters and when they were used).
export async function GET() {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const keys = await db.apiKey.findMany({ where: { userId: u.userId, revokedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } });
  return NextResponse.json({ keys });
}

// A new key. Its full value is in this answer only, once.
export async function POST(req: Request) {
  const gated = await gateFeature("api");
  if (gated) return gated;
  const u = await requireUser(); if ("fail" in u) return u.fail;
  if (!(await claimUsage(u.userId, "api-key", 10, 3600_000))) return NextResponse.json({ error: "Too many new keys. Try again in an hour." }, { status: 429 });
  const b = await req.json().catch(() => null);
  const r = await createKey(u.userId, typeof b?.name === "string" ? b.name : "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ id: r.id, key: r.key });
}
