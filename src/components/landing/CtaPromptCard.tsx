"use client";

import GrowArea from "@/components/GrowArea";
import { useState } from "react";

// The black "have an idea? try it." card: eyebrow, two-line heading (second line red), a prompt box and one button.
// Used for the idea card and the Atlas card so their spacing and type stay identical.
export default function CtaPromptCard({ id, className = "", eyebrow, line1, line2, placeholder, button, icon, caption, onSubmit }: {
  id?: string; className?: string; eyebrow: string; line1: string; line2: string; placeholder: string; button: string; icon: React.ReactNode; caption?: string; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  // iPhone Safari zooms the page when a small text box is tapped. While this box has focus the page's own scale is the most it may take, so it cannot zoom in; released on blur.
  const lock = (on: boolean) => {
    try {
      const w = window as unknown as { __lockScale?: number };
      w.__lockScale = on ? (window.visualViewport?.scale ?? 1) : undefined;
      const m = document.querySelector('meta[name="viewport"]');
      if (m) m.setAttribute("content", m.getAttribute("content") + " ");
    } catch {}
  };
  return (
    <section id={id} className={`try-section section-pad ${className}`.trim()}>
      <div className="try-inner">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{line1}<br /><em>{line2}</em></h2>
        <div className="idea-box">
          <GrowArea rows={3} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => lock(true)} onBlur={() => lock(false)} placeholder={placeholder} />
          <button className="create-btn" onClick={() => onSubmit(text)}>{icon}{button}</button>
        </div>
        {caption && <p className="try-caption">{caption}</p>}
      </div>
    </section>
  );
}
