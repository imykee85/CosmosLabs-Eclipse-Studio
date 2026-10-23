import { cacheLast, cachedSystem } from "@/lib/prompt-cache";
import Anthropic from "@anthropic-ai/sdk";
import { BRAND_RULE } from "@/lib/brand";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { customPersona, personaOf } from "@/lib/agent-personas";
import { db } from "@/lib/db";
import { connectModels } from "@/lib/connect-models";
import { seedanceKnowledge, wantsSeedance } from "@/lib/seedance-knowledge";
import { claimUsage } from "@/lib/usage";
import { ChatMeter, chargeChat, chatRefusal } from "@/lib/chat-credits";
import { loadPromptImages } from "@/lib/prompt-images";
import { attachPictures, parsePictures } from "@/lib/agent-pictures";
import { buildMessages, historyPictures, loadHistoryImages, parseTurns } from "@/lib/agent-history";
import { buildReply, type Action, type Controls } from "@/lib/agent-reply";
import { VIDEO_TOOLS, isServerTool, runVideoTool, type Frame } from "@/lib/agent-video";
import { workspaceSession } from "@/lib/workspace";
import { gateFeature } from "@/lib/access";
import type { Prisma } from "@prisma/client";

// 120 s: Atlas can watch a video (the file is copied and frames are read from it) before it answers.
export const maxDuration = 120;

// The answer is produced by a job on the server: the browser starts it (`background`) and collects the result from /api/agent/runs, so leaving the page
// or closing the browser does not stop it. A plain request still gets its answer in the same response.
type Out = { status: number; json: unknown };
const MAX_ROUNDS = 5;

// One turn of the conversation with a studio agent. The agent answers in words and may PROPOSE actions (generate, use a prompt, ask for approval); the browser shows them as
// buttons and nothing happens until the user presses one. Replies are not stored on the server: the browser keeps the chat.

const TOOLS: Anthropic.Tool[] = [
  { name: "propose_generation", description: "Ask the user to approve making picture(s) from a finished prompt. Shows a Generate button.", input_schema: { type: "object", properties: { prompt: { type: "string", description: "The full prompt to render." }, count: { type: "integer", minimum: 1, maximum: 4, description: "How many images (default: the user's setting)." } }, required: ["prompt"] } },
  { name: "suggest_prompt", description: "Offer a better prompt without rendering. Shows a Use this prompt button that puts it in the prompt box.", input_schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  { name: "ask_approval", description: "Ask the user to choose before you go on. Each option becomes a button; pressing it sends that label back to you.", input_schema: { type: "object", properties: { options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 } }, required: ["options"] } },
];

