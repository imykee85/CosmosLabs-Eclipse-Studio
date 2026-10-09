import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { runTool, toolDefs } from "@/lib/connect-tools";
import { openImage } from "@/lib/storage";

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;
type Param = Anthropic.Beta.Messages.BetaMessageParam;

export type AgentEvent =
  | { t: "chat"; id: string }
  | { t: "text"; d: string }
  | { t: "tool"; name: string }
  | { t: "render"; id: string }
  | { t: "error"; message: string }
  | { t: "done" };

export const MAX_CHAT_MESSAGES = 120; // stored rows per chat; past this a new chat is needed (history is never trimmed, the model needs it whole)
const MAX_STEPS = 8;
const TIME_BUDGET_MS = 48_000; // the route may run 60 s
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3_000_000;
export const dailyLimit = () => Number(process.env.CONNECT_DAILY_MESSAGES) || 100;

// Frozen on purpose: anything that changes per user or per day goes into the first message instead, so the prefix stays stable.
const SYSTEM = `You are the assistant inside Eclipse, an AI studio for images, video and audio. Users bring you a creative job and you get it done with your tools: you start image renders, work with their projects and Library (list projects, search and look at finished renders, reuse them), remember facts about their work, follow skills, and send finished content to the apps they connected.

How to work:
- Be direct and concrete. Ask at most one or two questions, only when you truly cannot proceed. Prefer making a sensible choice and saying what you chose.
- Before rendering, write prompts that are specific (subject, setting, light, lens or medium, mood). Keep a subject described identically across related prompts.
- Renders cost the user credits. Render only what was asked for or what a skill needs, and say how many you started.
- Everything the user has generated lives in the Library and belongs to a project. Before rendering something new, check whether the Library already has what is needed (search_library); use view_render to look at a picture before you describe or build on it. The first message of a chat lists the open project and the latest renders.\n- Renders you just started finish in the background and show up in the chat by themselves. You cannot see a picture until you open it with view_render, so never describe a result you have not looked at.
- Video and audio generation are not available yet. Say so plainly and offer stills, storyboards or scripts instead.
- Only send to a connected app when the user asked or agreed. Use list_connected_apps first; if the app they want is not connected, tell them to connect it under Connectors.
- Use remember for lasting facts the user states (a product, a character's look, a style rule, a taste), one fact per call. Do not save guesses.
- When the user asks for a skill, call use_skill and follow its playbook.
- Keep replies short. Use plain text, no headings.`;

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
}
export const agentEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// What the assistant should know at the start of a chat: the open project, what the Library holds, and what is remembered.
async function contextDigest(userId: string, projectId: string | null): Promise<string> {
  const [mem, project, total, recent] = await Promise.all([
    db.memory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 40 }),
    projectId ? db.project.findFirst({ where: { id: projectId, userId, deletedAt: null } }) : null,
    db.generation.count({ where: { userId, deletedAt: null, status: "completed" } }),
    db.generation.findMany({ where: { userId, deletedAt: null, status: "completed" }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const parts = [
    project ? `Open project: "${project.name}" (id ${project.id}). Renders you start are saved there.` : "No project is open.",
    `Library: ${total} finished render${total === 1 ? "" : "s"} across all projects. Most recent:`,
    ...recent.map((g) => `- ${g.id}: ${g.prompt.replace(/\s+/g, " ").slice(0, 90)}`),
  ];
  if (mem.length) parts.push("Remembered:", ...mem.map((m) => `- (${m.topic}) ${m.text}`));
  return `<context>\n${parts.join("\n")}\n</context>\n\n`;
}

async function imageBlocks(userId: string, ids: string[]): Promise<Block[]> {
  const out: Block[] = [];
  for (const id of ids.slice(0, MAX_IMAGES)) {
    const g = await db.generation.findFirst({ where: { id, userId, deletedAt: null, status: "completed" } });
    if (!g) continue;
    const res = await openImage(g);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = (g.contentType ?? res.headers.get("content-type") ?? "").split(";")[0];
    if (bytes.length > MAX_IMAGE_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(type)) continue;
    out.push({ type: "image", source: { type: "base64", media_type: type as "image/png", data: Buffer.from(bytes).toString("base64") } });
  }
  return out;
}

const toParam = (r: { role: string; content: unknown }): Param => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content as Block[] });

