import { WEB_NOTE, WEB_TOOLS } from "@/lib/web-tools";
import { createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { Prisma, type AgentMission } from "@prisma/client";
import { db } from "./db";
import { serverSecret } from "./server-secret";
import { connectModels } from "./connect-models";
import { cachedSystem, cacheLast } from "./prompt-cache";
import { BRAND_RULE } from "./brand";
import { checkPrompt } from "./moderation";
import { ChatMeter, chargeChat, chatCreditCheck } from "./chat-credits";
import { freeCredits } from "./reservations";
import { enabledModels, findEnabledModel, toPublic } from "./models";
import { imageCost } from "./image-render";
import { DIRECT_KEY, routeFor } from "./routes";
import { arkRouteBlocked } from "./video-submit";
import { PICKER_MODELS, capsFor, findVideoModel, isLive, videoPrice, workflowOf } from "./video-models";
import { CORE_TOOLS, isCoreTool, runCoreTool } from "./agent-core-tools";
import { toolDefs, runTool, performSend } from "./connect-tools";
import { realDeps, type PlanDeps, VOICE_MODEL, MUSIC_MODEL } from "./agent-plan-server";
import { LEDGER_UNITS_PER_CREDIT } from "./credit-units";
import { MAX_GOAL, type MissionCall, type MissionStatus, type MissionView, type TraceItem, type TraceKind } from "./agent-mission-spec";

// ATLAS MISSIONS. A goal the agent works toward on the SERVER until it is done: a loop of think, call a tool, read the result, decide the next step. It keeps going when
// the app is closed (a signed hand-over between functions, like plans), remembers where it is (the transcript and a trace are saved after every pass), looks at what it
// made and fixes it, and it never spends without the person: calls that cost credits wait for Approve, unless the person set a budget and autopilot (then only inside it).
// Every start goes through the same functions as the studios (prices, holds, limits, moderation).
export const MISSION_MAX_MS = 2 * 60 * 60 * 1000;
export const MAX_ROUNDS = 60;            // model calls in one mission
const ROUNDS_PER_PASS = 6;               // model calls in one pass (a pass is one function run slice)
const PASS_MS = 120 * 1000;
const LOCK_MS = 150 * 1000;
const POLL_MS = 4000;
const DRIVE_MS = 270 * 1000;
const MAX_RUNNING = 2;
const TOOL_MS = 45 * 1000;

// ---- tools ----
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object" as const, properties, required });
const READ_TOOLS: Anthropic.Tool[] = [
  ...CORE_TOOLS,
  ...toolDefs.filter((t) => ["list_image_models", "list_skills", "use_skill", "list_connected_apps"].includes(t.name)).map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Tool["input_schema"] })),
  { name: "list_video_models", description: "The video models you can use with make_video, with the clip lengths, aspect ratios, qualities and how many reference pictures each takes.", input_schema: obj({}) },
  { name: "list_canvases", description: "The canvases (node boards) in the person's projects, newest first: id, name, project and how many nodes. Use it to find the board that holds their plan, prompts or references.", input_schema: obj({ project_id: { type: "string" } }) },
  { name: "read_canvas", description: "Read one canvas: its nodes (kind, title, text/prompt, chosen picture ids, settings) and how they are wired. Use it to understand or continue the person's board. You cannot edit a canvas.", input_schema: obj({ canvas_id: { type: "string" } }, ["canvas_id"]) },
  { name: "check_job", description: "Where something you started is now: its status (pending, completed or failed) and, if it failed, why. Use it before you rely on a result, and after wait.", input_schema: obj({ kind: { type: "string", enum: ["image", "video", "audio"] }, id: { type: "string" } }, ["kind", "id"]) },
];
const refs = { type: "array", maxItems: 16, description: "Pictures to build from: {\"type\":\"render\",\"id\":<generation id>} or {\"type\":\"upload\",\"id\":<upload id>}.", items: obj({ type: { type: "string", enum: ["render", "upload"] }, id: { type: "string" } }, ["type", "id"]) };
const ACTION_TOOLS: Anthropic.Tool[] = [
  { name: "make_image", description: "Make ONE picture. It costs credits, so the person approves it first (you will be told the answer). Write a full, concrete prompt. Make several pictures by calling this several times in one reply: the person approves them together.", input_schema: obj({ prompt: { type: "string" }, model: { type: "string", description: "A model id from list_image_models. Default soul_v2." }, aspect_ratio: { type: "string" }, resolution: { type: "string", description: "1k, 2k or 4k where the model has it." }, references: refs }, ["prompt"]) },
  { name: "make_video", description: "Make ONE video. It costs credits, so the person approves it first. Use pictures you made as references (render ids) so the look stays the same.", input_schema: obj({ prompt: { type: "string" }, model: { type: "string", description: "A model id from list_video_models. Default seedance_2_5." }, duration_seconds: { type: "integer", minimum: 3, maximum: 30 }, aspect_ratio: { type: "string" }, quality: { type: "string", description: "For example 480p, 720p or 1080p, as the model lists." }, sound: { type: "boolean" }, reference_picture_ids: { type: "array", maxItems: 12, items: { type: "string" }, description: "Generation ids of finished pictures to use as references, in order (image 1, image 2 ...)." } }, ["prompt", "duration_seconds"]) },
  { name: "make_voice", description: "Make a voiceover take from a script. It costs credits, so the person approves it first.", input_schema: obj({ text: { type: "string" } }, ["text"]) },
  { name: "send_to_app", description: "Send a message (optionally with one finished picture) to an app the person connected (see list_connected_apps). It goes OUT to the world, so the person ALWAYS approves it first, even on autopilot. Write the exact text to send.", input_schema: obj({ app: { type: "string" }, text: { type: "string" }, generation_id: { type: "string", description: "A finished picture to attach (not a video)." } }, ["app", "text"]) },
  { name: "make_music", description: "Make music from a description (mood, instruments, pace; no artist names or lyrics). It costs credits, so the person approves it first.", input_schema: obj({ prompt: { type: "string" }, seconds: { type: "integer", minimum: 3, maximum: 240 } }, ["prompt"]) },
];
const FLOW_TOOLS: Anthropic.Tool[] = [
  { name: "wait", description: "Pause while something you started is being made. The mission carries on after the pause and you are called again. Use it instead of checking over and over.", input_schema: obj({ seconds: { type: "integer", minimum: 5, maximum: 240 }, reason: { type: "string" } }, ["seconds"]) },
  { name: "ask_user", description: "Ask the person ONE question you cannot answer yourself (taste, a missing fact, a choice between real options). Do not ask what you can decide or look up.", input_schema: obj({ question: { type: "string" } }, ["question"]) },
  { name: "finish", description: "End the mission. Say what you made, where it is (ids), what you checked, and anything the person should know. Only call it when the goal is met, or cannot be met and you have said why.", input_schema: obj({ summary: { type: "string" } }, ["summary"]) },
];
export const MISSION_TOOLS: Anthropic.Tool[] = [...READ_TOOLS, ...ACTION_TOOLS, ...FLOW_TOOLS];
const ACTION_NAMES = new Set(ACTION_TOOLS.map((t) => t.name));

