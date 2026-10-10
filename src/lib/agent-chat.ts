"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PERSONAS } from "./agent-personas";

// The conversation between the user and a studio agent. One chat per agent, kept in this browser and shared live by everything that shows it
// (the floating agent's card, the Image Studio prompt box, a canvas generator). The agent only PROPOSES: its replies carry buttons, and the screen the
// user is on (the "host") does the work when one is pressed.
export type Act = { id: string; kind: "generate" | "use_prompt" | "reply"; label: string; prompt?: string; count?: number; used?: boolean };
export type Msg = { id: string; role: "user" | "agent"; text: string; actions?: Act[]; error?: boolean; note?: boolean };

export type AgentHost = {
  page: "studio" | "canvas";
  context: () => { prompt: string; ratio?: string; qty?: number; model?: string; ingredients?: number };
  setPrompt: (text: string) => void;
  // Starts the render. Resolves with "" when it started, or a plain reason when it could not.
  generate: (opts: { prompt?: string; count?: number }) => Promise<string>;
};
let host: AgentHost | null = null;
export function useAgentHost(h: AgentHost) {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const proxy: AgentHost = { page: h.page, context: () => ref.current.context(), setPrompt: (t) => ref.current.setPrompt(t), generate: (o) => ref.current.generate(o) };
    host = proxy;
    return () => { if (host === proxy) host = null; };
  }, [h.page]);
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

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!agent || !text || busyAgents.has(agent)) return;
    add({ role: "user", text });
    setBusy(true);
    try {
      const history = read(agent).filter((m) => !m.note).map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, messages: history, context: { page: host?.page ?? "studio", ...(host?.context() ?? {}) } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { add({ role: "agent", text: typeof data.error === "string" ? data.error : "The agent couldn't answer. Please try again.", error: true }); return; }
      const actions: Act[] = Array.isArray(data.actions) ? data.actions.map((a: Omit<Act, "id">) => ({ ...a, id: uid() })) : [];
      add({ role: "agent", text: String(data.text ?? ""), actions });
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
    if (act.kind === "use_prompt") { host.setPrompt(act.prompt ?? ""); mark(); add({ role: "agent", text: "Done. The prompt is in your prompt box.", note: true }); return; }
    mark();
    add({ role: "agent", text: "Approved. Starting it now.", note: true });
    const why = await host.generate({ prompt: act.prompt, count: act.count });
    add({ role: "agent", text: why ? `I couldn't start it: ${why}` : "It's rendering. Watch the preview; it keeps going if you leave.", note: true, error: !!why });
  }, [agent, add, send]);

  const clear = useCallback(() => { if (agent) write(agent, []); }, [agent]);
  return { messages, busy, send, run, introduce, clear };
}
