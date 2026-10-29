import { gateFeatureFor, accessFor, coreDailyLimit } from "@/lib/access";
import { agentEnabled, runTurn, type AgentEvent } from "@/lib/connect-agent";
import { apiModelFor } from "@/lib/connect-models";
import { chatRefusal } from "@/lib/chat-credits";
import { claimUsage } from "@/lib/usage";
import { prepareAgentTurn } from "@/lib/agent-turn";
import type { ApiResult } from "@/lib/api-actions";

// Atlas and Core for the MCP endpoint (src/lib/mcp.ts): the key's owner talks to them from Claude, through the SAME code as the app's chat routes, so the plan lock, the daily
// limits, the credit check and the per-reply charge all apply exactly as in the app. They act in the owner's personal workspace (an API key never acts for a team).
type Json = Record<string, unknown>;
const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Names people say for Core's three levels (the app shows Core Lite, Core Pro and Core Max).
const CORE_MODELS: Record<string, string> = { auto: "auto", lite: "claude-haiku-5-5", pro: "claude-sonnet-5-5", max: "claude-opus-5-5" };

/** One message to Atlas (or one of the owner's own agents). The agent keeps no chat on the server: the caller sends the earlier turns it wants Atlas to remember. */
export async function askAtlas(userId: string, args: Json): Promise<ApiResult> {
  const gate = await gateFeatureFor(userId, "atlas");
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.body.error, extra: { code: gate.body.code, need: gate.body.need } };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, status: 503, error: "Atlas is not available yet. Please try again later." };
  const message = text(args.message, 4000);
  if (!message) return { ok: false, status: 400, error: "Write a message for Atlas first." };
  const earlier = (Array.isArray(args.history) ? args.history.slice(-30) : []).flatMap((h) => {
    const t = text((h as Json)?.text, 4000), role = (h as Json)?.role;
    return t && (role === "user" || role === "assistant") ? [{ role: role === "user" ? "user" : "agent", text: t }] : [];
  });
  const body = {
    agent: text(args.agent, 40) || "Atlas",
    messages: [...earlier, { role: "user", text: message }],
    context: { page: "mcp", prompt: text(args.draft_prompt, 1500), model: text(args.model, 60), pictures: Array.isArray(args.pictures) ? args.pictures : [] },
  };
  const prep = await prepareAgentTurn(userId, userId, body);
  if (!prep.ok) return { ok: false, status: prep.out.status, error: String((prep.out.json as Json)?.error ?? "Atlas could not answer.") };
  const out = await prep.work();
  const j = out.json as Json;
  if (out.status !== 200) return { ok: false, status: out.status, error: String(j?.error ?? "Atlas could not answer."), extra: typeof j?.code === "string" ? { code: j.code } : undefined };
  const actions = Array.isArray(j.actions) ? (j.actions as Json[]) : [];
  return { ok: true, data: {
    reply: j.text,
    // What the app shows as buttons: a prompt to use, a render to approve (start it with generate_image / generate_video), or choices to answer with.
    suggestions: actions.map((a) => ({ kind: a.kind === "generate" ? "render_proposal" : a.kind === "use_prompt" ? "prompt" : "choice", label: a.label, ...(a.prompt ? { prompt: a.prompt } : {}), ...(a.count ? { count: a.count } : {}) })),
    ...(Array.isArray(j.frames) && j.frames.length ? { captured_frames: j.frames } : {}),
  } };
}

/** One message to Core (the creative computer): it can make pictures, use memory and skills and send work to connected apps. Pass chat_id to continue a chat. */
export async function askCore(userId: string, args: Json): Promise<ApiResult> {
  const gate = await gateFeatureFor(userId, "core");
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.body.error, extra: { code: gate.body.code, need: gate.body.need } };
  if (!agentEnabled()) return { ok: false, status: 503, error: "Core is not available yet. Please try again later." };
  const message = text(args.message, 8000);
  if (!message) return { ok: false, status: 400, error: "Write a message for Core first." };
  const chatId = typeof args.chat_id === "string" && /^[\w-]{1,64}$/.test(args.chat_id) ? args.chat_id : null;
  const projectId = typeof args.project_id === "string" && args.project_id.length <= 64 ? args.project_id : null;
  const imageIds = (Array.isArray(args.image_ids) ? args.image_ids : []).filter((x): x is string => typeof x === "string").slice(0, 3);
  const broke = await chatRefusal(userId);
  if (broke) return { ok: false, status: 402, error: String((broke as Json).error ?? "Not enough credits."), extra: typeof (broke as Json).code === "string" ? { code: (broke as Json).code } : undefined };
  const cap = coreDailyLimit(await accessFor(userId, userId)); // null = no daily limit on this plan
  if (cap !== null && !(await claimUsage(userId, "connect", cap, 24 * 3600 * 1000))) return { ok: false, status: 429, error: `You have reached today's limit of ${cap} Core messages. It resets on a rolling 24 hours.` };

  let reply = "", chat = chatId, failed = "";
  const renders: string[] = [], tools: string[] = [];
  const emit = (e: AgentEvent) => {
    if (e.t === "chat") chat = e.id;
    else if (e.t === "text") reply += e.d;
    else if (e.t === "render") renders.push(e.id);
    else if (e.t === "tool") tools.push(e.name);
    else if (e.t === "error") failed = e.message;
  };
  try {
    await runTurn({ userId, chatId, projectId, text: message, imageIds, model: apiModelFor(CORE_MODELS[text(args.model, 8)] ?? "auto"), emit });
  } catch (err) {
    console.error("mcp core failed", err);
    return { ok: false, status: 502, error: "Core could not answer. Please try again." };
  }
  if (failed && !reply) return { ok: false, status: 502, error: failed };
  return { ok: true, data: { chat_id: chat, reply: reply.trim(), ...(renders.length ? { renders_started: renders, note: "Poll each with get_render until it is completed." } : {}), ...(tools.length ? { tools_used: [...new Set(tools)] } : {}), ...(failed ? { warning: failed } : {}) } };
}
