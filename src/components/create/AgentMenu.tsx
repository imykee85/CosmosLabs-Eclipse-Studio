"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Check, Plus } from "lucide-react";
import AgentIcon from "../AgentIcon";
import { AGENTS } from "../workspace/AgentPicker";
import { useCustomAgents } from "@/lib/custom-agents";

// A small pop-up above the Agents chip listing Atlas and the agents this person made, with a way to make another. The choice is the same one the Agents page keeps
// (remembered in this browser); choose it again to clear it.
export default function AgentMenu({ anchor, selected, onPick, onClose }: { anchor: DOMRect; selected: string | null; onPick: (name: string | null) => void; onClose: () => void }) {
  const { agents: mine } = useCustomAgents();
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
        {[...AGENTS, ...mine.map((a) => a.name)].map((name) => (
          <button key={name} type="button" role="menuitemradio" aria-checked={selected === name} className="am-item" onClick={() => choose(name)}>
            <AgentIcon size={16} />
            <span>{name}</span>
            {selected === name && <Check size={15} className="am-check" />}
          </button>
        ))}
        <Link href="/agents?new=1" className="am-item am-new" role="menuitem" onClick={onClose}><Plus size={16} /><span>Create your own agent</span></Link>
      </div>
    </>
  );
}
