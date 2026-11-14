import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type ChatAtt = { type: "render" | "upload" | "video"; id: string; label: string };
export type ChatPart = { kind: "text"; text: string } | { kind: "tool"; name: string } | { kind: "render"; id: string } | { kind: "send"; id: string } | { kind: "att"; items: ChatAtt[] };
export type ChatLine = { role: "user" | "assistant"; parts: ChatPart[] };

type Block = { type: string; text?: string; name?: string; id?: string; tool_use_id?: string; content?: unknown };

// A stored thread turned into what the screen shows: the user's words, the assistant's words, the tools it used and the renders it started.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const chat = await db.connectChat.findFirst({ where: { id: params.id, userId }, include: { messages: { orderBy: { seq: "asc" } } } });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toolNames = new Map<string, string>();
  const lines: ChatLine[] = [];
  for (const m of chat.messages) {
    const blocks = (Array.isArray(m.content) ? m.content : []) as Block[];
    if (m.role === "user") {
      // What the person attached (stored as an <attached> block) shows as tiles above their words.
      const attBlock = blocks.find((b) => b.type === "text" && typeof b.text === "string" && b.text.startsWith("<attached>"));
      let items: ChatAtt[] = [];
      try { const m = /^<attached>([\s\S]*?)<\/attached>/.exec(attBlock?.text ?? ""); if (m) items = JSON.parse(m[1]); } catch { items = []; }
      const text = blocks.filter((b) => b.type === "text" && b !== attBlock).map((b) => b.text ?? "").join("\n").replace(/^<(?:memory|context)>[\s\S]*?<\/(?:memory|context)>\n\n/, "");
      const images = blocks.filter((b) => b.type === "image").length;
      const parts: ChatPart[] = [];
      if (items.length) parts.push({ kind: "att", items });
      parts.push({ kind: "text", text: images ? `${text}\n(${images} picture${images > 1 ? "s" : ""} attached)` : text });
      lines.push({ role: "user", parts });
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
        if (b.type !== "tool_result" || !b.tool_use_id || typeof b.content !== "string") continue;
        const tool = toolNames.get(b.tool_use_id);
        try {
          if (tool === "generate_image") { const id = JSON.parse(b.content).generation_id; if (typeof id === "string") lines[lines.length - 1]?.parts.push({ kind: "render", id }); }
          else if (tool === "send_to_app" || tool === "edit_video" || tool === "make_kinetic_film" || tool?.startsWith("sandbox_")) { try { const j = JSON.parse(b.content); const id = j.pending_send_id ?? j.pending_id; if (typeof id === "string") lines[lines.length - 1]?.parts.push({ kind: "send", id }); } catch { /* a plain text answer carries no card */ } }
        } catch {}
      }
    }
  }
  return NextResponse.json({ id: chat.id, title: chat.title, lines });
}

// Editing a sent message: the thread is cut back to just before the n-th message the person sent (1 = the first), so the edited message can be sent again.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const n = Number(body?.fromUser);
  if (!Number.isInteger(n) || n < 1 || n > 500) return NextResponse.json({ error: "Pick a message to edit." }, { status: 400 });
  const chat = await db.connectChat.findFirst({ where: { id: params.id, userId }, select: { id: true } });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const mine = await db.connectMessage.findMany({ where: { chatId: chat.id, role: "user" }, orderBy: { seq: "asc" }, select: { seq: true }, skip: n - 1, take: 1 });
  if (!mine.length) return NextResponse.json({ error: "That message is no longer in the chat." }, { status: 404 });
  await db.connectMessage.deleteMany({ where: { chatId: chat.id, seq: { gte: mine[0].seq } } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await db.connectChat.deleteMany({ where: { id: params.id, userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
