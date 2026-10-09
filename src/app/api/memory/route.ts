import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { MEMORY_LIMIT, MEMORY_TEXT_MAX, isTopic, type MemoryItem, type MemoryTopic } from "@/lib/memory";

export const dynamic = "force-dynamic";

const toItem = (m: { id: string; topic: string; text: string; source: string; createdAt: Date }): MemoryItem =>
  ({ id: m.id, topic: m.topic as MemoryTopic, text: m.text, source: m.source === "agent" ? "agent" : "user", createdAt: m.createdAt.toISOString() });

export async function GET() {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const rows = await db.memory.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: MEMORY_LIMIT });
  return NextResponse.json({ items: rows.map(toItem) });
}

export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Write something to remember." }, { status: 400 });
  if (text.length > MEMORY_TEXT_MAX) return NextResponse.json({ error: `Keep it under ${MEMORY_TEXT_MAX} characters.` }, { status: 400 });
  if (!isTopic(body?.topic)) return NextResponse.json({ error: "Choose a topic." }, { status: 400 });
  if ((await db.memory.count({ where: { userId: u.userId } })) >= MEMORY_LIMIT) return NextResponse.json({ error: "Memory is full. Delete something first." }, { status: 409 });
  const m = await db.memory.create({ data: { userId: u.userId, topic: body.topic, text, source: "user" } });
  return NextResponse.json(toItem(m));
}
