"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENT_KEY, AGENTS } from "@/components/workspace/AgentPicker";

export const AGENT_ON_KEY = "eclipse-agent-on";
const EVENT = "eclipse-agent-change";

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
    try { if (name) localStorage.setItem(AGENT_KEY, name); else localStorage.removeItem(AGENT_KEY); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const setOn = useCallback((v: boolean) => {
    try { localStorage.setItem(AGENT_ON_KEY, v ? "1" : "0"); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { agent, on, active: on && !!agent, setAgent, setOn };
}
