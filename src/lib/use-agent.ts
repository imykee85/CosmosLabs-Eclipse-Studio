"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENT_KEY, AGENTS } from "@/components/workspace/AgentPicker";

export const AGENT_ON_KEY = "eclipse-agent-on";
const EVENT = "eclipse-agent-change";

// A one-off cue for the floating agent: it spins and introduces itself when switched on, and bounces and introduces itself when you switch to another agent.
export type AgentCue = { kind: "on" | "switch"; agent: string };
export const CUE_EVENT = "eclipse-agent-cue";
let pendingCue: AgentCue | null = null;
export const takeCue = (): AgentCue | null => { const c = pendingCue; pendingCue = null; return c; };
const sendCue = (c: AgentCue) => { pendingCue = c; window.dispatchEvent(new Event(CUE_EVENT)); };

// The chosen agent and its on/off switch: one choice for the whole app, remembered in this browser, and shared live between everything that shows it
// (Image Studio, every canvas generator, the floating agent).
export function useAgent() {
  const [agent, setAgentState] = useState<string | null>(null);
  const [on, setOnState] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const a = localStorage.getItem(AGENT_KEY);
        setAgentState(a && AGENTS.includes(a) ? a : null);
        setOnState(localStorage.getItem(AGENT_ON_KEY) === "1");
      } catch {}
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, []);
  const setAgent = useCallback((name: string | null) => {
    let was: string | null = null, isOn = false;
    try { was = localStorage.getItem(AGENT_KEY); isOn = localStorage.getItem(AGENT_ON_KEY) === "1"; } catch {}
    try { if (name) localStorage.setItem(AGENT_KEY, name); else localStorage.removeItem(AGENT_KEY); } catch {}
    window.dispatchEvent(new Event(EVENT));
    if (name && isOn && name !== was) sendCue({ kind: "switch", agent: name });
  }, []);
  const setOn = useCallback((v: boolean) => {
    let a: string | null = null;
    try { localStorage.setItem(AGENT_ON_KEY, v ? "1" : "0"); a = localStorage.getItem(AGENT_KEY); } catch {}
    if (v && a) sendCue({ kind: "on", agent: a });
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { agent, on, active: on && !!agent, setAgent, setOn };
}
