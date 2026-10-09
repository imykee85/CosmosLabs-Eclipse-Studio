"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, Copy, ExternalLink } from "lucide-react";
import type { MotionPrompt } from "@/lib/motion";
import { postUrl } from "@/lib/motion";
import MotionMedia from "./MotionMedia";
import "./motion.css";

// One motion prompt: the clip (or an empty tile) beside its details and the prompt with a Copy button.
export default function MotionDetail({ item }: { item: MotionPrompt }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const text = item.prompt ?? "";
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="mo">
      <Link href="/motion" className="mo-back"><ChevronLeft size={18} /> Motion graphics</Link>
      <div className="mo-page">
        <MotionMedia item={item} controls />
        <div className="mo-detail">
          <h1>{item.title}</h1>
          <dl>
            <div><dt>Model</dt><dd>{item.model}</dd></div>
            <div><dt>Tries</dt><dd>{item.tries}</dd></div>
            <div><dt>Topics</dt><dd>{item.tags.join(", ")}</dd></div>
            <div><dt>By</dt><dd>{item.name} (@{item.handle})</dd></div>
            <div><dt>Posted</dt><dd>{item.posted}</dd></div>
          </dl>
          {item.prompt && (
            <>
              <h3>Prompt</h3>
              <p className="mo-prompt">{item.prompt}</p>
              <button type="button" className="mo-copy" onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy prompt</>}</button>
            </>
          )}
          <a className="mo-source" href={postUrl(item)} target="_blank" rel="noopener noreferrer">View original on X <ExternalLink size={3} /></a>
          <p className="mo-credit">The video and prompt belong to their creator.</p>
        </div>
      </div>
    </div>
  );
}
