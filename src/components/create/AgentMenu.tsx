"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import AgentIcon from "../AgentIcon";
import SoonTag from "../SoonTag";
import { AGENTS, AGENT_KEY } from "../workspace/AgentPicker";

// A small pop-up above the Agents chip listing the agents. The choice is the same one the Agents page keeps
// (remembered in this browser); choose it again to clear it.
export default function AgentMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    try { const saved = localStorage.getItem(AGENT_KEY); if (saved && AGENTS.includes(saved)) setSelected(saved); } catch {}
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(name: string) {
    const next = selected === name ? null : name;
    setSelected(next);
    try { if (next) localStorage.setItem(AGENT_KEY, next); else localStorage.removeItem(AGENT_KEY); } catch {}
    onClose();
  }

  const width = 220;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  return (
    <>
      <div className="am-scrim" onMouseDown={onClose} onTouchStart={onClose} />
      <div className="am-menu" role="menu" aria-label="Agents" style={{ left, width, bottom: window.innerHeight - anchor.top + 8 }}>
        {AGENTS.map((name) => (
          <button key={name} type="button" role="menuitemradio" aria-checked={selected === name} className="am-item" onClick={() => choose(name)}>
            <AgentIcon size={16} />
            <span>{name}</span>
            <SoonTag />
            {selected === name && <Check size={15} className="am-check" />}
          </button>
        ))}
      </div>
    </>
  );
}
