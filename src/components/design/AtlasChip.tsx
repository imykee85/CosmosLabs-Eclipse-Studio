"use client";
import { useRef, useState } from "react";
import AgentIcon from "@/components/AgentIcon";
import AgentMenu from "@/components/create/AgentMenu";
import { useAgent } from "@/lib/use-agent";

/** The Atlas chip and its on/off switch, the same pair every prompt box has. The floating Atlas itself is drawn by DesignStudio. */
export default function AtlasChip() {
  const agent = useAgent();
  const chip = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <div className="cr-grp">
      <button ref={chip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <AgentIcon size={14} /> <span className="cr-aname">{agent.agent ?? "Atlas"}</span>
      </button>
      <button type="button" role="switch" aria-checked={agent.active} aria-label="Let the agent help in Design Studio" title={agent.agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agent.active ? "is-on" : ""}`}
        onClick={() => { if (!agent.agent) { if (chip.current) setAnchor(chip.current.getBoundingClientRect()); return; } agent.setOn(!agent.on); }}><i /></button>
      {anchor && <AgentMenu anchor={anchor} selected={agent.agent} onPick={(n) => agent.setAgent(n)} onClose={() => setAnchor(null)} />}
    </div>
  );
}
