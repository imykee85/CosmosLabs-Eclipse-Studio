import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { connectModels } from "@/lib/connect-models";
import { checkPrompt } from "@/lib/moderation";
import { engineById } from "@/lib/prompt-engines";
import { claimUsage } from "@/lib/usage";
import { ChatMeter, chargeChat, chatCreditCheck } from "@/lib/chat-credits";
import { loadPromptImages, parseImageRefs } from "@/lib/prompt-images";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// One turn with a prompt engine (the Prompts page). The engine's own instructions are the system prompt; pictures chosen by the user ride along
// with their latest message so the model can see them. The chat itself is kept in the browser. Nothing is rendered here: this only writes prompts.
const MAX_TURNS = 24;
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet, so the prompt engine can't answer." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The prompt engine isn't switched on yet: the owner needs to add ANTHROPIC_API_KEY." }, { status: 503 });
  const broke = await chatCreditCheck(userId);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (!(await claimUsage(userId, "prompts", 12, 60_000))) return NextResponse.json({ error: "Slow down a little: try again in a minute." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const engine = engineById(body?.engine);
  if (!engine) return NextResponse.json({ error: "Choose a prompt engine first." }, { status: 400 });
  if (!engine.available) return NextResponse.json({ error: `${engine.name} isn't ready yet.` }, { status: 400 });

  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages.slice(-MAX_TURNS) : [];
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const m of raw as { role?: string; text?: string }[]) {
    const text = typeof m?.text === "string" ? m.text.trim().slice(0, 8000) : "";
    if (!text || (m.role !== "user" && m.role !== "assistant")) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.text += `\n\n${text}`; // the API wants alternating turns
    else turns.push({ role: m.role, text });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  const latest = turns[turns.length - 1];
  if (!latest || latest.role !== "user") return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  // The same safety net as every render: a request the Terms forbid is refused before it reaches the model.
  const check = checkPrompt(latest.text);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  const refs = parseImageRefs(body?.images);
  if (refs === null) return NextResponse.json({ error: "Those pictures could not be read." }, { status: 400 });
  const pics = await loadPromptImages(userId, refs);
  if (!pics.ok) return NextResponse.json({ error: pics.error }, { status: 400 });

  const messages: Anthropic.MessageParam[] = turns.map((t, i) => {
    if (t.role === "user" && i === turns.length - 1 && pics.images.length) {
      const labels = pics.images.map((p, n) => `Image ${n + 1}: ${p.label}`).join("\n");
      return { role: "user", content: [...pics.images.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.mediaType, data: p.data } })), { type: "text" as const, text: `${t.text}\n\n(The user attached ${pics.images.length} reference image${pics.images.length === 1 ? "" : "s"}, in this order:\n${labels})` }] };
    }
    return { role: t.role, content: t.text };
  });

  const meter = new ChatMeter();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    const model = connectModels.find((m) => m.id === "claude-sonnet-5-5")!.api;
    const res = await client.messages.create({ model, max_tokens: 3000, system: engine.system, messages });
    meter.add(res.model, res.usage);
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ text: text || "I couldn't write a prompt from that. Tell me a little more." });
  } catch (err) {
    console.error("prompt engine failed", err);
    const msg = err instanceof Error ? err.message : "";
    const why = /credit balance/i.test(msg) ? "The prompt engine is unavailable: the AI provider account behind the key needs credit."
      : err instanceof Anthropic.RateLimitError ? "The prompt engine is busy right now. Try again in a minute."
      : err instanceof Anthropic.AuthenticationError ? "The prompt engine's API key was rejected. The owner needs to check ANTHROPIC_API_KEY."
      : "The prompt engine couldn't answer. Please try again.";
    return NextResponse.json({ error: why }, { status: 502 });
  } finally {
    await chargeChat(userId, meter, "Prompts message");
  }
}
