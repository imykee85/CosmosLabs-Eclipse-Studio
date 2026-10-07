"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";

const AGENTS = ["Agent 1", "Agent 2", "Agent 3"];
const AGENT_KEY = "eclipse-agent";

// Pick one agent; the choice is remembered in this browser. Select it again to clear.
export default function AgentPicker() {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AGENT_KEY);
      if (saved && AGENTS.includes(saved)) setSelected(saved);
    } catch {}
  }, []);

  function choose(name: string) {
    const next = selected === name ? null : name;
    setSelected(next);
    try {
      if (next) localStorage.setItem(AGENT_KEY, next);
      else localStorage.removeItem(AGENT_KEY);
    } catch {}
  }

  return (
    <div className="ws-kinds" role="group" aria-label="Agents">
      {AGENTS.map((name) => {
        const on = selected === name;
        return (
          <button key={name} type="button" className={`ws-kind ws-pick ${on ? "is-selected" : ""}`} aria-pressed={on} onClick={() => choose(name)}>
            <span className="ws-card-icon"><AgentIcon size={20} /></span>
            <h2>{name}</h2>
            <p>A creative partner for your project.</p>
            <span className="ws-pick-state">{on ? <><Check size={15} /> Selected</> : "Select"}</span>
          </button>
        );
      })}
    </div>
  );
}
