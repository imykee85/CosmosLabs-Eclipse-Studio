import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { finalizeGeneration } from "@/lib/generation-jobs";
import { checkFields, sendTo, SendError } from "@/lib/connector-send";
import { directConnectors } from "@/lib/connectors";
import { enabledModels } from "@/lib/models";
import { MEMORY_LIMIT, MEMORY_TEXT_MAX, MEMORY_TOPICS, isTopic } from "@/lib/memory";
import { skills } from "@/lib/skills";
import { startRender } from "@/lib/start-render";
import { displayUrl } from "@/lib/storage";
import { unseal } from "@/lib/secret-box";

// The tools the Connect assistant can call. Each one runs as the signed-in user and goes through the same code as the buttons
// in the app (renders are priced and recorded by startRender, memory and links belong to the user's account).
export type ToolContext = { userId: string; projectId: string | null; onRender: (id: string) => void };
export type ToolOutcome = { text: string; isError?: boolean };

export const toolDefs: Anthropic.Beta.Messages.BetaTool[] = [
  {
    name: "list_image_models",
    description: "List the image models that can be used with generate_image, with the shapes each supports. Call it when the user asks about models or when you need a shape a model supports.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_image",
    description: "Start rendering one image from a text prompt. It runs in the background and appears in the user's chat, Gallery and Library when done (usually under a minute); you cannot see the result. Write a detailed, concrete prompt. Each call costs the user credits, so do not render more images than the user asked for or the skill needs.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The full image prompt." },
        aspect_ratio: { type: "string", description: "For example 1:1, 4:5, 9:16 or 16:9. Must be supported by the model." },
        model: { type: "string", description: "Model id from list_image_models. Defaults to soul_v2." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "check_render",
    description: "Look up a render started with generate_image: its status (pending, completed, failed) and, if it failed, why.",
    input_schema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
  },
  {
    name: "list_recent_renders",
    description: "The user's most recent renders (newest first) with their ids, prompts and status.",
    input_schema: { type: "object", properties: { limit: { type: "integer", description: "1 to 20, default 8." } } },
  },
  {
    name: "remember",
    description: `Save one short fact about the user's work so future chats start informed (a product, a character's look, a style rule, a taste). One fact per call, under ${MEMORY_TEXT_MAX} characters. Only save things the user said or clearly wants kept.`,
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", enum: [...MEMORY_TOPICS] }, text: { type: "string" } },
      required: ["topic", "text"],
    },
  },
  {
    name: "recall",
    description: "Read what is remembered about the user, optionally filtered by a topic or a search word.",
    input_schema: { type: "object", properties: { topic: { type: "string", enum: [...MEMORY_TOPICS] }, query: { type: "string" } } },
  },
  {
    name: "forget",
    description: "Delete one remembered fact by its id (from recall). Only when the user asks you to forget it.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_skills",
    description: "The skills available (Eclipse's own and the user's), with ids.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "use_skill",
    description: "Fetch the step-by-step playbook of a skill, then follow it in this conversation.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_connected_apps",
    description: "The apps the user has connected and that you can send to with send_to_app.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_to_app",
    description: "Send a message, optionally with one finished render, to a connected app (see list_connected_apps). This posts to the user's real channel, so only do it when the user asked for it or agreed to it.",
    input_schema: {
      type: "object",
      properties: {
        app: { type: "string", description: "The app id, for example telegram or slack." },
        text: { type: "string" },
        generation_id: { type: "string", description: "A completed render to attach." },
      },
      required: ["app", "text"],
    },
  },
];

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "list_image_models":
        return { text: JSON.stringify(enabledModels().filter((m) => !m.requiresReference).map((m) => ({ id: m.id, name: m.label, about: m.blurb, shapes: m.ratios, max_prompt_chars: m.maxPrompt }))) };

      case "generate_image": {
        const r = await startRender({ userId: ctx.userId, prompt: args.prompt, model: str(args.model, 80) || "soul_v2", aspectRatio: args.aspect_ratio || undefined, projectId: ctx.projectId });
        if (!r.ok) return { text: r.error, isError: true };
        ctx.onRender(r.item.id);
        return { text: JSON.stringify({ generation_id: r.item.id, status: "pending", note: "Rendering in the background. The user sees it appear in the chat when it finishes." }) };
      }

      case "check_render": {
        const g = await db.generation.findFirst({ where: { id: str(args.generation_id, 60), userId: ctx.userId } });
        if (!g) return { text: "No render with that id.", isError: true };
        const f = await finalizeGeneration(g);
        return { text: JSON.stringify({ generation_id: f.id, status: f.status, prompt: f.prompt, error: f.error ?? undefined }) };
      }

      case "list_recent_renders": {
        const n = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
        const rows = await db.generation.findMany({ where: { userId: ctx.userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: n });
        return { text: JSON.stringify(rows.map((g) => ({ generation_id: g.id, status: g.status, model: g.model, prompt: g.prompt.slice(0, 200), made: g.createdAt.toISOString() }))) };
      }

      case "remember": {
        const text = str(args.text, MEMORY_TEXT_MAX);
        if (!isTopic(args.topic) || !text) return { text: "A topic and some text are required.", isError: true };
        if ((await db.memory.count({ where: { userId: ctx.userId } })) >= MEMORY_LIMIT) return { text: "Memory is full; ask the user what to forget first.", isError: true };
        const m = await db.memory.create({ data: { userId: ctx.userId, topic: args.topic, text, source: "agent" } });
        return { text: JSON.stringify({ saved: true, id: m.id }) };
      }

      case "recall": {
        const q = str(args.query, 80).toLowerCase();
        const rows = await db.memory.findMany({ where: { userId: ctx.userId, ...(isTopic(args.topic) ? { topic: args.topic } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
        return { text: JSON.stringify(rows.filter((m) => !q || m.text.toLowerCase().includes(q)).map((m) => ({ id: m.id, topic: m.topic, text: m.text }))) };
      }

      case "forget": {
        const r = await db.memory.deleteMany({ where: { id: str(args.id, 60), userId: ctx.userId } });
        return r.count ? { text: "Forgotten." } : { text: "No memory with that id.", isError: true };
      }

      case "list_skills": {
        const mine = await db.userSkill.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 50 });
        return { text: JSON.stringify([...skills.map((s) => ({ id: s.id, name: s.name, about: s.blurb })), ...mine.map((s) => ({ id: s.id, name: s.name, about: s.blurb, own: true }))]) };
      }

      case "use_skill": {
        const id = str(args.id, 60);
        const builtIn = skills.find((s) => s.id === id);
        if (builtIn) return { text: `Skill: ${builtIn.name}\n${builtIn.playbook}` };
        const own = await db.userSkill.findFirst({ where: { id, userId: ctx.userId } });
        return own ? { text: `Skill: ${own.name}\n${own.instructions}` } : { text: "No skill with that id. Use list_skills.", isError: true };
      }

      case "list_connected_apps": {
        const links = await db.connectorLink.findMany({ where: { userId: ctx.userId } });
        return { text: JSON.stringify(links.map((l) => ({ app: l.connector, destination: l.label }))) };
      }

      case "send_to_app": {
        const app = str(args.app, 40);
        const link = await db.connectorLink.findUnique({ where: { userId_connector: { userId: ctx.userId, connector: app } } });
        if (!link || !directConnectors[app]) return { text: `${app} is not connected. Ask the user to connect it under Connectors.`, isError: true };
        let imageUrl: string | undefined;
        const genId = str(args.generation_id, 60);
        if (genId) {
          const g = await db.generation.findFirst({ where: { id: genId, userId: ctx.userId, deletedAt: null } });
          if (!g || g.status !== "completed") return { text: "That render is not finished yet (or does not exist). Check it with check_render first.", isError: true };
          imageUrl = await displayUrl(g);
        }
        const secrets = JSON.parse(unseal(link.secret)) as Record<string, unknown>;
        const sent = await sendTo(app, checkFields(app, secrets), str(args.text, 3500), imageUrl);
        return { text: JSON.stringify({ sent: true, to: sent }) };
      }

      default:
        return { text: `Unknown tool ${name}.`, isError: true };
    }
  } catch (err) {
    if (err instanceof SendError) return { text: err.message, isError: true };
    console.error("connect tool failed", name, err);
    return { text: "That step failed on our side. Tell the user and carry on without it.", isError: true };
  }
}
