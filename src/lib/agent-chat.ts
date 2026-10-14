"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PERSONAS } from "./agent-personas";

// The conversation between the user and a studio agent. One chat per agent, kept in this browser and shared live by everything that shows it
// (the floating agent's card, the Image Studio prompt box, a canvas generator). The agent only PROPOSES: its replies carry buttons, and the screen the
// user is on (the "host") does the work when one is pressed.
export type Act = { id: string; kind: "generate" | "use_prompt" | "reply"; label: string; prompt?: string; count?: number; used?: boolean };
// A frame Atlas captured from a video: saved to the user's Assets (an upload), shown in the chat with buttons to use it.
export type Frame = { id: string; label: string; sec: number; used?: string };
// A picture or video the person added in the chat itself (the paperclip): already uploaded, so only its id travels with the message.
export type Attach = { kind: "picture" | "video"; id: string; name: string };
export type Msg = { id: string; role: "user" | "agent"; text: string; actions?: Act[]; frames?: Frame[]; attach?: { kind: "picture" | "video"; name: string }[]; error?: boolean; note?: boolean };

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
};
let host: AgentHost | null = null;
export function useAgentHost(h: AgentHost) {
  const ref = useRef(h);
  ref.current = h;
  const can = !!h.useFrame;
  useEffect(() => {
    const proxy: AgentHost = { page: h.page, context: () => ref.current.context(), setPrompt: (t) => ref.current.setPrompt(t), generate: (o) => ref.current.generate(o), useFrame: can ? (f, as) => ref.current.useFrame?.(f, as) ?? "" : undefined };
    host = proxy;
    return () => { if (host === proxy) host = null; };
  }, [h.page, can]);
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

let busyAgents = new Set<string>();

export function useAgentChat(agent: string | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const messages = agent ? read(agent) : [];
  const busy = !!agent && busyAgents.has(agent);
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

  const send = useCallback(async (raw: string, atts: Attach[] = []) => {
    const text = raw.trim();
    if (!agent || !text || busyAgents.has(agent)) return;
    add({ role: "user", text, ...(atts.length ? { attach: atts.map((a) => ({ kind: a.kind, name: a.name })) } : {}) });
    setBusy(true);
    try {
      const history = read(agent).filter((m) => !m.note).map((m) => ({ role: m.role, text: m.text }));
      const base = host?.context() ?? { prompt: "" };
      // What was added in the chat goes first, then what is attached to the prompt box.
      const pictures = [...atts.filter((a) => a.kind === "picture").map((a) => ({ type: "upload" as const, id: a.id, role: "added in the chat" })), ...(base.pictures ?? [])];
      const videos = [...atts.filter((a) => a.kind === "video").map((a) => ({ id: a.id, label: a.name, role: "added in the chat" })), ...(base.videos ?? [])];
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, messages: history, context: { page: host?.page ?? "studio", ...base, pictures, videos } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { add({ role: "agent", text: typeof data.error === "string" ? data.error : "The agent couldn't answer. Please try again.", error: true }); return; }
      const actions: Act[] = Array.isArray(data.actions) ? data.actions.map((a: Omit<Act, "id">) => ({ ...a, id: uid() })) : [];
      const frames: Frame[] = Array.isArray(data.frames) ? data.frames.filter((f: Frame) => f && typeof f.id === "string").slice(0, 8).map((f: Frame) => ({ id: f.id, label: String(f.label ?? "Frame"), sec: Number(f.sec) || 0 })) : [];
      add({ role: "agent", text: String(data.text ?? ""), actions, ...(frames.length ? { frames } : {}) });
    } catch {
      add({ role: "agent", text: "I couldn't reach the server. Check your connection and try again.", error: true });
    } finally { setBusy(false); }
  }, [agent, add]); // eslint-disable-line react-hooks/exhaustive-deps

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
  return { messages, busy, send, run, useFrame, introduce, clear, past, newChat, openPast, deletePast };
}

/** True when the screen the user is on can take a captured frame into its prompt box. */
export const canUseFrame = () => !!host?.useFrame;
