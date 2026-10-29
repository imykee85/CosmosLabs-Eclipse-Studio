import { createImage, createVideo, credits, getRender, listModels, listRenders, type ApiResult } from "@/lib/api-actions";
import { askAtlas, askCore } from "@/lib/mcp-agents";
import { MCP_PROMPTS, getPrompt } from "@/lib/mcp-prompts";

// Eclipse as an MCP server (Streamable HTTP, stateless JSON responses): an MCP client (Claude, Cursor and others) points at
// https://<site>/api/mcp with "Authorization: Bearer ecl_..." and can list models, start images and videos and fetch them, as the key's owner.
export const MCP_VERSION = "2025-06-18";
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Json = Record<string, unknown>;
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const ref = { type: "object", properties: { type: { type: "string", enum: ["upload", "render"] }, id: { type: "string" } }, required: ["type", "id"] };

export const MCP_TOOLS = [
  { name: "list_models", description: "List the image and video models this Eclipse account can use, with the aspect ratios, resolutions, lengths and reference limits each accepts.", inputSchema: obj({}) },
  { name: "generate_image", description: "Start one image in Eclipse. Returns the render as pending; call get_render with its id until status is completed, then use its url (a short-lived link). Costs the model's credits when it completes.", inputSchema: obj({ prompt: { type: "string" }, model: { type: "string", description: "A model id from list_models." }, aspect_ratio: { type: "string", description: "One the model lists, or auto." }, resolution: { type: "string" }, references: { type: "array", items: ref, description: "The account's own uploads or finished renders, by id." }, seed: { type: "integer" }, project_id: { type: "string" } }, ["prompt", "model"]) },
  { name: "generate_video", description: "Start one video in Eclipse. Returns the render as pending; poll get_render. A costly video returns needs_confirm and its cost: ask the user, then call again with confirm: true.", inputSchema: obj({ prompt: { type: "string" }, model: { type: "string" }, duration: { type: "integer", description: "Seconds, one the model lists." }, resolution: { type: "string" }, aspect_ratio: { type: "string" }, sound: { type: "boolean" }, seed: { type: "integer" }, negative_prompt: { type: "string" }, start_frame: ref, end_frame: ref, reference_images: { type: "array", items: ref }, reference_videos: { type: "array", items: { type: "string" }, description: "Ids of the account's own finished videos." }, confirm: { type: "boolean" }, project_id: { type: "string" } }, ["prompt", "model", "duration"]) },
  { name: "get_render", description: "One render by id: its status (pending, completed, failed), error, and when completed a short-lived url to the file.", inputSchema: obj({ id: { type: "string" } }, ["id"]) },
  { name: "list_renders", description: "The account's newest renders.", inputSchema: obj({ limit: { type: "integer", minimum: 1, maximum: 50 }, kind: { type: "string", enum: ["image", "video"] }, project_id: { type: "string" } }) },
  { name: "get_credits", description: "The account's credit balance.", inputSchema: obj({}) },
  { name: "ask_atlas", description: "Talk to Atlas, Eclipse's creative partner: it plans ideas and shots, writes finished prompts (including detailed JSON and Seedance prompts) and can look at pictures. It keeps no chat of its own, so pass earlier turns in history. It never renders: it returns the prompt and settings to use, and you start the render with generate_image or generate_video. Each answer costs a few credits.",
    inputSchema: obj({ message: { type: "string", description: "What to ask Atlas." }, history: { type: "array", description: "Earlier turns Atlas should remember, oldest first.", items: obj({ role: { type: "string", enum: ["user", "assistant"] }, text: { type: "string" } }, ["role", "text"]) }, pictures: { type: "array", description: "Up to 8 of the account's pictures for Atlas to look at.", items: ref }, draft_prompt: { type: "string", description: "A prompt you are working on, for Atlas to improve." }, agent: { type: "string", description: "Atlas by default, or the name of one of the account's own agents." } }, ["message"]) },
  { name: "ask_core", description: "Talk to Core, Eclipse's creative computer: a chat that can make pictures, remember things, run skills and send finished work to connected apps. Pass chat_id from an earlier answer to continue that chat. Pictures Core starts are returned as renders_started: poll them with get_render. Each answer costs credits, and pictures it makes cost their usual price.",
    inputSchema: obj({ message: { type: "string" }, chat_id: { type: "string", description: "Continue this Core chat." }, project_id: { type: "string" }, model: { type: "string", enum: ["auto", "lite", "pro", "max"], description: "Core Lite is fastest and cheapest, Pro is the everyday level, Max thinks deepest." }, image_ids: { type: "array", maxItems: 3, description: "Ids of finished renders for Core to look at.", items: { type: "string" } } }, ["message"]) },
];

async function runTool(userId: string, name: string, args: Json): Promise<ApiResult> {
  switch (name) {
    case "list_models": return listModels();
    case "generate_image": return createImage(userId, args);
    case "generate_video": return createVideo(userId, args);
    case "get_render": return getRender(userId, args.id);
    case "list_renders": return listRenders(userId, args);
    case "get_credits": return credits(userId);
    case "ask_atlas": return askAtlas(userId, args);
    case "ask_core": return askCore(userId, args);
  }
  return { ok: false, status: 404, error: `Unknown tool ${name}.` };
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };
const reply = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const error = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message; returns null for a notification (no answer). */
export async function handleRpc(userId: string, m: Rpc): Promise<Json | null> {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return error(m?.id, -32600, "Invalid request");
  const isNote = m.id === undefined;
  switch (m.method) {
    case "initialize": {
      const asked = typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : MCP_VERSION;
      return reply(m.id, { protocolVersion: SUPPORTED.includes(asked) ? asked : MCP_VERSION, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: "eclipse-studio", title: "Eclipse Studio", version: "1.0.0" }, instructions: "Create images and videos in the user's Eclipse Studio account, and talk to Atlas (creative partner: plans shots and writes prompts) and Core (creative computer: chat that can make pictures and use memory). Renders run in the background: start one, then poll get_render until completed. Atlas never renders; it returns prompts you can render with generate_image or generate_video. Everything spends the account's credits, so ask before starting anything expensive." });
    }
    case "ping": return isNote ? null : reply(m.id, {});
    case "tools/list": return reply(m.id, { tools: MCP_TOOLS });
    case "prompts/list": return reply(m.id, { prompts: MCP_PROMPTS });
    case "prompts/get": {
      const name = typeof m.params?.name === "string" ? m.params.name : "";
      const args = m.params?.arguments && typeof m.params.arguments === "object" ? (m.params.arguments as Json) : {};
      const p = getPrompt(name, args);
      return p ? reply(m.id, p) : error(m.id, -32602, `Unknown prompt ${name}`);
    }
    case "tools/call": {
      const name = typeof m.params?.name === "string" ? m.params.name : "";
      const args = m.params?.arguments && typeof m.params.arguments === "object" ? (m.params.arguments as Json) : {};
      if (!MCP_TOOLS.some((t) => t.name === name)) return error(m.id, -32602, `Unknown tool ${name}`);
      const r = await runTool(userId, name, args);
      if (!r.ok) return reply(m.id, { isError: true, content: [{ type: "text", text: JSON.stringify({ error: r.error, ...(r.extra ?? {}) }) }] });
      return reply(m.id, { content: [{ type: "text", text: JSON.stringify(r.data) }], structuredContent: r.data });
    }
  }
  if (m.method.startsWith("notifications/")) return null;
  return isNote ? null : error(m.id, -32601, `Method not found: ${m.method}`);
}
