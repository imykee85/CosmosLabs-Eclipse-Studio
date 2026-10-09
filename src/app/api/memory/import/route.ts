import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { MEMORY_LIMIT, isTopic, parseImportLine, type MemoryTopic } from "@/lib/memory";

// Pasted notes become memories: one per non-empty line (see parseImportLine for the optional "Style: ..." labels).
export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  if (!isTopic(body?.topic)) return NextResponse.json({ error: "Choose a topic." }, { status: 400 });
  const lines = String(body?.text ?? "").split(/\r?\n/).map((l) => parseImportLine(l, body.topic)).filter((x): x is { topic: MemoryTopic; text: string } => x !== null);
  if (!lines.length) return NextResponse.json({ error: "Paste some notes first." }, { status: 400 });
  const room = MEMORY_LIMIT - (await db.memory.count({ where: { userId: u.userId } }));
  if (room <= 0) return NextResponse.json({ error: "Memory is full. Delete something first." }, { status: 409 });
  const take = lines.slice(0, room);
  await db.memory.createMany({ data: take.map((x) => ({ userId: u.userId, topic: x.topic, text: x.text, source: "user" })) });
  return NextResponse.json({ added: take.length, skipped: lines.length - take.length });
}
