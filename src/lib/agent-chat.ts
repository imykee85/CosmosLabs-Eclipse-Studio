"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PERSONAS } from "./agent-personas";
import { refreshCredits } from "@/lib/use-credits";
import { buildProposal, type Proposal } from "./agent-proposal";

// The conversation between the user and a studio agent. One chat per agent, kept in this browser and shared live by everything that shows it
// (the floating agent's card, the Image Studio prompt box, a canvas generator). The agent only PROPOSES: its replies carry buttons, and the screen the
// user is on (the "host") does the work when one is pressed.
export type Act = { id: string; kind: "generate" | "use_prompt" | "reply"; label: string; prompt?: string; count?: number; used?: boolean };
// A frame Atlas captured from a video: saved to the user's Assets (an upload), shown in the chat with buttons to use it.
export type Frame = { id: string; label: string; sec: number; used?: string };
// A picture or video the person added in the chat itself (the paperclip): already uploaded, so only its id travels with the message.
export type Attach = { kind: "picture" | "video"; id: string; name: string };
export type AttachedDoc = { name: string; text?: string; pdf?: string };
export type Msg = { id: string; role: "user" | "agent"; text: string; actions?: Act[]; frames?: Frame[]; attach?: { kind: "picture" | "video"; name: string; id?: string }[]; docs?: { name: string; text?: string }[]; proposal?: Proposal; error?: boolean; note?: boolean; seen?: { pictures: { type: "upload" | "render"; id: string; role: string }[]; videos: { id: string; label: string; role: string }[] } };

// What Atlas may set on the prompt box for the person (owner 2026-10-21): the same controls they can reach by hand. Applying costs nothing; Generate still needs their button.
export type ControlPatch = { model?: string; ratio?: string; count?: number; quality?: string; duration?: number; sound?: boolean; fixed_seed?: boolean; prompt?: string };

export type AgentHost = {
  page: "studio" | "canvas" | "treatment" | "video" | "core";
  // Everything on and in the prompt box, as the person sees it: the text, the other settings, the pictures and clips attached (ids only: the server
  // loads the pictures itself, owner-checked, and shows them to the agent), and the message showing on the box's top edge (an error or a notice).
  context: () => { prompt: string; ratio?: string; qty?: number; model?: string; ingredients?: number; settings?: string[]; message?: string; pictures?: { type: "upload" | "render"; id: string; role?: string }[]; clips?: string[]; videos?: { id: string; label: string; role?: string }[] };
  setPrompt: (text: string) => void;
  // Starts the render. Resolves with "" when it started, or a plain reason when it could not.
  generate: (opts: { prompt?: string; count?: number }) => Promise<string>;
  // Puts a captured frame (an upload) into the box as the start frame or as an ingredient. Resolves with "" when done, or a plain reason. Screens without it just keep the frame in Assets.
  useFrame?: (frame: { id: string; label: string }, as: "start" | "ingredient") => Promise<string> | string;
  // The settings Atlas can change right now (plain lines it reads, with the values that are valid) and the way to apply a choice. Returns what was set, then what was refused.
  controls?: { options: () => string[]; apply: (patch: ControlPatch) => { set: string[]; refused: string[] } };
};
let host: AgentHost | null = null;
export function useAgentHost(h: AgentHost) {
  const ref = useRef(h);
  ref.current = h;
  const can = !!h.useFrame;
  const ctl = !!h.controls;
  useEffect(() => {
    const proxy: AgentHost = {
      page: h.page, context: () => ref.current.context(), setPrompt: (t) => ref.current.setPrompt(t), generate: (o) => ref.current.generate(o),
      useFrame: can ? (f, as) => ref.current.useFrame?.(f, as) ?? "" : undefined,
      controls: ctl ? { options: () => ref.current.controls?.options() ?? [], apply: (p) => ref.current.controls?.apply(p) ?? { set: [], refused: [] } } : undefined,
    };
    host = proxy;
    return () => { if (host === proxy) host = null; };
  }, [h.page, can, ctl]);
}

const KEY = (agent: string) => `eclipse-agent-chat-${agent}`;
const EVENT = "eclipse-agent-chat";
const uid = () => Math.random().toString(36).slice(2, 10);
const cache = new Map<string, Msg[]>();

