"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUp, Plug, Plus, Wrench } from "lucide-react";
import OrbitIcon from "@/components/OrbitIcon";
import "./orbit.css";

const AGENTS = ["Agent 1", "Agent 2", "Agent 3"];
const AGENT_KEY = "eclipse-agent"; // same key as the Agents page

// Orbit: chat home for your agents, with shortcuts to their tools and to connected apps.
export default function OrbitView() {
  const [agent, setAgent] = useState(AGENTS[1]);
  const [text, setText] = useState("");

  useEffect(() => {
    try { const a = localStorage.getItem(AGENT_KEY); if (a && AGENTS.includes(a)) setAgent(a); } catch {}
  }, []);

  function pick(a: string) {
    setAgent(a);
    try { localStorage.setItem(AGENT_KEY, a); } catch {}
  }

  return (
    <div className="or-wrap">
      <div className="or-hero">
        <span className="or-mark"><OrbitIcon size={42} strokeWidth={1.4} /></span>
        <h1>What are we creating today?</h1>
        <p>Ask your agent, use its tools, or connect the apps you work in.</p>
      </div>

      <div className="or-dock">
        <div className="or-chips">
          <button type="button" className="or-chip" disabled title="Tools are coming soon"><Wrench size={15} /> Tools <em>Soon</em></button>
          <Link href="/orbit/connect" className="or-chip"><Plug size={15} /> Connect apps</Link>
        </div>

        <form className="or-box" onSubmit={(e) => e.preventDefault()}>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message your agent"
            placeholder="Ask, create, or plan with your agent..." />
          <div className="or-tools">
            <button type="button" className="or-round" disabled aria-label="Attach" title="Attaching is coming soon"><Plus size={18} /></button>
            <label className="or-agent">
              <span className="sr-only">Agent</span>
              <select value={agent} onChange={(e) => pick(e.target.value)} aria-label="Agent">
                {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <button type="submit" className="or-send" disabled aria-label="Send" title="Chat is coming soon"><ArrowUp size={18} /></button>
          </div>
        </form>
        <p className="or-note">Chatting with your agents is coming soon.</p>
      </div>
    </div>
  );
}