const SYSTEM = `You are Atlas, running a MISSION: the person gave you a goal and you work on it yourself, step by step, until it is done. You are not answering one message; you are carrying out a job.

How you work:
1. Start by reading what you need (their Library, memory, the model lists) and decide a short plan. Write it in one or two lines before the first tool call.
2. Do the next step with a tool. Read the result. Decide again. Keep going without asking for permission to think.
3. Anything that costs credits (make_image, make_video, make_voice, make_music) is only a REQUEST: the person approves it (or it runs inside a budget they set). Group the requests that belong together into one reply so they approve once. If they decline, change the plan; do not ask again for the same thing.
4. LOOK at what you made before you call it good: use check_job until it is completed, then view_render to see a picture. If it is off (wrong subject, bad hands, text errors, not matching the references), say what is wrong and fix it with a better prompt, within the budget. Do not repeat the same prompt hoping for a different result.
5. Use wait while things are made. Do not poll in a tight loop.
6. Ask the person (ask_user) only for what you truly cannot decide. Otherwise make a sensible choice and say which.
7. Be honest. Never claim something is made, seen or checked unless a tool result told you so. If you are stuck or something keeps failing, say so plainly in finish.
8. You can read the person's Library, Gallery (search_library with a project id) and canvases (list_canvases, read_canvas), run their skills (list_skills, use_skill) and send to apps they connected (send_to_app, which ALWAYS waits for their OK, even on autopilot). Never send anything the person did not ask for or agree to.
8b. Keep the person's money in mind: pick the cheapest model that does the job, make as few things as the goal needs, and stay inside any budget you are told.
9. When the goal is met, call finish with a short, concrete summary (what, where, any ids) and stop.`;

// ---- helpers ----
const str = (v: unknown, n = 4000) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const asMsgs = (v: Prisma.JsonValue) => v as unknown as Anthropic.MessageParam[];
const asTrace = (v: Prisma.JsonValue) => v as unknown as TraceItem[];
type Res = { content: string; isError?: boolean; ids?: string[] };
type Call = { id: string; tool: string; input: Record<string, unknown>; price: number | null; summary: string };
export type Pending = { kind: "approval" | "question" | "chat"; question?: string; calls?: Call[]; total?: number | null; results: Record<string, Res>; approved?: boolean; declined?: boolean; answer?: string };
const asPending = (v: Prisma.JsonValue | null) => (v ? (v as unknown as Pending) : null);
const J = (v: unknown) => v as unknown as Prisma.InputJsonValue;
const item = (kind: TraceKind, text: string, ids?: string[]): TraceItem => ({ at: new Date().toISOString(), kind, text: text.slice(0, 900), ...(ids?.length ? { ids } : {}) });

