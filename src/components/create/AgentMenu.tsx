"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import AgentIcon from "../AgentIcon";
import SoonTag from "../SoonTag";
import { AGENTS } from "../workspace/AgentPicker";

// A small pop-up above the Agents chip listing the agents. The choice is the same one the Agents page keeps
// (remembered in this browser); choose it again to clear it.
export default function AgentMenu({ anchor, selected, onPick, onClose }: { anchor: DOMRect; selected: string | null; onPick: (name: string | null) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(name: string) {
    onPick(selected === name ? null : name);
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