function read(agent: string): Msg[] {
  const hit = cache.get(agent);
  if (hit) return hit;
  let list: Msg[] = [];
  try { const raw = JSON.parse(localStorage.getItem(KEY(agent)) ?? "[]"); if (Array.isArray(raw)) list = raw.filter((m) => m && typeof m.text === "string").slice(-60); } catch {}
  cache.set(agent, list);
  return list;
}
function write(agent: string, list: Msg[]) {
  const next = list.slice(-60);
  cache.set(agent, next);
  try { localStorage.setItem(KEY(agent), JSON.stringify(next)); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: agent }));
}

// Earlier chats with an agent: "New chat" files the current one here, History lists them and opens one again. Kept in this browser like the chat itself.
export type PastChat = { id: string; at: number; title: string; messages: Msg[] };
const HKEY = (agent: string) => `eclipse-agent-history-${agent}`;
const MAX_PAST = 30;
function readPast(agent: string): PastChat[] {
  try { const raw = JSON.parse(localStorage.getItem(HKEY(agent)) ?? "[]"); if (Array.isArray(raw)) return raw.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)); } catch {}
  return [];
}
function writePast(agent: string, list: PastChat[]) {
  try { localStorage.setItem(HKEY(agent), JSON.stringify(list.slice(0, MAX_PAST))); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: agent }));
}
// Files the current chat (when it has something in it) at the top of the history.
function archive(agent: string) {
  const cur = read(agent);
  if (!cur.some((m) => m.role === "user")) return;
  const first = cur.find((m) => m.role === "user")?.text ?? "Chat";
  writePast(agent, [{ id: uid(), at: Date.now(), title: first.replace(/\s+/g, " ").slice(0, 48), messages: cur }, ...readPast(agent)]);
}

// Chats fetched from the account (another device, or after logging in again) replace the copy held in memory.
if (typeof window !== "undefined") {
  window.addEventListener("eclipse-sync-pulled", (e) => {
    for (const key of ((e as CustomEvent<string[]>).detail ?? [])) {
      if (key.startsWith("eclipse-agent-chat-")) { const agent = key.slice("eclipse-agent-chat-".length); cache.delete(agent); window.dispatchEvent(new CustomEvent(EVENT, { detail: agent })); }
      else if (key.startsWith("eclipse-agent-history-")) window.dispatchEvent(new CustomEvent(EVENT, { detail: key.slice("eclipse-agent-history-".length) }));
    }
  });
}

let busyAgents = new Set<string>();

// Replies being written on the server. Kept in this browser so that a reply started on one page is collected on the next, even after the browser was closed.
const RUNS = "eclipse-agent-runs";
type PendingRun = { agent: string; runId: string; page: string };
function readRuns(): PendingRun[] {
  try { const raw = JSON.parse(localStorage.getItem(RUNS) ?? "[]"); return Array.isArray(raw) ? raw.filter((r) => r && typeof r.runId === "string" && typeof r.agent === "string") : []; } catch { return []; }
}
function writeRuns(list: PendingRun[]) {
  try { localStorage.setItem(RUNS, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: "" }));
}
export function hasPendingRun(agent: string): boolean {
  return readRuns().some((r) => r.agent === agent);
}
const following = new Set<string>();
function addTo(agent: string, m: Omit<Msg, "id">) { write(agent, [...read(agent), { ...m, id: uid() } as Msg]); }

