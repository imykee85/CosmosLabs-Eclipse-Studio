import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { MEMORY_LIMIT, MEMORY_TEXT_MAX, isTopic } from "@/lib/memory";

// Pasted notes become memories: one per non-empty line (long lines are cut), all under the chosen topic.
export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  if (!isTopic(body?.topic)) return NextResponse.json({ error: "Choose a topic." }, { status: 400 });
  const lines = String(body?.text ?? "").split(/\r?\n/).map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean).map((l) => l.slice(0, MEMORY_TEXT_MAX));
  if (!lines.length) return NextResponse.json({ error: "Paste some notes first." }, { status: 400 });
  const room = MEMORY_LIMIT - (await db.memory.count({ where: { userId: u.userId } }));
  if (room <= 0) return NextResponse.json({ error: "Memory is full. Delete something first." }, { status: 409 });
  const take = lines.slice(0, room);
  await db.memory.createMany({ data: take.map((text) => ({ userId: u.userId, topic: body.topic, text, source: "user" })) });
  return NextResponse.json({ added: take.length, skipped: lines.length - take.length });
}
