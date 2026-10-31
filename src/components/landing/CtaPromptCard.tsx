"use client";

import GrowArea from "@/components/GrowArea";
import { useEffect, useRef, useState } from "react";

// The black "have an idea? try it." card: eyebrow, two-line heading (second line red), a prompt box and one button.
// Used for the idea card and the Atlas card so their spacing and type stay identical.
export default function CtaPromptCard({ id, className = "", eyebrow, line1, line2, placeholder, button, icon, caption, onSubmit }: {
  id?: string; className?: string; eyebrow: string; line1: string; line2: string; placeholder: string; button: string; icon: React.ReactNode; caption?: string; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  // iPhone Safari zooms the page when a text box whose text is smaller than 16 pt on the screen is tapped. This box keeps its look (15 px text) by being laid out at the
  // zoom-proof size (--in-fs, set by the phone layout script) and scaled down with a transform, which changes nothing about the page: no viewport change, no resize on tap.
  const inner = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [h, setH] = useState<number | undefined>();
  useEffect(() => {
    const calc = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--in-fs")); setK(v > 15 ? 15 / v : 1); };
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => { window.removeEventListener("resize", calc); window.removeEventListener("orientationchange", calc); };
  }, []);
  useEffect(() => {
    const el = inner.current;
    if (!el || k >= 1) { setH(undefined); return; }
    const measure = () => setH(Math.round(el.offsetHeight * k));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [k]);
  return (
    <section id={id} className={`try-section section-pad ${className}`.trim()}>
      <div className="try-inner">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{line1}<br /><em>{line2}</em></h2>
        <div className="idea-box">
          <div className="idea-field" style={h != null ? { height: h, overflow: "hidden" } : undefined}>
            <div ref={inner} className="idea-scale" style={k < 1 ? { width: `${100 / k}%`, transform: `scale(${k})`, transformOrigin: "0 0" } : undefined}>
              <GrowArea rows={3} noExpand value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
            </div>
          </div>
          <button className="create-btn" onClick={() => onSubmit(text)}>{icon}{button}</button>
        </div>
        {caption && <p className="try-caption">{caption}</p>}
      </div>
    </section>
  );
}
