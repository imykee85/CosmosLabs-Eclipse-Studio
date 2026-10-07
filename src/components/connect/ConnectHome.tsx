"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUp, Brain, Plus, Puzzle, Wrench } from "lucide-react";
import BrandLogo from "./brands";
import ModelPicker from "./ModelPicker";
import "./connect.css";

// Connect: where finished content goes next. Chat with your agents, use their tools, connect the apps you publish to.
export default function ConnectHome() {
  const [text, setText] = useState("");

  return (
    <div className="cn-wrap">
      <div className="cn-hero">
        <div className="cn-dests" aria-hidden="true">
          {["tiktok", "instagram", "telegram", "slack", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={48} />)}
        </div>
        <h1>Where should it go next?</h1>
        <p>Publish, schedule and send your finished content from one place.</p>
      </div>

      <div className="cn-dock">
        <div className="cn-chips">
          <Link href="/skills" className="cn-chip"><Puzzle size={15} /> Skills</Link>
          <Link href="/tools" className="cn-chip"><Wrench size={15} /> Tools</Link>
          <Link href="/memory" className="cn-chip"><Brain size={15} /> Memory</Link>
          <Link href="/connect/apps" className="cn-chip">
            <span className="cn-stack" aria-hidden="true">{["tiktok", "telegram", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={24} />)}</span> Connectors
          </Link>
        </div>

        <form className="cn-box" onSubmit={(e) => e.preventDefault()}>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message box"
            placeholder="Ask to publish or share your content..." />
          <div className="cn-tools">
            <button type="button" className="cn-round" aria-label="Attach"><Plus size={18} /></button>
            <ModelPicker />
            <button type="submit" className="cn-send" aria-label="Send"><ArrowUp size={18} /></button>
          </div>
        </form>
      </div>
    </div>
  );
}