export type MissionDeps = PlanDeps & {
  call: (a: { system: ReturnType<typeof cachedSystem>; tools: Anthropic.ToolUnion[]; messages: Anthropic.MessageParam[] }) => Promise<Anthropic.Message>;
  read: (userId: string, personId: string, name: string, input: Record<string, unknown>) => Promise<{ content: Anthropic.ToolResultBlockParam["content"]; isError?: boolean }>;
};
export const realMissionDeps: MissionDeps = {
  ...realDeps,
  async call({ system, tools, messages }) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 100_000 });
    const model = connectModels.find((m) => m.id === "claude-sonnet-5-5")!.api;
    return client.messages.create({ model, max_tokens: 6000, system, tools: [...tools, ...WEB_TOOLS], messages: cacheLast(messages) as Anthropic.MessageParam[] });
  },
  async read(userId, personId, name, input) {
    if (isCoreTool(name)) return runCoreTool(userId, personId, name, input);
    // skills and connected apps belong to the PERSON, not the team workspace
    const owner = ["list_skills", "use_skill", "list_connected_apps"].includes(name) ? personId : userId;
    const out = await runTool(name, input, { userId: owner, projectId: null, onRender: () => {} });
    return { content: out.text, isError: out.isError };
  },
};

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) => new Promise<T>((res) => { const t = setTimeout(() => res(fallback), ms); p.then((v) => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(fallback); }); });

// ---- quoting and running the spending calls ----
function videoRoute(id: string) { return routeFor(id) === "direct" && Object.keys(DIRECT_KEY).includes(id) && !(arkRouteBlocked() && id.startsWith("seedance")) ? "direct" as const : "higgsfield" as const; }
async function quote(c: { tool: string; input: Record<string, unknown> }, userId: string, personId: string, deps: MissionDeps): Promise<{ price: number | null; summary: string } | { error: string }> {
  const i = c.input;
  if (c.tool === "make_image") {
    const m = findEnabledModel(str(i.model, 80) || "soul_v2");
    if (!m) return { error: "That image model is not available. Use list_image_models." };
    const res = str(i.resolution, 10) || undefined;
    const price = process.env.CREDITS_ENABLED === "1" ? imageCost(toPublic(m), res, 1) : null;
    return { price, summary: `Picture with ${m.label}${str(i.aspect_ratio, 10) ? `, ${str(i.aspect_ratio, 10)}` : ""}: ${str(i.prompt, 90)}` };
  }
  if (c.tool === "make_video") {
    const vm = findVideoModel(str(i.model, 60) || "seedance_2_5");
    if (!vm || !isLive(vm)) return { error: "That video model is not available. Use list_video_models." };
    const seconds = Math.round(Number(i.duration_seconds));
    if (!Number.isFinite(seconds) || seconds < 1) return { error: "Give the clip length in seconds." };
    const caps = capsFor(vm, workflowOf(false, Array.isArray(i.reference_picture_ids) && i.reference_picture_ids.length > 0));
    const quality = str(i.quality, 12) || caps.defaultQuality;
    const price = process.env.CREDITS_ENABLED === "1" ? videoPrice(vm, quality, seconds, i.sound === true, videoRoute(vm.id)) : null;
    return { price, summary: `${seconds}s video with ${vm.label} (${quality}): ${str(i.prompt, 90)}` };
  }
  if (c.tool === "send_to_app") {
    const app = str(i.app, 40), text = str(i.text, 3500);
    if (!app || !text) return { error: "Give the app and the text to send." };
    if (!(await db.connectorLink.findUnique({ where: { userId_connector: { userId: personId, connector: app } }, select: { connector: true } }))) return { error: `${app} is not connected. Use list_connected_apps.` };
    return { price: null, summary: `Send to ${app}: ${text.slice(0, 120)}${i.generation_id ? " (with a picture)" : ""}` }; // never priced, so it always waits for the person
  }
  if (c.tool === "make_voice") {
    const voice = await deps.voice();
    if (!voice) return { error: "A voice is not available right now." };
    const q = await deps.quoteAudio({ userId, kind: "tts", model: VOICE_MODEL, text: str(i.text, 5000), voiceId: voice.id });
    return q.ok ? { price: q.quote, summary: `Voiceover: ${str(i.text, 90)}` } : { error: q.error };
  }
  const secs = Math.min(240, Math.max(3, Math.round(Number(i.seconds)) || 30));
  const q = await deps.quoteAudio({ userId, kind: "music", model: MUSIC_MODEL, text: str(i.prompt, 1000), durationSec: secs, instrumental: true });
  return q.ok ? { price: q.quote, summary: `${secs}s of music: ${str(i.prompt, 90)}` } : { error: q.error };
}