// Shows a finished reply in the chat it belongs to, and applies the box settings it chose when the same screen is still open.
function showReply(agent: string, page: string, status: number, body: Record<string, unknown>) {
  if (status !== 200) { addTo(agent, { role: "agent", text: typeof body.error === "string" ? body.error : "The agent couldn't answer. Please try again.", error: true }); return; }
  const data = body as { text?: string; actions?: Omit<Act, "id">[]; frames?: Frame[]; controls?: ControlPatch };
  const all: Act[] = Array.isArray(data.actions) ? data.actions.map((a) => ({ ...a, id: uid() })) : [];
  const frames: Frame[] = Array.isArray(data.frames) ? data.frames.filter((f) => f && typeof f.id === "string").slice(0, 8).map((f) => ({ id: f.id, label: String(f.label ?? "Frame"), sec: Number(f.sec) || 0 })) : [];
  // A new prompt and/or new box settings become ONE proposal card (Apply, Apply and generate); nothing is changed until the person presses a button.
  const ctx = host?.page === page ? host.context() : { prompt: "" };
  const proposal = buildProposal(page, data.controls as Record<string, unknown> | undefined, all, ctx);
  const actions = proposal ? all.filter((a) => a.kind === "reply") : all;
  addTo(agent, { role: "agent", text: String(data.text ?? ""), actions, ...(proposal ? { proposal } : {}), ...(frames.length ? { frames } : {}) });
}

// Waits for a reply started on the server and shows it when it is ready. Safe to call again for a reply already being followed.
async function followRun(agent: string, runId: string, page: string) {
  if (following.has(runId)) return;
  following.add(runId);
  if (!readRuns().some((r) => r.runId === runId)) writeRuns([...readRuns(), { agent, runId, page }]);
  try {
    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, i < 10 ? 1500 : 3000));
      let d: { status?: string; result?: { status: number; body: Record<string, unknown> } };
      try {
        const res = await fetch(`/api/agent/runs/${runId}`);
        if (res.status === 404) break; // gone (or not yours): nothing more to wait for
        d = await res.json();
      } catch { continue; }
      if (d.status === "pending" || !d.result) continue;
      showReply(agent, page, d.result.status, d.result.body);
      await fetch(`/api/agent/runs/${runId}`, { method: "DELETE" }).catch(() => {});
      break;
    }
  } finally {
    following.delete(runId);
    writeRuns(readRuns().filter((r) => r.runId !== runId));
    refreshCredits();
  }
}
// Replies still being written when the app opens again are picked up here.
if (typeof window !== "undefined") {
  for (const r of readRuns()) void followRun(r.agent, r.runId, r.page);
}

