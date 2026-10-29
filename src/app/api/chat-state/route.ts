import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { claimUsage } from "@/lib/usage";
import { getState, isSyncKey, listStates, putState } from "@/lib/chat-state";

export const dynamic = "force-dynamic";

// The person's saved chats. Always the signed-in PERSON (never a team workspace). GET with no key lists the keys and their times; GET ?key= returns one value.
export async function GET(req: Request) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const key = new URL(req.url).searchParams.get("key");
  if (key === null) return NextResponse.json({ items: await listStates(u.userId) });
  if (!isSyncKey(key)) return NextResponse.json({ error: "Unknown key." }, { status: 400 });
  const s = await getState(u.userId, key);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function PUT(req: Request) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  if (!(await claimUsage(u.userId, "chat-state", 240, 60_000))) return NextResponse.json({ error: "Saving too fast. Try again in a moment." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  const r = await putState(u.userId, body.key, body.value, body.clientAt);
  return r.ok ? NextResponse.json({ ok: true, stale: r.stale === true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