/** One user turn: stores the message, runs the model and its tools until it answers, storing every step as it goes. */
export async function runTurn(opts: {
  userId: string; chatId: string | null; projectId: string | null; text: string; imageIds: string[]; model: string; emit: (e: AgentEvent) => void;
}): Promise<void> {
  const { userId, projectId, emit } = opts;
  const started = Date.now();

  let chat = opts.chatId ? await db.connectChat.findFirst({ where: { id: opts.chatId, userId } }) : null;
  if (opts.chatId && !chat) return emit({ t: "error", message: "That chat no longer exists." });
  if (!chat) chat = await db.connectChat.create({ data: { userId, projectId, title: opts.text.replace(/\s+/g, " ").slice(0, 60) || "New chat" } });
  emit({ t: "chat", id: chat.id });
  const chatId = chat.id;

  const rows = await db.connectMessage.findMany({ where: { chatId }, orderBy: { seq: "asc" } });
  if (rows.length >= MAX_CHAT_MESSAGES) return emit({ t: "error", message: "This chat has gotten long. Start a new chat to keep going; your memory carries over." });
  let seq = rows.length ? rows[rows.length - 1].seq : 0;
  const messages: Param[] = rows.map(toParam);

  async function store(role: "user" | "assistant" | "tool", content: unknown) {
    await db.connectMessage.create({ data: { chatId, seq: ++seq, role, content: content as object } });
    await db.connectChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  }

  // A turn that was cut off after the model asked for a tool leaves a call with no answer; close it so the thread can continue.
  const last = rows[rows.length - 1];
  if (last?.role === "assistant") {
    const calls = (last.content as unknown as Block[]).filter((b) => b.type === "tool_use");
    if (calls.length) {
      const fix = calls.map((b) => ({ type: "tool_result", tool_use_id: (b as { id: string }).id, content: "This step was interrupted before it finished.", is_error: true }));
      await store("tool", fix);
      messages.push({ role: "user", content: fix as Block[] });
    }
  }

  const content: Block[] = [...(await imageBlocks(userId, opts.imageIds))];
  content.push({ type: "text", text: `${rows.length === 0 ? await contextDigest(userId, projectId) : ""}${opts.text}` });
  await store("user", content);
  messages.push({ role: "user", content });

  const sdk = client();
  const useFallback = opts.model !== "claude-haiku-5-5"; // Haiku has no server-side fallback
  for (let step = 0; step < MAX_STEPS; step++) {
    if (step > 0 && Date.now() - started > TIME_BUDGET_MS) {
      emit({ t: "text", d: "\n\nI ran out of time on this one. Say \"continue\" and I will pick up where I stopped." });
      break;
    }
    const stream = sdk.beta.messages.stream({
      model: opts.model,
      max_tokens: 16000,
      system: SYSTEM,
      tools: toolDefs,
      messages,
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    stream.on("text", (d) => emit({ t: "text", d }));
    const msg = await stream.finalMessage();

    await store("assistant", msg.content);
    messages.push({ role: "assistant", content: msg.content as Block[] });

    if (msg.stop_reason === "refusal") return emit({ t: "error", message: "That request was declined. Try rephrasing it." });
    if (msg.stop_reason === "max_tokens") { emit({ t: "text", d: "\n\n(That answer was cut short.)" }); break; }
    if (msg.stop_reason !== "tool_use") break;

    const calls = msg.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    for (const c of calls) emit({ t: "tool", name: c.name });
    const results = await Promise.all(calls.map(async (c) => {
      const o = await runTool(c.name, c.input, { userId, projectId, onRender: (id) => emit({ t: "render", id }) });
      const content = o.image ? [{ type: "text" as const, text: o.text }, { type: "image" as const, source: { type: "base64" as const, media_type: o.image.mediaType, data: o.image.data } }] : o.text;
      return { type: "tool_result" as const, tool_use_id: c.id, content, ...(o.isError ? { is_error: true } : {}) };
    }));
    await store("tool", results);
    messages.push({ role: "user", content: results });
  }
}