async function runAction(row: AgentMission, c: Call, deps: MissionDeps): Promise<Res> {
  const i = c.input;
  const userId = row.userId, projectId = row.projectId ?? undefined;
  const fail = (e: string): Res => ({ content: e, isError: true });
  if (c.tool === "make_image") {
    const r = await deps.startImage({ userId, prompt: i.prompt, model: str(i.model, 80) || "soul_v2", aspectRatio: str(i.aspect_ratio, 10) || undefined, resolution: str(i.resolution, 10) || undefined, projectId, references: Array.isArray(i.references) ? i.references.slice(0, 16) : undefined });
    return r.ok ? { content: JSON.stringify({ kind: "image", id: r.item.id, status: "pending", note: "Started. Use check_job (kind image) or wait, then view_render to look at it." }), ids: [r.item.id] } : fail(r.error);
  }
  if (c.tool === "make_video") {
    const picked = Array.isArray(i.reference_picture_ids) ? i.reference_picture_ids.filter((x): x is string => typeof x === "string").slice(0, 12).map((id) => ({ type: "render", id })) : [];
    const r = await deps.startVideo({ userId, personId: row.personId, prompt: i.prompt, model: str(i.model, 60) || "seedance_2_5", duration: i.duration_seconds, resolution: str(i.quality, 12) || undefined, aspectRatio: str(i.aspect_ratio, 10) || undefined, audio: i.sound === true, projectId, ...(picked.length ? { refs: picked } : {}) });
    if (!r.ok) return fail(r.needsConfirm ? "The price rose above what was approved, so the video was not started." : r.error);
    return { content: JSON.stringify({ kind: "video", id: r.item.id, status: "pending", note: "Started. Videos take a few minutes: use wait, then check_job (kind video)." }), ids: [r.item.id] };
  }
  if (c.tool === "send_to_app") {
    const r = await performSend(row.personId ?? userId, str(i.app, 40), str(i.text, 3500), str(i.generation_id, 80) || null);
    return r.ok ? { content: `Sent to ${r.to}.` } : fail(r.error);
  }
  if (c.tool === "make_voice") {
    const voice = await deps.voice();
    if (!voice) return fail("A voice is not available right now.");
    const r = await deps.startAudio({ userId, kind: "tts", model: VOICE_MODEL, text: str(i.text, 5000), voiceId: voice.id, voiceName: voice.name, projectId });
    return r.ok ? { content: JSON.stringify({ kind: "audio", id: r.item.id, status: "pending" }), ids: [r.item.id] } : fail(r.error);
  }
  const r = await deps.startAudio({ userId, kind: "music", model: MUSIC_MODEL, text: str(i.prompt, 1000), durationSec: Math.min(240, Math.max(3, Math.round(Number(i.seconds)) || 30)), instrumental: true, projectId });
  return r.ok ? { content: JSON.stringify({ kind: "audio", id: r.item.id, status: "pending" }), ids: [r.item.id] } : fail(r.error);
}

/** The read tools. Pictures are returned separately so they live only for the pass that asked (the saved transcript never holds them). */
async function runRead(row: AgentMission, name: string, input: Record<string, unknown>, deps: MissionDeps): Promise<{ res: Res; blocks?: Anthropic.ToolResultBlockParam["content"] }> {
  if (name === "list_video_models") {
    const list = PICKER_MODELS.filter(isLive).map((m) => { const c = capsFor(m, "t2v"); return { id: m.id, name: m.label, seconds: c.durations, aspect_ratios: c.ratios, qualities: c.qualities, default_quality: c.defaultQuality, reference_pictures_max: c.refMax }; });
    return { res: { content: JSON.stringify(list) } };
  }
  if (name === "list_canvases") {
    const pid = str(input.project_id, 64);
    const rows = await db.canvas.findMany({ where: { userId: row.userId, deletedAt: null, ...(pid ? { projectId: pid } : {}) }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, name: true, projectId: true, nodeCount: true, updatedAt: true } });
    return { res: { content: JSON.stringify(rows.map((c) => ({ canvas_id: c.id, name: c.name, project_id: c.projectId, nodes: c.nodeCount, edited: c.updatedAt.toISOString() }))) } };
  }
  if (name === "read_canvas") {
    const c = await db.canvas.findFirst({ where: { id: str(input.canvas_id, 64), userId: row.userId, deletedAt: null } });
    if (!c) return { res: { content: "No canvas with that id. Use list_canvases.", isError: true } };
    return { res: { content: summariseCanvas(c.name, c.data) } };
  }
  if (name === "check_job") {
    const kind = input.kind === "video" || input.kind === "audio" ? input.kind : "image";
    const id = str(input.id, 80);
    if (!id) return { res: { content: "Give the id.", isError: true } };
    const c = await deps.check(kind, id, row.userId);
    return { res: { content: JSON.stringify({ kind, id, status: c.status, ...(c.error ? { error: c.error } : {}) }) } };
  }
  const r = await deps.read(row.userId, row.personId ?? row.userId, name, input);
  if (Array.isArray(r.content)) {
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { res: { content: text || "Done.", isError: r.isError }, blocks: r.content };
  }
  return { res: { content: String(r.content), isError: r.isError } };
}

