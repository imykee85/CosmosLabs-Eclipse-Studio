import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { agentEnabled, dailyLimit, runTurn, type AgentEvent } from "@/lib/connect-agent";
import { apiModelFor } from "@/lib/connect-models";
import { claimUsage } from "@/lib/usage";
import { chatRefusal } from "@/lib/chat-credits";
import { accessFor, coreDailyLimit, gateFeature } from "@/lib/access";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 120; // a build-machine step can wait 20 s on a command after the 48 s turn budget

// Sends one message to the assistant and streams back what it does: lines of JSON, one event each (text, tool, render, error, done).
export async function POST(req: Request) {
  const gated = await gateFeature("core");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agentEnabled()) return NextResponse.json({ error: "The assistant is not available yet. Please try again later." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!text) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  if (text.length > 8000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  const chatId = typeof body?.chatId === "string" ? body.chatId : null;
  const projectId = typeof body?.projectId === "string" && body.projectId.length <= 64 ? body.projectId : null;
  const clipId = typeof body?.clip === "string" && /^[\w-]{1,64}$/.test(body.clip) ? body.clip : null; // a video attached to the message, watched end to end
  const imageIds: string[] = Array.isArray(body?.images) ? body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, 3) : [];

  const broke = await chatRefusal(userId);
  if (broke) return NextResponse.json(broke, { status: 402 });
  // The daily limit depends on the plan (owner 2026-10-21): Growth gets a large number, Scale and the owner none. It is claimed under a lock, so parallel messages cannot all slip under it.
  const w = await workspaceSession();
  const limit = w.workspaceId ? coreDailyLimit(await accessFor(w.workspaceId, w.personId)) : dailyLimit();
  if (limit !== null && !(await claimUsage(userId, "connect", limit, 24 * 3600 * 1000))) return NextResponse.json({ error: `You have reached today's limit of ${limit} Core messages. It resets on a rolling 24 hours. Scale has no daily limit.` }, { status: 429 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (e: AgentEvent) => { if (!open) return; try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { open = false; } };
      try {
        // Keeps going (and saving) even if the browser disconnects, so a started render or sent message is never half-recorded.
        await runTurn({ userId, chatId, projectId, text, imageIds, clipId, model: apiModelFor(body?.model), emit });
      } catch (err) {
        console.error("connect chat failed", err);
        const why = err instanceof Anthropic.RateLimitError ? "The assistant is busy right now. Try again in a minute."
          : err instanceof Anthropic.AuthenticationError ? "The assistant is unavailable right now. Please try again later."
          : err instanceof Anthropic.BadRequestError ? "The assistant could not take that request. Try rewording it, or start a new chat."
          : "Something went wrong on our side. Please try again.";
        emit({ t: "error", message: why });
      }
      emit({ t: "done" });
      if (open) try { controller.close(); } catch {}
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
