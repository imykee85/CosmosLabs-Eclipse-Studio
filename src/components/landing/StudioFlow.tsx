"use client";

import { useEffect, useRef, useState } from "react";
import { studioStats } from "./data";

// The black "Start creating with Eclipse." card (owner 2026-10-17, after a screen recording of running numbers and a striped bar-chart screenshot):
// three white striped bars; under each, its number runs up from 0 while the bar rises stripe by stripe, one after another, with the category below.
// It runs again each time the card comes back into view; under reduced motion everything is shown in full.
const RUN_MS = 1400, GAP_MS = 350;
const MAX = Math.max(...studioStats.map((s) => s[3]));
export default function StudioFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<number[]>(studioStats.map(() => 0));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setP(studioStats.map(() => 1)); return; }
    let raf = 0, start = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      const next = studioStats.map((_, i) => ease(Math.min(1, Math.max(0, (t - i * (RUN_MS * 0.6 + GAP_MS)) / RUN_MS))));
      setP(next);
      if (next[next.length - 1] < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { start = 0; raf = requestAnimationFrame(tick); } else setP(studioStats.map(() => 0));
    }, { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="sf" ref={ref}>
      {studioStats.map(([value, suffix, caption, n], i) => {
        const lit = Math.round(p[i] * n);
        return (
          <div className="sf-col" key={caption}>
            <div className="sf-plot" aria-hidden="true">
              <div className="sf-bar" style={{ height: `${(n / MAX) * 100}%` }}>
                {Array.from({ length: n }, (_, k) => <i key={k} className={n - 1 - k < lit ? "on" : ""} />)}
              </div>
            </div>
            <b aria-label={`${value}${suffix} ${caption}`}>{Math.round(p[i] * value)}{suffix}</b>
            <span>{caption}</span>
          </div>
        );
      })}
    </div>
  );
}