/** A canvas as the agent reads it: what each node is and says, and the wires. Pictures are ids only; results are not repeated. */
export function summariseCanvas(name: string, data: unknown): string {
  const d = (data && typeof data === "object" ? data : {}) as { nodes?: unknown; edges?: unknown };
  const nodes = (Array.isArray(d.nodes) ? d.nodes : []).slice(0, 80) as { id?: string; type?: string; data?: Record<string, unknown> }[];
  const edges = (Array.isArray(d.edges) ? d.edges : []).slice(0, 200) as { source?: string; target?: string; targetHandle?: string }[];
  const t = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const out = nodes.map((n) => {
    const x = n.data ?? {};
    const ref = (x.ref && typeof x.ref === "object" ? (x.ref as { id?: unknown }).id : undefined) as string | undefined;
    return { id: n.id, kind: n.type, ...(t(x.title, 80) ? { title: t(x.title, 80) } : {}), ...(t(x.text) ? { text: t(x.text) } : {}), ...(t(x.desc) ? { description: t(x.desc) } : {}), ...(t(x.style, 120) ? { style: t(x.style, 120) } : {}), ...(typeof ref === "string" ? { picture_id: ref } : {}), ...(typeof x.duration === "number" ? { seconds: x.duration } : {}), ...(t(x.model, 60) ? { model: t(x.model, 60) } : {}), ...(t(x.ratio, 12) ? { aspect_ratio: t(x.ratio, 12) } : {}) };
  });
  return JSON.stringify({ name, nodes: out, wires: edges.map((e) => ({ from: e.source, to: e.target, port: e.targetHandle })) });
}

// ---- one pass ----
const userMsg = (calls: Anthropic.ToolUseBlock[], results: Record<string, Res>, withBlocks?: Record<string, Anthropic.ToolResultBlockParam["content"]>): Anthropic.MessageParam => ({
  role: "user",
  content: calls.map((tu) => ({ type: "tool_result" as const, tool_use_id: tu.id, content: withBlocks?.[tu.id] ?? results[tu.id]?.content ?? "No result.", ...(results[tu.id]?.isError ? { is_error: true } : {}) })),
});
const toolUsesOf = (m: Anthropic.MessageParam | undefined) => (m && m.role === "assistant" && Array.isArray(m.content) ? (m.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[]) : []);

type Patch = { messages: Anthropic.MessageParam[]; trace: TraceItem[]; status: MissionStatus; pending: Pending | null; summary?: string; committed: number; rounds: number; wakeAt: Date | null };

