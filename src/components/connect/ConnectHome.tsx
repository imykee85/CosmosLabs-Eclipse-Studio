"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUp, Cloud, Hash, Music2, Plug, Plus, Send, Share2, Wrench } from "lucide-react";
import ModelPicker from "./ModelPicker";
import "./connect.css";

// Connect: where finished content goes next. Chat with your agents, use their tools, connect the apps you publish to.
export default function ConnectHome() {
  const [text, setText] = useState("");

  return (
    <div className="cn-wrap">
      <div className="cn-hero">
        <div className="cn-dests" aria-hidden="true">
          <span><Music2 size={20} /></span><span><Share2 size={20} /></span><span><Send size={20} /></span><span><Hash size={20} /></span><span><Cloud size={20} /></span>
        </div>
        <h1>Where should it go next?</h1>
        <p>Publish, schedule and send your finished content from one place.</p>
      </div>

      <div className="cn-dock">
        <div className="cn-chips">
          <button type="button" className="cn-chip" disabled title="Tools are coming soon"><Wrench size={15} /> Tools <em>Soon</em></button>
          <Link href="/connect/apps" className="cn-chip"><Plug size={15} /> Connect apps</Link>
        </div>

        <form className="cn-box" onSubmit={(e) => e.preventDefault()}>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message box"
            placeholder="Ask to publish or share your content (coming soon)..." />
          <div className="cn-tools">
            <button type="button" className="cn-round" disabled aria-label="Attach" title="Attaching is coming soon"><Plus size={18} /></button>
            <ModelPicker />
            <button type="submit" className="cn-send" disabled aria-label="Send" title="Chat is coming soon"><ArrowUp size={18} /></button>
          </div>
        </form>
      </div>
    </div>
  );
}
