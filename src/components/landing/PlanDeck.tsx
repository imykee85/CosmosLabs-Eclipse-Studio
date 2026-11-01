"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Desktop: the plain grid. Phones and tablets (<= 1100px): a carousel with swipe, arrows and dots, starting on the first plan.
export default function PlanDeck({ children, note, start = 0 }: { children: ReactNode; note?: ReactNode; start?: number }) {
  const count = Children.count(children);
  const [index, setIndex] = useState(Math.min(start, count - 1));
  const deck = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; on: boolean } | null>(null);

  const place = useCallback((i: number, extra = 0, animate = true) => {
    const d = deck.current, t = track.current;
    if (!d || !t) return;
    if (!window.matchMedia("(max-width: 1100px)").matches) { t.style.transform = ""; t.style.transition = ""; return; }
    const card = t.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(t).columnGap) || 18;
    // Cards line up from the left edge: the first is flush with the page margin, the next one peeks in.
    const pad = 24, w = card.offsetWidth;
    const minX = Math.min(pad, d.clientWidth - pad - (t.children.length * w + (t.children.length - 1) * gap));
    const x = Math.max(minX, pad - i * (w + gap)) + extra;
    t.style.transition = animate ? "transform .38s cubic-bezier(.22,.8,.3,1)" : "none";
    t.style.transform = `translate3d(${x}px,0,0)`;
  }, []);

  useEffect(() => { place(index); }, [index, place]);
  useEffect(() => {
    const on = () => place(index, 0, false);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [index, place]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));

  return (
    <div className="plan-deck" ref={deck}
      onTouchStart={(e) => { const t = e.touches[0]; drag.current = { x: t.clientX, y: t.clientY, dx: 0, on: false }; }}
      onTouchMove={(e) => {
        const s = drag.current; if (!s) return;
        const t = e.touches[0]; const dx = t.clientX - s.x; const dy = t.clientY - s.y;
        if (!s.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.on = true; else return; }
        s.dx = dx; place(index, dx, false);
      }}
      onTouchEnd={() => {
        const s = drag.current; drag.current = null;
        if (!s || !s.on) return;
        if (s.dx < -50) go(index + 1); else if (s.dx > 50) go(index - 1); else place(index);
      }}
      onTouchCancel={() => { drag.current = null; place(index); }}
    >
      <div className="plan-grid has-free" ref={track}>{children}</div>
      {note}
      <div className="plan-nav">
        <button type="button" aria-label="Previous plan" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft size={18} /></button>
        <div className="plan-dots">
          {Array.from({ length: count }, (_, i) => (
            <button type="button" key={i} aria-label={`Plan ${i + 1}`} className={i === index ? "on" : ""} onClick={() => go(i)} />
          ))}
        </div>
        <button type="button" aria-label="Next plan" onClick={() => go(index + 1)} disabled={index === count - 1}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