async function pass(row: AgentMission, deps: MissionDeps): Promise<Patch> {
  const messages = [...asMsgs(row.messages)];
  const trace = [...asTrace(row.trace)];
  let pending = asPending(row.pending);
  let committed = row.committed;
  let rounds = row.rounds;
  let status: MissionStatus = "running";
  let summary: string | undefined;
  let wakeAt: Date | null = null;
  const meter = new ChatMeter();
  const out = (): Patch => ({ messages, trace, status, pending, ...(summary ? { summary } : {}), committed, rounds, wakeAt });
  const fail = (why: string): Patch => { status = "failed"; summary = why; trace.push(item("error", why)); pending = null; return out(); };

  // 1. a decision the person just made on a waiting step
  if (pending) {
    const last = messages[messages.length - 1];
    const uses = toolUsesOf(last);
    if (pending.kind === "chat") {
      if (pending.answer === undefined) return out();
      messages.push({ role: "user", content: pending.answer });
      trace.push(item("say", `You: ${pending.answer}`));
      pending = null;
    } else if (pending.kind === "question") {
      if (pending.answer === undefined) return out();
      pending.results[uses.find((u) => u.name === "ask_user")?.id ?? ""] = { content: `The person answered: ${pending.answer}` };
      trace.push(item("say", `You: ${pending.answer}`));
      messages.push(userMsg(uses, pending.results));
      pending = null;
    } else if (pending.approved || pending.declined) {
      const calls = pending.calls ?? [];
      const results = pending.results;
      if (pending.declined) {
        for (const c of calls) results[c.id] = { content: "The person declined this request. Change the plan; do not ask for the same thing again.", isError: true };
        trace.push(item("approval", "You declined."));
      } else {
        const need = calls.filter((c) => !results[c.id]);
        const total = need.reduce((s, c) => s + (c.price ?? 0), 0);
        if (total > 0 && (await freeCredits(row.userId)) < total) {
          for (const c of need) results[c.id] = { content: "Not enough credits to make this. Tell the person to top up, or choose something cheaper.", isError: true };
          trace.push(item("error", "Not enough credits for the approved steps."));
        } else {
          for (const c of need) {
            const r = await runAction(row, c, deps);
            results[c.id] = r;
            committed += r.isError ? 0 : c.price ?? 0;
            trace.push(item(r.isError ? "error" : "tool", `${c.summary}${r.isError ? ` — ${r.content}` : " — started"}`, r.ids));
            // saved after every start, so a crash never starts the same thing twice
            await db.agentMission.update({ where: { id: row.id }, data: { pending: J({ ...pending, results }), committed } }).catch(() => {});
          }
        }
      }
      messages.push(userMsg(uses, results));
      pending = null;
    } else return out();
  }

  const convo: Anthropic.MessageParam[] = [...messages]; // like messages, but the pictures a tool returned stay in it for the next call of this pass
  const end = Date.now() + PASS_MS;
  const ctxBlock = () => `<mission>\nGoal: ${row.goal}\n${row.autopilot ? `Autopilot: you may commit up to ${(Math.max(0, row.budget - committed) / LEDGER_UNITS_PER_CREDIT).toFixed(1)} more credits without asking (approved so far ${(committed / LEDGER_UNITS_PER_CREDIT).toFixed(1)}). Anything beyond that waits for the person.` : "Every spending request waits for the person's approval."}\nModel calls used: ${rounds} of ${MAX_ROUNDS}. Time left: ${Math.max(0, Math.round((row.deadlineAt.getTime() - Date.now()) / 60000))} minutes.\n</mission>`;
  try {
    for (let r = 0; r < ROUNDS_PER_PASS && Date.now() < end; r++) {
      if (rounds >= MAX_ROUNDS) { await chargeChat(row.userId, meter, "Atlas mission"); return fail("The mission reached its step limit and was stopped. What it made is in your Gallery."); }
      const res = await deps.call({ system: cachedSystem(`${SYSTEM}\n\n${WEB_NOTE}\n\n${BRAND_RULE}`, ctxBlock()), tools: MISSION_TOOLS, messages: convo });
      rounds++;
      meter.add(res.model, res.usage);
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      if (text) trace.push(item("say", text));
      messages.push({ role: "assistant", content: res.content });
      convo.push({ role: "assistant", content: res.content });
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!uses.length && res.stop_reason === "pause_turn") continue; // the provider paused a long web lookup: carry on
      if (!uses.length) {
        // it spoke to the person without a tool: that is a question or a hand-back; the mission waits for a reply
        status = "waiting_user";
        pending = { kind: "chat", question: text || "Tell me how to go on.", results: {} };
        break;
      }
      const results: Record<string, Res> = {};
      const blocks: Record<string, Anthropic.ToolResultBlockParam["content"]> = {};
      const actions: Call[] = [];
      let ask: string | null = null, done: string | null = null, sleep = 0;
      for (const tu of uses) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        if (tu.name === "finish") { done = str(input.summary, 3000) || "Done."; results[tu.id] = { content: "Mission finished." }; }
        else if (tu.name === "ask_user") { ask = str(input.question, 600) || "What would you like?"; }
        else if (tu.name === "wait") { sleep = Math.min(240, Math.max(5, Math.round(Number(input.seconds)) || 30)); results[tu.id] = { content: `Waited ${sleep} seconds.` }; trace.push(item("note", `Waiting ${sleep}s${str(input.reason, 80) ? ` — ${str(input.reason, 80)}` : ""}`)); }
        else if (ACTION_NAMES.has(tu.name)) {
          const q = await quote({ tool: tu.name, input }, row.userId, row.personId ?? row.userId, deps);
          if ("error" in q) { results[tu.id] = { content: q.error, isError: true }; trace.push(item("error", q.error)); }
          else actions.push({ id: tu.id, tool: tu.name, input, price: q.price, summary: q.summary });
        } else {
          trace.push(item("tool", `${tu.name}${tu.name === "view_render" || tu.name === "check_job" ? "" : ` ${JSON.stringify(input).slice(0, 120)}`}`));
          const rr = await withTimeout(runRead(row, tu.name, input, deps), TOOL_MS, { res: { content: "That took too long and was stopped. Try something smaller.", isError: true } } as Awaited<ReturnType<typeof runRead>>);
          results[tu.id] = rr.res;
          if (rr.blocks) blocks[tu.id] = rr.blocks;
          if (rr.res.isError) trace.push(item("error", rr.res.content.slice(0, 300)));
          else if (tu.name === "check_job" || tu.name === "view_render") trace.push(item("result", tu.name === "view_render" ? "Looked at a picture" : rr.res.content, tu.name === "check_job" ? [str(input.id, 80)] : undefined));
        }
      }
      if (done != null) {
        for (const a of actions) results[a.id] = { content: "Not run: the mission was finished.", isError: true };
        if (ask) results[uses.find((u) => u.name === "ask_user")!.id] = { content: "Not asked: the mission was finished." };
        messages.push(userMsg(uses, results));
        status = "done"; summary = done; pending = null; trace.push(item("note", "Mission finished."));
        break;
      }
      if (ask) {
        for (const a of actions) results[a.id] = { content: "Not run: you asked a question first. Ask again with the request after the answer.", isError: true };
        status = "waiting_user"; pending = { kind: "question", question: ask, results }; trace.push(item("say", ask));
        break;
      }
      if (actions.length) {
        const priced = actions.every((a) => a.price != null);
        const total = priced ? actions.reduce((s, a) => s + (a.price ?? 0), 0) : null;
        if (row.autopilot && total != null && committed + total <= row.budget) {
          if ((await freeCredits(row.userId)) < total) { for (const a of actions) results[a.id] = { content: "Not enough credits. Choose something cheaper or tell the person to top up.", isError: true }; trace.push(item("error", "Not enough credits for the next step.")); }
          else for (const a of actions) {
            const rr = await runAction(row, a, deps);
            results[a.id] = rr; committed += rr.isError ? 0 : a.price ?? 0;
            trace.push(item(rr.isError ? "error" : "tool", `${a.summary}${rr.isError ? ` — ${rr.content}` : " — started (within your budget)"}`, rr.ids));
          }
        } else {
          status = "waiting_approval";
          pending = { kind: "approval", calls: actions, total, results };
          trace.push(item("approval", `Waiting for your OK: ${actions.map((a) => a.summary).join("; ")}`.slice(0, 900)));
          break;
        }
      }
      messages.push(userMsg(uses, results));
      convo.push(userMsg(uses, results, blocks));
      if (sleep) { wakeAt = new Date(Date.now() + sleep * 1000); break; }
    }
  } catch (err) {
    console.error("mission pass failed", row.id, err);
    const recent = trace.slice(-6).filter((t) => t.kind === "error" && t.text.startsWith("The agent hit a problem")).length;
    trace.push(item("error", "The agent hit a problem and will try again."));
    status = recent >= 2 ? "failed" : "running";
    if (status === "failed") summary = "The agent could not carry on after repeated problems. What it made is in your Gallery.";
    else wakeAt = new Date(Date.now() + 20_000);
  } finally {
    await chargeChat(row.userId, meter, "Atlas mission");
  }
  return out();
}

