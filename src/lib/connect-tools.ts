import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { finalizeGeneration } from "@/lib/generation-jobs";
import { checkFields, sendTo, SendError, verify, type Attachment } from "@/lib/connector-send";
import { directConnectors } from "@/lib/connectors";
import { enabledModels } from "@/lib/models";
import { MEMORY_LIMIT, MEMORY_TEXT_MAX, MEMORY_TOPICS, isTopic } from "@/lib/memory";
import { skills } from "@/lib/skills";
import { runSessionTool, SESSION_TOOL_NAMES } from "@/lib/sandbox/core-session";
import { startRender } from "@/lib/start-render";
import { displayUrl, openImage, signedGetUrl, storageEnabled } from "@/lib/storage";
import { fileNameFor } from "@/lib/generation-jobs";
import { unseal } from "@/lib/secret-box";

// The tools the Connect assistant can call. Each one runs as the signed-in user and goes through the same code as the buttons
// in the app (renders are priced and recorded by startRender, memory and links belong to the user's account).
export type ToolContext = { userId: string; projectId: string | null; chatId?: string | null; onRender: (id: string) => void; onSend?: (id: string) => void };
export type ToolOutcome = { text: string; isError?: boolean; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string } };

export const toolDefs: Anthropic.Beta.Messages.BetaTool[] = [
  {
    name: "list_image_models",
    description: "List the image models that can be used with generate_image, with the aspect ratios each supports. Call it when the user asks about models or when you need an aspect ratio a model supports.",
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
        project_id: { type: "string", description: "Save into this project instead of the one the user has open." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "list_projects",
    description: "The user's projects (not in the Bin) with how many finished renders each holds. Renders belong to a project; the Library holds all of them across projects.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_library",
    description: "Search the user's Library of finished renders (everything they have made, across projects, newest first). Filter by words in the prompt and/or a project id. Use it to find pictures to reuse, send, or build on instead of rendering again.",
    input_schema: { type: "object", properties: { query: { type: "string" }, project_id: { type: "string" }, limit: { type: "integer", description: "1 to 30, default 12." } } },
  },
  {
    name: "view_render",
    description: "Look at one finished render from the Library (you receive the picture). Use it to judge, describe or build on an existing image. Limit looking to what you need: each picture is large.",
    input_schema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
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
    name: "sandbox_exec",
    description: "Run a shell command on the person's build machine, a private cloud computer for building and testing their mini tools (Node 24, Python 3, ffmpeg). The first call starts a session, charged per started 5 minutes and closed after 30 minutes; tell the person once that you are starting it. No network unless you switch on sandbox_packages. Waits up to wait_seconds (max 20); a longer command keeps running and gives a command_id.",
    input_schema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string", description: "Folder inside /vercel/sandbox (relative)." }, wait_seconds: { type: "number" } }, required: ["command"] },
  },
  {
    name: "sandbox_command_status",
    description: "Check a command that was still running (from sandbox_exec), waiting up to wait_seconds (max 20).",
    input_schema: { type: "object", properties: { command_id: { type: "string" }, wait_seconds: { type: "number" } }, required: ["command_id"] },
  },
  {
    name: "sandbox_write_file",
    description: "Write a text file on the build machine (path relative to /vercel/sandbox, up to 2 MB).",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
  },
  {
    name: "sandbox_read_file",
    description: "Read a text file on the build machine (up to 256 KB).",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "sandbox_list_files",
    description: "List files under a folder on the build machine (default: the working folder).",
    input_schema: { type: "object", properties: { path: { type: "string" } } },
  },
  {
    name: "view_image",
    description: "Look at a PNG, JPEG or WebP picture on the build machine (up to 2 MB), such as a tool's output.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "sandbox_packages",
    description: "Open (on: true) or close (on: false) the build machine's network to the npm and PyPI registries only, for installing packages. Close it when done.",
    input_schema: { type: "object", properties: { on: { type: "boolean" } }, required: ["on"] },
  },
  {
    name: "sandbox_stop",
    description: "Close the build session when the work is done (it is charged for the time it was open).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "save_tool",
    description: "Save a mini tool the person can run again from Core > Tools > My tools. kind \"browser\": one self-contained HTML page (give it in html) that runs in the person's browser with no network; prefer it for calculators, text and CSV changes and small canvas tools. kind \"sandbox\": a Node or Python script on the build machine; it is started as `<runtime> <entry> params.json out/`, reads its inputs from params.json (input files are listed there as paths under in/), and writes results into out/ (at most 20 files, 500 MB, 4 minutes). input_schema is { fields: [{ name, label, type: text|textarea|number|boolean|select|file, options?, accept? (like [\".wav\"]), multiple?, required? }] }. Pass tool_id to save a new version. network \"internet\" only if the tool truly needs it: the person must approve it.",
    input_schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, kind: { type: "string", enum: ["browser", "sandbox"] }, html: { type: "string" }, runtime: { type: "string", enum: ["node", "python"] }, entry: { type: "string" }, files: { type: "array", items: { type: "string" } }, input_schema: { type: "object" }, network: { type: "string", enum: ["none", "internet"] }, tool_id: { type: "string" } }, required: ["name", "description", "kind"] },
  },
  {
    name: "list_connected_apps",
    description: "The apps the user has connected and that you can send to with send_to_app.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_to_app",
    description: "Prepare a message, optionally with one finished render, for a connected app (see list_connected_apps). It is NOT sent: the person sees it in the chat with a Send button and it goes out only when they press it. Only prepare one when the user asked for it or agreed to it.",
    input_schema: {
      type: "object",
      properties: {
        app: { type: "string", description: "The app id from list_connected_apps, for example telegram, slack, discord, twilio, sendgrid, whatsapp-business, notion, linear, todoist, github or jira." },
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
        return { text: JSON.stringify(enabledModels().filter((m) => m.references.min === 0 && m.provider === "higgsfield").map((m) => ({ id: m.id, name: m.label, about: m.blurb, aspect_ratios: m.ratios, max_prompt_chars: m.maxPrompt }))) };

      case "generate_image": {
        const target = str(args.project_id, 64);
        if (target && !(await db.project.findFirst({ where: { id: target, userId: ctx.userId, deletedAt: null } }))) return { text: "No such project. Use list_projects.", isError: true };
        // Google and OpenAI renders run inside the request and would outlast this chat turn's time budget.
        const wanted = enabledModels().find((m) => m.id === (str(args.model, 80) || "soul_v2"));
        if (wanted && wanted.provider !== "higgsfield") return { text: "That model is not available in chat yet. Pick one from list_image_models.", isError: true };
        const r = await startRender({ userId: ctx.userId, prompt: args.prompt, model: str(args.model, 80) || "soul_v2", aspectRatio: args.aspect_ratio || undefined, projectId: target || ctx.projectId });
        if (!r.ok) return { text: r.error, isError: true };
        ctx.onRender(r.item.id);
        return { text: JSON.stringify({ generation_id: r.item.id, status: "pending", note: "Rendering in the background. The user sees it appear in the chat when it finishes." }) };
      }

      case "list_projects": {
        const ps = await db.project.findMany({ where: { userId: ctx.userId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 50 });
        const counts = await db.generation.groupBy({ by: ["projectId"], where: { userId: ctx.userId, deletedAt: null, status: "completed" }, _count: true });
        const n = new Map(counts.map((c) => [c.projectId, c._count]));
        return { text: JSON.stringify({ open_project: ctx.projectId, projects: ps.map((p) => ({ id: p.id, name: p.name, renders: n.get(p.id) ?? 0 })), renders_without_project: n.get(null) ?? 0 }) };
      }

      case "search_library": {
        const q = str(args.query, 80).toLowerCase();
        const take = Math.min(Math.max(Number(args.limit) || 12, 1), 30);
        const pid = str(args.project_id, 64);
        const rows = await db.generation.findMany({ where: { userId: ctx.userId, deletedAt: null, status: "completed", ...(pid ? { projectId: pid } : {}), ...(q ? { prompt: { contains: q, mode: "insensitive" as const } } : {}) }, orderBy: { createdAt: "desc" }, take });
        const names = new Map((await db.project.findMany({ where: { userId: ctx.userId, id: { in: rows.map((r) => r.projectId).filter((x): x is string => !!x) } } })).map((p) => [p.id, p.name]));
        return { text: JSON.stringify(rows.map((g) => ({ generation_id: g.id, prompt: g.prompt.slice(0, 240), model: g.model, aspect_ratio: g.aspectRatio, project: g.projectId ? names.get(g.projectId) ?? g.projectId : null, made: g.createdAt.toISOString() }))) };
      }

      case "view_render": {
        const g = await db.generation.findFirst({ where: { id: str(args.generation_id, 60), userId: ctx.userId, deletedAt: null, status: "completed" } });
        if (!g) return { text: "No finished render with that id.", isError: true };
        const res = await openImage(g);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = (g.contentType ?? res.headers.get("content-type") ?? "").split(";")[0];
        if (!res.ok || bytes.length > 3_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(type)) return { text: "That picture cannot be shown to you (too large or unreadable). Work from its prompt instead: " + g.prompt.slice(0, 300), isError: true };
        return { text: `Render ${g.id}. Prompt: ${g.prompt.slice(0, 300)}`, image: { mediaType: type as "image/png", data: Buffer.from(bytes).toString("base64") } };
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
        // The assistant can only QUEUE a message. It is shown to the person with a Send button and goes out only when they press it, so nothing the
        // assistant read in a document, a page or a memory can post anywhere by itself.
        const app = str(args.app, 40);
        const text = str(args.text, 3500);
        if (!text) return { text: "Write the message first.", isError: true };
        const link = await db.connectorLink.findUnique({ where: { userId_connector: { userId: ctx.userId, connector: app } } });
        if (!link || !directConnectors[app]) return { text: `${app} is not connected. Ask the user to connect it under Connectors.`, isError: true };
        const genId = str(args.generation_id, 60);
        if (genId) {
          const g = await db.generation.findFirst({ where: { id: genId, userId: ctx.userId, deletedAt: null } });
          if (!g || g.status !== "completed") return { text: "That render is not finished yet (or does not exist). Check it with check_render first.", isError: true };
          if (g.kind === "video") return { text: "Videos cannot be sent to apps yet; send a picture or a link instead.", isError: true };
        }
        const open = await db.pendingSend.count({ where: { userId: ctx.userId, status: "pending" } });
        if (open >= 20) return { text: "There are already 20 messages waiting for the person to press Send. Tell them to send or cancel some first.", isError: true };
        const row = await db.pendingSend.create({ data: { userId: ctx.userId, chatId: ctx.chatId ?? null, app, text, generationId: genId || null } });
        ctx.onSend?.(row.id);
        return { text: JSON.stringify({ queued: true, pending_send_id: row.id, sent: false, note: `NOT SENT YET. The message is shown to the person with a Send button. Tell them what you prepared and where it will go (${link.label || app}), and that they need to press Send. Do not say it was sent.` }) };
      }

      default:
        if ((SESSION_TOOL_NAMES as readonly string[]).includes(name)) return runSessionTool(name, args, ctx.userId, ctx.chatId ?? null);
        return { text: `Unknown tool ${name}.`, isError: true };
    }
  } catch (err) {
    if (err instanceof SendError) return { text: err.message, isError: true };
    console.error("connect tool failed", name, err);
    return { text: "That step failed on our side. Tell the user and carry on without it.", isError: true };
  }
}


/** Sends a queued message for real. Only called from the person's own Send button (`/api/connect/sends/<id>`), never from the assistant. */
export async function performSend(userId: string, app: string, text: string, generationId: string | null): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  try {
    const link = await db.connectorLink.findUnique({ where: { userId_connector: { userId, connector: app } } });
    if (!link || !directConnectors[app]) return { ok: false, error: `${app} is not connected any more. Connect it under Connectors.` };
    let image: Attachment | undefined;
    if (generationId) {
      const g = await db.generation.findFirst({ where: { id: generationId, userId, deletedAt: null } });
      if (!g || g.status !== "completed") return { ok: false, error: "The picture is not available any more." };
      if (g.kind === "video") return { ok: false, error: "Videos cannot be sent to apps yet." };
      image = { url: await displayUrl(g), type: g.contentType ?? "image/png", name: fileNameFor(g) };
      // Apps that keep the picture get the file itself (Discord, email) or a 7-day link (pages, tasks, issues), never the 10-minute one.
      if (app === "discord" || app === "sendgrid") {
        const res = await openImage(g);
        const buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
        if (buf && buf.byteLength <= 8 * 1024 * 1024) image.bytes = buf;
      }
      if (directConnectors[app]?.verifyOnly) image.link7 = g.storageKey && storageEnabled ? await signedGetUrl(g.storageKey, 7 * 24 * 3600) : g.imageUrl;
    }
    const secrets = JSON.parse(unseal(link.secret)) as Record<string, unknown>;
    const linkData = { ...checkFields(app, secrets), ...(typeof secrets.teamId === "string" ? { teamId: secrets.teamId } : {}) };
    if (app === "linear" && !linkData.teamId) await verify(app, linkData);
    const to = await sendTo(app, linkData, text.slice(0, 3500), image);
    return { ok: true, to };
  } catch (err) {
    if (err instanceof SendError) return { ok: false, error: err.message };
    console.error("send to app failed", app, err);
    return { ok: false, error: "That could not be sent just now. Please try again." };
  }
}
