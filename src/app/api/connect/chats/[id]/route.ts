import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type ChatPart = { kind: "text"; text: string } | { kind: "tool"; name: string } | { kind: "render"; id: string };
export type ChatLine = { role: "user" | "assistant"; parts: ChatPart[] };

type Block = { type: string; text?: string; name?: string; id?: string; tool_use_id?: string; content?: unknown };

// A stored thread turned into what the screen shows: the user's words, the assistant's words, the tools it used and the renders it started.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const chat = await db.connectChat.findFirst({ where: { id: params.id, userId }, include: { messages: { orderBy: { seq: "asc" } } } });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toolNames = new Map<string, string>();
  const lines: ChatLine[] = [];
  for (const m of chat.messages) {
    const blocks = (Array.isArray(m.content) ? m.content : []) as Block[];
    if (m.role === "user") {
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").replace(/^<memory>[\s\S]*?<\/memory>\n\n/, "");
      const images = blocks.filter((b) => b.type === "image").length;
      lines.push({ role: "user", parts: [{ kind: "text", text: images ? `${text}\n(${images} picture${images > 1 ? "s" : ""} attached)` : text }] });
    } else if (m.role === "assistant") {
      const parts: ChatPart[] = [];
      for (const b of blocks) {
        if (b.type === "text" && b.text) parts.push({ kind: "text", text: b.text });
        if (b.type === "tool_use" && b.id && b.name) { toolNames.set(b.id, b.name); parts.push({ kind: "tool", name: b.name }); }
      }
      if (parts.length) lines.push({ role: "assistant", parts });
    } else {
      // Tool results: pick out the renders that generate_image started and put them on the assistant line they belong to.
      for (const b of blocks) {
        if (b.type !== "tool_result" || !b.tool_use_id || toolNames.get(b.tool_use_id) !== "generate_image" || typeof b.content !== "string") continue;
        try { const id = JSON.parse(b.content).generation_id; if (typeof id === "string") lines[lines.length - 1]?.parts.push({ kind: "render", id }); } catch {}
      }
    }
  }
  return NextResponse.json({ id: chat.id, title: chat.title, lines });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await db.connectChat.deleteMany({ where: { id: params.id, userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