// Offered only where the screen can apply it (Image Studio, Video Studio, Core): Atlas sets the prompt box for the person. Free and instant; Generate stays their button.
const SET_BOX: Anthropic.Tool = { name: "set_prompt_box", description: "Set the prompt box's controls for the user: model, aspect ratio, number of results, quality, clip length, sound, fixed seed and the prompt text. It takes effect at once and costs nothing; the user still presses Generate. Use ONLY values listed under 'Controls you can set'. Include only what the user asked for or what clearly helps their idea. When the user is unsure what to pick, choose sensible values and say in one short line why.", input_schema: { type: "object", properties: { model: { type: "string", description: "A model id from the list (or auto)." }, aspect_ratio: { type: "string" }, count: { type: "integer", minimum: 1, maximum: 4, description: "How many images per run." }, quality: { type: "string", description: "A quality from the list." }, duration_seconds: { type: "integer", description: "Clip length in seconds." }, sound: { type: "boolean" }, fixed_seed: { type: "boolean" }, prompt: { type: "string", description: "Fill the prompt box with this text." } } } };

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export async function POST(req: Request) {
  const gated = await gateFeature("atlas");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet, so the agent can't answer." }, { status: 503 });
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The agent is not available yet. Please try again later." }, { status: 503 });

  const body = await req.json().catch(() => null);
  // Atlas is built in; any other name must be one of THIS person's own agents (looked up by owner, never trusted from the browser).
  let persona = personaOf(body?.agent);
  const isAtlas = !!persona; // only the built-in agent can watch videos; an agent a person made cannot
  if (!persona && typeof body?.agent === "string" && body.agent.length <= 40) {
    const mine = await db.userAgent.findFirst({ where: { userId: personId ?? userId, name: body.agent }, select: { name: true, role: true, instructions: true } });
    if (mine) persona = customPersona(mine);
  }
  if (!persona) return NextResponse.json({ error: "Choose an agent first." }, { status: 400 });
  // The chat as Atlas remembers it (see agent-history.ts): every message with the pictures and videos it was shown with.
  const turns = parseTurns(body?.messages);
  if (!turns.length || turns[turns.length - 1].role !== "user") return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const c = body?.context ?? {};
  const ctx = [
    `Where: ${c.page === "canvas" ? "a canvas generator node" : c.page === "video" ? "Video Studio, where the user writes a video prompt (video generation is not connected yet)" : c.page === "core" ? "Core, the user's creative computer: a chat that can make pictures, run skills, use memory and send finished work to apps" : c.page === "treatment" ? "the Treatment screen, where the user plans a video concept (brief, concept, guide); pictures are made in Image Studio" : "Image Studio"}`,
    clip(c.prompt, 1500) ? `${c.page === "treatment" ? "The user has typed" : c.page === "core" ? "Message box now" : "Prompt box now"}: ${clip(c.prompt, 1500)}` : c.page === "treatment" ? "Nothing typed yet." : c.page === "core" ? "Message box is empty." : "Prompt box is empty.",
    clip(c.ratio, 12) ? `Ratio: ${clip(c.ratio, 12)}` : "",
    Number.isInteger(c.qty) ? `Images per run: ${c.qty}` : "",
    clip(c.model, 60) ? `Model: ${clip(c.model, 60)}` : "",
    c.ingredients ? `Ingredient pictures attached: ${Math.min(Number(c.ingredients) || 0, 20)}` : "",
    ...(Array.isArray(c.settings) ? (c.settings as unknown[]).slice(0, 16).map((l) => clip(l, 140)).filter(Boolean).map((l) => `Setting: ${l}`) : []),
    Array.isArray(c.clips) && c.clips.length ? `Video clips attached: ${(c.clips as unknown[]).slice(0, 10).map((l) => clip(l, 60)).filter(Boolean).join("; ")}` : "",
    ...(isAtlas && Array.isArray(c.videos) ? (c.videos as { id?: unknown; label?: unknown; role?: unknown }[]).slice(0, 10).filter((v) => typeof v?.id === "string" && (v.id as string).length <= 64).map((v) => `Video you can watch (clip_id ${v.id}): ${clip(v.label, 60)}${clip(v.role, 30) ? ` (${clip(v.role, 30)})` : ""}`) : []),
    clip(c.message, 400) ? `Message showing on the top edge of the box right now: ${clip(c.message, 400)}` : "",
    ...(Array.isArray(c.options) && c.options.length ? ["Controls you can set with set_prompt_box (use only these values):", ...(c.options as unknown[]).slice(0, 12).map((l) => clip(l, 1800)).filter(Boolean)] : []),
  ].filter(Boolean).join("\n");
  const canSet = Array.isArray(c.options) && c.options.length > 0;

  const work = async (): Promise<Out> => {
    // The newest pictures of earlier messages are read again from our storage, so the agent can compare them with what it is shown now.
    const messages = buildMessages(turns, await loadHistoryImages(userId, historyPictures(turns), loadPromptImages));
    // The pictures attached to the box are shown to the agent (up to 4, ids only, owner-checked, read from our own storage).
    const seeing = await attachPictures(userId, parsePictures(c.pictures), messages[messages.length - 1], loadPromptImages);

    const broke = await chatRefusal(userId);
    if (broke) return { status: 402, json: broke };
    // A daily limit per person (the answer costs money): AGENT_DAILY_MESSAGES, 200 by default.
    const limit = Number(process.env.AGENT_DAILY_MESSAGES) > 0 ? Math.floor(Number(process.env.AGENT_DAILY_MESSAGES)) : 200;
    if (!(await claimUsage(personId ?? userId, "agent", limit, 24 * 3600 * 1000))) return { status: 429, json: { error: `You have reached today's limit of ${limit} agent messages. It resets on a rolling 24 hours.` } };

    // Paid in Eclipse credits from what the reply really used (every model call, video frames included), charged once when it ends.
    const meter = new ChatMeter();
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
      const model = connectModels.find((m) => m.id === "claude-sonnet-5-5")!.api;
      // The Seedance 2.5 director (the owner's storyboard workflow) rides along only while the talk is about Seedance or a storyboard: it costs about 6,000 input tokens.
      const director = isAtlas && wantsSeedance(messages, ctx) ? `\n\n${seedanceKnowledge("atlas")}` : "";
      // the persona (stable, cached together with the tools) comes first; what the box shows right now changes every message and is not cached
      const system = cachedSystem(`${persona.system}${director}\n\n${BRAND_RULE}`, `<studio>\nYou see the prompt box exactly as the user does: its text, its settings, the pictures attached and any message on its top edge.\n${ctx}${seeing}\n</studio>`);
      const base = canSet ? [...TOOLS, SET_BOX] : TOOLS;
      const tools = isAtlas ? [...base, ...VIDEO_TOOLS] : base;
      // Atlas may call its video tools (run here, results go back to it) before it answers; buttons it offers along the way are kept for the final reply.
      const convo: Anthropic.MessageParam[] = messages;
      const earlier: Action[] = [];
      let controls: Controls = {};
      const frames: Frame[] = [];
      const state = { captures: 0 };
      let res = await client.messages.create({ model, max_tokens: 8000, system, tools, messages: cacheLast(convo) as Anthropic.MessageParam[] });
      meter.add(res.model, res.usage);
      for (let round = 1; round < MAX_ROUNDS && res.stop_reason === "tool_use" && res.content.some((b) => b.type === "tool_use" && isServerTool(b.name)); round++) {
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const b of res.content) {
          if (b.type !== "tool_use") continue;
          if (isServerTool(b.name)) {
            const r = await runVideoTool(userId, b.name, (b.input ?? {}) as Record<string, unknown>, state);
            if (r.frames) frames.push(...r.frames);
            results.push({ type: "tool_result", tool_use_id: b.id, content: r.content, is_error: r.isError });
          } else results.push({ type: "tool_result", tool_use_id: b.id, content: "Shown to the user as a button." });
        }
        const so = buildReply(res.content, res.stop_reason);
        earlier.push(...so.actions);
        controls = { ...controls, ...so.controls };
        convo.push({ role: "assistant", content: res.content }, { role: "user", content: results });
        res = await client.messages.create({ model, max_tokens: 8000, system, tools, messages: cacheLast(convo) as Anthropic.MessageParam[] });
        meter.add(res.model, res.usage);
      }
      const final = buildReply(res.content, res.stop_reason);
      const actions: Action[] = [...earlier, ...final.actions];
      const text = final.text;
      controls = { ...controls, ...final.controls };
      return { status: 200, json: { text, actions, controls, frames: frames.map((f) => ({ id: f.uploadId, label: f.label, sec: f.sec })) } };
    } catch (err) {
      console.error("agent chat failed", err);
      const msg = err instanceof Error ? err.message : "";
      const why = /credit balance/i.test(msg) ? "The agent is unavailable right now. Please try again later."
        : err instanceof Anthropic.RateLimitError ? "The agent is busy right now. Try again in a minute."
        : err instanceof Anthropic.AuthenticationError ? "The agent is unavailable right now. Please try again later."
        : "The agent couldn't answer. Please try again.";
      return { status: 502, json: { error: why } };
    } finally {
      await chargeChat(userId, meter, isAtlas ? "Atlas message" : "Agent message");
    }
  };

  if (body?.background === true) {
    const run = await db.agentRun.create({ data: { userId, status: "pending" }, select: { id: true } });
    waitUntil(work().then(
      (out) => db.agentRun.update({ where: { id: run.id }, data: { status: out.status === 200 ? "done" : "failed", result: { status: out.status, body: out.json } as Prisma.InputJsonValue } }),
      () => db.agentRun.update({ where: { id: run.id }, data: { status: "failed", result: { status: 502, body: { error: "The agent couldn't answer. Please try again." } } as Prisma.InputJsonValue } }),
    ).catch((err) => console.error("agent run could not be saved", run.id, err)));
    return NextResponse.json({ runId: run.id }, { status: 202 });
  }
  const out = await work();
  return NextResponse.json(out.json, { status: out.status });
}
