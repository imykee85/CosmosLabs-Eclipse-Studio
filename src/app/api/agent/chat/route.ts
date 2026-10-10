import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { personaOf } from "@/lib/agent-personas";
import { connectModels } from "@/lib/connect-models";

export const maxDuration = 60;

// One turn of the conversation with a studio agent. The agent answers in words and may PROPOSE actions (generate, use a prompt, ask for approval); the browser shows them as
// buttons and nothing happens until the user presses one. Replies are not stored on the server: the browser keeps the chat.
type Action = { kind: "generate" | "use_prompt" | "reply"; label: string; prompt?: string; count?: number };

const TOOLS: Anthropic.Tool[] = [
  { name: "propose_generation", description: "Ask the user to approve making picture(s) from a finished prompt. Shows a Generate button.", input_schema: { type: "object", properties: { prompt: { type: "string", description: "The full prompt to render." }, count: { type: "integer", minimum: 1, maximum: 4, description: "How many images (default: the user's setting)." } }, required: ["prompt"] } },
  { name: "suggest_prompt", description: "Offer a better prompt without rendering. Shows a Use this prompt button that puts it in the prompt box.", input_schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  { name: "ask_approval", description: "Ask the user to choose before you go on. Each option becomes a button; pressing it sends that label back to you.", input_schema: { type: "object", properties: { options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 } }, required: ["options"] } },
];

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet, so the agent can't answer." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The agent isn't switched on yet: the owner needs to add ANTHROPIC_API_KEY." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const persona = personaOf(body?.agent);
  if (!persona) return NextResponse.json({ error: "Choose an agent first." }, { status: 400 });
  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
  const messages: Anthropic.MessageParam[] = [];
  for (const m of raw as { role?: string; text?: string }[]) {
    const text = clip(m?.text, 4000);
    if (!text || (m.role !== "user" && m.role !== "agent")) continue;
    const role = m.role === "user" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n\n${text}`; // the API wants alternating turns
    else messages.push({ role, content: text });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const c = body?.context ?? {};
  const ctx = [
    `Where: ${c.page === "canvas" ? "a canvas generator node" : "Image Studio"}`,
    clip(c.prompt, 1500) ? `Prompt box now: ${clip(c.prompt, 1500)}` : "Prompt box is empty.",
    clip(c.ratio, 12) ? `Ratio: ${clip(c.ratio, 12)}` : "",
    Number.isInteger(c.qty) ? `Images per run: ${c.qty}` : "",
    clip(c.model, 60) ? `Model: ${clip(c.model, 60)}` : "",
    c.ingredients ? `Ingredient pictures attached: ${Math.min(Number(c.ingredients) || 0, 20)}` : "",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    const model = connectModels.find((m) => m.id === "claude-sonnet-5-5")!.api;
    const res = await client.messages.create({ model, max_tokens: 1500, system: `${persona.system}\n\n<studio>\n${ctx}\n</studio>`, tools: TOOLS, messages });
    let text = "";
    const actions: Action[] = [];
    for (const b of res.content) {
      if (b.type === "text") text += b.text;
      else if (b.type === "tool_use") {
        const i = (b.input ?? {}) as Record<string, unknown>;
        const prompt = clip(i.prompt, 2000);
        if (b.name === "propose_generation" && prompt) {
          const n = Number.isInteger(i.count) ? Math.min(4, Math.max(1, i.count as number)) : undefined;
          actions.push({ kind: "generate", label: n && n > 1 ? `Generate ${n}` : "Generate", prompt, count: n });
        } else if (b.name === "suggest_prompt" && prompt) actions.push({ kind: "use_prompt", label: "Use this prompt", prompt });
        else if (b.name === "ask_approval" && Array.isArray(i.options)) for (const o of i.options.slice(0, 4)) { const l = clip(o, 40); if (l) actions.push({ kind: "reply", label: l }); }
      }
    }
    text = text.trim();
    if (!text && !actions.length) text = "I don't have anything to add yet. Tell me a bit more.";
    return NextResponse.json({ text, actions });
  } catch (err) {
    console.error("agent chat failed", err);
    const msg = err instanceof Error ? err.message : "";
    const why = /credit balance/i.test(msg) ? "The agent is unavailable: the Anthropic account behind the key needs credit."
      : err instanceof Anthropic.RateLimitError ? "The agent is busy right now. Try again in a minute."
      : err instanceof Anthropic.AuthenticationError ? "The agent's API key was rejected. The owner needs to check ANTHROPIC_API_KEY."
      : "The agent couldn't answer. Please try again.";
    return NextResponse.json({ error: why }, { status: 502 });
  }
}