export function useAgentChat(agent: string | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const messages = agent ? read(agent) : [];
  const busy = !!agent && (busyAgents.has(agent) || hasPendingRun(agent));
  const setBusy = (v: boolean) => { if (!agent) return; v ? busyAgents.add(agent) : busyAgents.delete(agent); window.dispatchEvent(new CustomEvent(EVENT, { detail: agent })); };

  const add = useCallback((m: Omit<Msg, "id">) => { if (agent) write(agent, [...read(agent), { ...m, id: uid() }]); }, [agent]);

  // The agent introduces itself (written per agent, no model call). Not repeated if its introduction is already the last thing said.
  const introduce = useCallback(() => {
    if (!agent || !PERSONAS[agent]) return;
    const text = PERSONAS[agent].intro;
    const last = read(agent)[read(agent).length - 1];
    if (last?.role === "agent" && last.text === text) return;
    add({ role: "agent", text });
  }, [agent, add]);

  const send = useCallback(async (raw: string, atts: Attach[] = [], docs: AttachedDoc[] = []) => {
    const text = raw.trim();
    if (!agent || !text || busyAgents.has(agent)) return;
    add({ role: "user", text, ...(atts.length ? { attach: atts.map((a) => ({ kind: a.kind, name: a.name, id: a.id })) } : {}), ...(docs.length ? { docs: docs.map((d) => ({ name: d.name, text: d.text })) } : {}) });
    await ask(atts, docs);
  }, [agent, add]); // eslint-disable-line react-hooks/exhaustive-deps

  // Asks the agent about the chat as it stands now (its last message is the person's). The reply is written on the server, so it
  // keeps going if the person leaves the page; the browser collects it (followRun) and shows it when it is ready.
  const ask = useCallback(async (atts: Attach[], docs: AttachedDoc[] = []) => {
    if (!agent) return;
    setBusy(true);
    try {
      const base = host?.context() ?? { prompt: "" };
      // What was added in the chat goes first, then what is attached to the prompt box.
      const pictures = [...atts.filter((a) => a.kind === "picture").map((a) => ({ type: "upload" as const, id: a.id, role: "added in the chat" })), ...(base.pictures ?? [])];
      const videos = [...atts.filter((a) => a.kind === "video").map((a) => ({ id: a.id, label: a.name, role: "added in the chat" })), ...(base.videos ?? [])];
      // The newest message remembers what it was shown with, so the agent still has it in later turns.
      const list = read(agent);
      const lastUser = list.map((m) => m.role).lastIndexOf("user");
      if (lastUser >= 0) write(agent, list.map((m, i) => (i === lastUser ? { ...m, seen: { pictures: pictures.map((p) => ({ type: p.type, id: p.id, role: p.role ?? "" })), videos: videos.map((v) => ({ id: v.id, label: v.label, role: v.role ?? "" })) } } : m)));
      // Text documents are part of the message they were attached to (kept with the chat, deleted with it); PDFs go once, with the message that carries them.
      const history = read(agent).filter((m) => !m.note).map((m) => ({ role: m.role, text: m.text + (m.docs ?? []).filter((d) => d.text !== undefined).map((d) => `\n\n[Attached file: ${d.name}]\n${d.text}`).join(""), ...(m.seen ? { seen: m.seen } : {}) }));
      const pdfs = docs.filter((d) => d.pdf !== undefined).map((d) => ({ name: d.name, pdf: d.pdf }));
      const page = host?.page ?? "studio";
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, background: true, messages: history, documents: pdfs, context: { page, ...base, pictures, videos, options: host?.controls?.options() } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.runId !== "string") { add({ role: "agent", text: typeof data.error === "string" ? data.error : "The agent couldn't answer. Please try again.", error: true }); return; }
      await followRun(agent, data.runId, page);
    } catch {
      add({ role: "agent", text: "I couldn't reach the server. Check your connection and try again.", error: true });
    } finally { setBusy(false); refreshCredits(); }
  }, [agent, add]); // eslint-disable-line react-hooks/exhaustive-deps

  // The pictures or clips a sent message carried, so a retry or an edited message sends them again.
  const attsOf = (m: Msg | undefined): Attach[] => (m?.attach ?? []).filter((a): a is Attach => !!a.id).map((a) => ({ kind: a.kind, id: a.id, name: a.name }));
  // Try again (owner 2026-10-19): the answer and anything after it are dropped and the message before it is asked again.
  const retry = useCallback(async (msgId: string) => {
    if (!agent || busyAgents.has(agent)) return;
    const list = read(agent);
    const at = list.findIndex((m) => m.id === msgId);
    if (at < 0) return;
    const before = list.slice(0, at);
    while (before.length && before[before.length - 1].note) before.pop();
    const last = before[before.length - 1];
    if (last?.role !== "user") return;
    write(agent, before);
    await ask(attsOf(last));
  }, [agent, ask]);
  // Edit a sent message and send it again: it is replaced and everything after it is dropped.
  const resend = useCallback(async (msgId: string, raw: string) => {
    const text = raw.trim();
    if (!agent || !text || busyAgents.has(agent)) return;
    const list = read(agent);
    const at = list.findIndex((m) => m.id === msgId && m.role === "user");
    if (at < 0) return;
    write(agent, [...list.slice(0, at), { ...list[at], text }]);
    await ask(attsOf(list[at]));
  }, [agent, ask]);

  // The user pressed one of the agent's buttons.
  const run = useCallback(async (msgId: string, actId: string) => {
    if (!agent) return;
    const msg = read(agent).find((m) => m.id === msgId);
    const act = msg?.actions?.find((a) => a.id === actId);
    if (!msg || !act || act.used) return;
    const mark = () => write(agent, read(agent).map((m) => (m.id === msgId ? { ...m, actions: m.actions?.map((a) => (a.id === actId ? { ...a, used: true } : a)) } : m)));
    if (act.kind === "reply") { mark(); await send(act.label); return; }
    if (!host) { add({ role: "agent", text: "Open Image Studio or a canvas generator and I can do that there.", note: true }); return; }
    if (act.kind === "use_prompt") { host.setPrompt(act.prompt ?? ""); mark(); add({ role: "agent", text: host.page === "core" ? "Done. It's in your message box." : "Done. The prompt is in your prompt box.", note: true }); return; }
    mark();
    add({ role: "agent", text: "Approved. Starting it now.", note: true });
    const why = await host.generate({ prompt: act.prompt, count: act.count });
    add({ role: "agent", text: why ? `I couldn't start it: ${why}` : host.page === "core" ? "Sent to Core." : "It's rendering. Watch the preview; it keeps going if you leave.", note: true, error: !!why });
  }, [agent, add, send]);

  // The user pressed Apply (or Apply and generate) on a proposal: the prompt and settings go into the box; the second button then starts the render too.
  const applyProposal = useCallback(async (msgId: string, andGenerate: boolean) => {
    if (!agent) return;
    const msg = read(agent).find((m) => m.id === msgId);
    const p = msg?.proposal;
    if (!msg || !p || p.applied) return;
    if (!host || host.page !== p.page) { add({ role: "agent", text: "Open that studio and I can apply this there.", note: true }); return; }
    const patch: ControlPatch = { ...(p.controls as ControlPatch), ...(p.prompt ? { prompt: p.prompt } : {}) };
    let refused: string[] = [];
    if (Object.keys(p.controls).length && host.controls) refused = host.controls.apply(patch).refused;
    else if (p.prompt) host.setPrompt(p.prompt);
    write(agent, read(agent).map((m) => (m.id === msgId ? { ...m, proposal: { ...p, applied: andGenerate ? "generate" : "apply" } } : m)));
    window.dispatchEvent(new CustomEvent("eclipse-agent-nod"));
    if (refused.length) add({ role: "agent", text: `I couldn't set: ${refused.join(" ")}`, note: true, error: true });
    if (!andGenerate) { add({ role: "agent", text: host.page === "core" ? "Applied. It's in your message box." : "Applied to your prompt box.", note: true }); return; }
    await new Promise((r) => setTimeout(r, 250)); // let the screen take the new settings before it reads them
    const why = await host.generate({ prompt: p.prompt, count: p.count });
    add({ role: "agent", text: why ? `Applied, but I couldn't start it: ${why}` : host.page === "core" ? "Applied and sent to Core." : "Applied. It's rendering. Watch the preview; it keeps going if you leave.", note: true, error: !!why });
  }, [agent, add]);

  // The user pressed "Use as start frame" / "Use as ingredient" under a captured frame.
  const useFrame = useCallback(async (msgId: string, frameId: string, as: "start" | "ingredient") => {
    if (!agent || !host?.useFrame) return;
    const f = read(agent).find((m) => m.id === msgId)?.frames?.find((x) => x.id === frameId);
    if (!f) return;
    const why = await host.useFrame({ id: f.id, label: f.label }, as);
    if (why) { add({ role: "agent", text: why, note: true, error: true }); return; }
    write(agent, read(agent).map((m) => (m.id === msgId ? { ...m, frames: m.frames?.map((x) => (x.id === frameId ? { ...x, used: as } : x)) } : m)));
  }, [agent, add]);

  const clear = useCallback(() => { if (agent) write(agent, []); }, [agent]);
  const past = agent ? readPast(agent) : [];
  // A fresh chat: the current one is kept in the history first.
  const newChat = useCallback(() => { if (!agent || busyAgents.has(agent)) return; archive(agent); write(agent, []); }, [agent]);
  const openPast = useCallback((id: string) => {
    if (!agent || busyAgents.has(agent)) return;
    const hit = readPast(agent).find((c) => c.id === id);
    if (!hit) return;
    const rest = readPast(agent).filter((c) => c.id !== id);
    writePast(agent, rest);
    archive(agent);
    write(agent, hit.messages);
  }, [agent]);
  const deletePast = useCallback((id: string) => { if (agent) writePast(agent, readPast(agent).filter((c) => c.id !== id)); }, [agent]);
  return { messages, busy, send, retry, resend, run, applyProposal, useFrame, introduce, clear, past, newChat, openPast, deletePast };
}

/** True when the screen the user is on can take a captured frame into its prompt box. */
export const canUseFrame = () => !!host?.useFrame;

/** What the open screen has in its prompt box right now (null when none is open), and which screen it is. */
export const readHostContext = () => (host ? host.context() : null);
export const hostPage = () => host?.page;