// ---- the public API ----
export function missionView(row: AgentMission): MissionView {
  const p = asPending(row.pending);
  return {
    id: row.id, goal: row.goal, status: row.status as MissionStatus, createdAt: row.createdAt.toISOString(), trace: asTrace(row.trace).slice(-80),
    ...(row.summary ? { summary: row.summary } : {}), committed: row.committed, budget: row.budget, autopilot: row.autopilot,
    ...(p && row.status.startsWith("waiting") ? { waiting: { kind: p.kind, ...(p.question ? { question: p.question } : {}), ...(p.calls ? { calls: p.calls.map((c): MissionCall => ({ id: c.id, tool: c.tool, summary: c.summary, price: c.price })) } : {}), ...(p.total !== undefined ? { total: p.total } : {}) } } : {}),
  };
}
export const listMissions = async (userId: string, limit = 30) => (await db.agentMission.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit })).map(missionView);

export type CreateMission = { ok: true; row: AgentMission } | { ok: false; status: number; error: string };
export async function createMission(o: { userId: string; personId: string | null; projectId: string | null; goal: string; budgetCredits: number; autopilot: boolean }): Promise<CreateMission> {
  const goal = o.goal.trim().slice(0, MAX_GOAL);
  if (goal.length < 8) return { ok: false, status: 400, error: "Describe the goal in a sentence or two." };
  const mod = checkPrompt(goal);
  if (!mod.ok) return { ok: false, status: 422, error: mod.reason };
  if ((await db.agentMission.count({ where: { userId: o.userId, status: { in: ["running", "waiting_approval", "waiting_user"] } } })) >= MAX_RUNNING) return { ok: false, status: 429, error: "You already have missions in progress. Finish or stop one first." };
  const why = await chatCreditCheck(o.userId);
  if (why) return { ok: false, status: 402, error: why };
  const budget = Math.max(0, Math.min(5000, Math.floor(o.budgetCredits))) * LEDGER_UNITS_PER_CREDIT;
  const row = await db.agentMission.create({
    data: {
      userId: o.userId, personId: o.personId, projectId: o.projectId, goal, budget, autopilot: o.autopilot && budget > 0,
      messages: J([{ role: "user", content: `Your mission: ${goal}` }]), trace: J([item("note", "Mission started.")]),
      deadlineAt: new Date(Date.now() + MISSION_MAX_MS),
    },
  });
  return { ok: true, row };
}

