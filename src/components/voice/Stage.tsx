"use client";

import { useEffect, useRef } from "react";
import { bars, orbStyle } from "./look";

// The stage: the voice's orb in the middle of a ring of bars. Idle it breathes, while a take is being made a wave runs round it, and while a take plays the bars
// move and a red ring around them shows how far it has played. Drawn by hand each frame (refs, no React state) so it stays smooth on phones.
const N = 72;

export default function Stage({ seed, mode, progress }: { seed: string; mode: "idle" | "making" | "playing"; progress: number }) {
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const base = useRef(bars(seed, N));
  useEffect(() => { base.current = bars(seed, N); }, [seed]);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (t: number) => {
      for (let i = 0; i < N; i++) {
        const el = lines.current[i];
        if (!el) continue;
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const b = base.current[i];
        let len: number;
        if (reduce) len = mode === "idle" ? 4 : 6 + b * 10;
        else if (mode === "playing") len = 4 + b * 22 * (0.45 + 0.55 * Math.abs(Math.sin(t / 170 + i * 0.9) * Math.cos(t / 410 + i * 0.37)));
        else if (mode === "making") len = 3 + 16 * Math.max(0, Math.sin(t / 260 - i * 0.35)) ** 3;
        else len = 3 + 2.5 * (1 + Math.sin(t / 900 + i * 0.5)) * b;
        const r0 = 104, r1 = r0 + len;
        el.setAttribute("x1", String(130 + Math.cos(a) * r0));
        el.setAttribute("y1", String(130 + Math.sin(a) * r0));
        el.setAttribute("x2", String(130 + Math.cos(a) * r1));
        el.setAttribute("y2", String(130 + Math.sin(a) * r1));
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const C = 2 * Math.PI * 127;
  return (
    <div className={`vc-stage is-${mode}`} aria-hidden="true">
      <svg viewBox="0 0 260 260">
        <circle cx="130" cy="130" r="127" className="vc-ring" />
        {mode === "playing" && <circle cx="130" cy="130" r="127" className="vc-ring-on" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - progress) }} transform="rotate(-90 130 130)" />}
        {Array.from({ length: N }, (_, i) => <line key={i} ref={(el) => { lines.current[i] = el; }} className="vc-bar" />)}
      </svg>
      <span className="vc-stage-orb" style={orbStyle(seed)} />
    </div>
  );
}
