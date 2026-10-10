import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { agentEnabled, dailyLimit, runTurn, type AgentEvent } from "@/lib/connect-agent";
import { apiModelFor } from "@/lib/connect-models";
import { db } from "@/lib/db";

export const maxDuration = 60;

// Sends one message to the assistant and streams back what it does: lines of JSON, one event each (text, tool, render, error, done).
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agentEnabled()) return NextResponse.json({ error: "The assistant is not switched on yet: the owner needs to add ANTHROPIC_API_KEY." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!text) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  if (text.length > 8000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  const chatId = typeof body?.chatId === "string" ? body.chatId : null;
  const projectId = typeof body?.projectId === "string" && body.projectId.length <= 64 ? body.projectId : null;
  const imageIds: string[] = Array.isArray(body?.images) ? body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, 3) : [];

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const used = await db.connectMessage.count({ where: { role: "user", createdAt: { gte: since }, chat: { userId } } });
  if (used >= dailyLimit()) return NextResponse.json({ error: `You have reached today's limit of ${dailyLimit()} messages. It resets on a rolling 24 hours.` }, { status: 429 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (e: AgentEvent) => { if (!open) return; try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { open = false; } };
      try {
        // Keeps going (and saving) even if the browser disconnects, so a started render or sent message is never half-recorded.
        await runTurn({ userId, chatId, projectId, text, imageIds, model: apiModelFor(body?.model), emit });
      } catch (err) {
        console.error("connect chat failed", err);
        const why = err instanceof Anthropic.RateLimitError ? "The assistant is busy right now. Try again in a minute."
          : err instanceof Anthropic.AuthenticationError ? "The assistant's API key was rejected. The owner needs to check ANTHROPIC_API_KEY."
          : err instanceof Anthropic.BadRequestError ? `The assistant could not take that request: ${err.message.slice(0, 160)}`
          : "Something went wrong on our side. Please try again.";
        emit({ t: "error", message: why });
      }
      emit({ t: "done" });
      if (open) try { controller.close(); } catch {}
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