/** One pass. Safe to call from anywhere at any time: one caller at a time does the work (a lock row), the others just read. */
export async function advanceMission(id: string, deps: MissionDeps = realMissionDeps): Promise<AgentMission | null> {
  const row = await db.agentMission.findUnique({ where: { id } });
  if (!row || row.status !== "running") return row;
  if (row.deadlineAt.getTime() < Date.now()) return db.agentMission.update({ where: { id }, data: { status: "failed", summary: "The mission took too long and was stopped. What it made is in your Gallery.", lockedAt: null } });
  if (row.wakeAt && row.wakeAt.getTime() > Date.now()) return row;
  const claimed = await db.agentMission.updateMany({ where: { id, status: "running", OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] }, data: { lockedAt: new Date() } });
  if (claimed.count === 0) return db.agentMission.findUnique({ where: { id } });
  try {
    const mine = await db.agentMission.findUnique({ where: { id } });
    if (!mine || mine.status !== "running") { await db.agentMission.updateMany({ where: { id }, data: { lockedAt: null } }); return mine; }
    // a mission only runs while the person can pay for the thinking
    const broke = await chatCreditCheck(mine.userId);
    const p = broke ? ({ messages: asMsgs(mine.messages), trace: [...asTrace(mine.trace), item("error", broke)], status: "failed" as MissionStatus, pending: null, summary: broke, committed: mine.committed, rounds: mine.rounds, wakeAt: null } satisfies Patch) : await pass(mine, deps);
    const fresh = await db.agentMission.findUnique({ where: { id }, select: { status: true } });
    const status = fresh?.status === "canceled" ? "canceled" : p.status;
    return db.agentMission.update({ where: { id }, data: { messages: J(p.messages), trace: J(p.trace), status, pending: p.pending ? J(p.pending) : Prisma.DbNull, summary: p.summary ?? (status === "canceled" ? "Stopped. What it made is in your Gallery." : null), committed: p.committed, rounds: p.rounds, wakeAt: p.wakeAt, lockedAt: null } });
  } catch (err) {
    console.error("mission advance failed", id, err);
    return db.agentMission.update({ where: { id }, data: { lockedAt: null, wakeAt: new Date(Date.now() + 15_000) } });
  }
}

async function openWaiting(id: string, userId: string) {
  const row = await db.agentMission.findFirst({ where: { id, userId } });
  return row && row.status.startsWith("waiting") && row.pending ? row : null;
}
/** Approve or decline the spending requests the agent is waiting on. The state flips atomically, so a double tap or two tabs act once. */
export async function decideMission(id: string, userId: string, approve: boolean): Promise<AgentMission | null> {
  const row = await openWaiting(id, userId);
  const p = row ? asPending(row.pending) : null;
  if (!row || !p || p.kind !== "approval" || row.status !== "waiting_approval") return db.agentMission.findFirst({ where: { id, userId } });
  await db.agentMission.updateMany({ where: { id, userId, status: "waiting_approval" }, data: { status: "running", wakeAt: null, pending: J({ ...p, ...(approve ? { approved: true } : { declined: true }) }) } });
  return db.agentMission.findFirst({ where: { id, userId } });
}
/** The person's answer to a question the agent asked (or a reply after it spoke without a tool). */
export async function answerMission(id: string, userId: string, text: string): Promise<AgentMission | null> {
  const row = await openWaiting(id, userId);
  const p = row ? asPending(row.pending) : null;
  const answer = text.trim().slice(0, 2000);
  if (!row || !p || row.status !== "waiting_user" || !answer) return db.agentMission.findFirst({ where: { id, userId } });
  if (checkPrompt(answer).ok === false) return db.agentMission.findFirst({ where: { id, userId } });
  await db.agentMission.updateMany({ where: { id, userId, status: "waiting_user" }, data: { status: "running", wakeAt: null, pending: J({ ...p, answer }) } });
  return db.agentMission.findFirst({ where: { id, userId } });
}
export async function cancelMission(id: string, userId: string): Promise<AgentMission | null> {
  const r = await db.agentMission.updateMany({ where: { id, userId, status: { in: ["running", "waiting_approval", "waiting_user"] } }, data: { status: "canceled", summary: "Stopped. What it made is in your Gallery.", pending: Prisma.DbNull } });
  if (r.count) await db.agentMission.update({ where: { id }, data: { trace: J([...asTrace((await db.agentMission.findUniqueOrThrow({ where: { id } })).trace), item("note", "Stopped by you.")]) } }).catch(() => {});
  return db.agentMission.findFirst({ where: { id, userId } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Advances a mission until it needs the person or the time is up; then hands over to a fresh function so it never depends on a browser. */
export async function driveMission(id: string, deps: MissionDeps = realMissionDeps, budgetMs = DRIVE_MS, chainOn = true): Promise<AgentMission | null> {
  const end = Date.now() + budgetMs;
  let row = await advanceMission(id, deps);
  while (row && row.status === "running" && Date.now() < end) {
    await sleep(POLL_MS);
    row = await advanceMission(id, deps);
  }
  if (row && row.status === "running" && chainOn) await chain(id);
  return row;
}

const secret = () => serverSecret(process.env.CRON_SECRET, process.env.CLERK_SECRET_KEY);
export const missionToken = (id: string) => createHmac("sha256", secret()).update(`mission:${id}`).digest("hex");
export function validMissionToken(id: string, given: string | null): boolean {
  const a = Buffer.from(given ?? ""), b = Buffer.from(missionToken(id));
  return a.length === b.length && timingSafeEqual(a, b);
}
const base = () => (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
async function chain(id: string) {
  try { await fetch(`${base()}/api/agent/missions/${id}/continue`, { method: "POST", headers: { "x-mission-token": missionToken(id) }, signal: AbortSignal.timeout(8000) }); }
  catch (err) { console.error("mission hand-over failed (the daily job or the next look will carry on)", err); }
}
/** Keeps a mission going after the reply has been sent. */
export const driveMissionInBackground = (id: string) => waitUntil(driveMission(id).then(() => undefined).catch((e) => console.error("mission drive failed", e)));
