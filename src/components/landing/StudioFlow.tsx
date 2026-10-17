"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { studioFlow } from "./data";

// The black "Start creating with Eclipse." card (owner 2026-10-17, after a screen recording and a striped bar-chart screenshot): a row of step pills lights
// up one after another, and as each step lights, its column's striped bar rises. After the last one it holds, then starts again. It only runs while on
// screen; under reduced motion every step is lit and every bar is full.
const STEP_MS = 1100, HOLD_MS = 2400;
const MAX = Math.max(...studioFlow.map((s) => s[2]));
export default function StudioFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setActive(studioFlow.length - 1); return; }
    let timer = 0, visible = false, i = -1;
    const next = () => {
      if (!visible) return;
      i = i >= studioFlow.length - 1 ? -1 : i + 1;
      setActive(i);
      timer = window.setTimeout(next, i === studioFlow.length - 1 ? HOLD_MS : i === -1 ? 500 : STEP_MS);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) { i = -1; setActive(-1); timer = window.setTimeout(next, 400); }
      if (!visible) window.clearTimeout(timer);
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, []);

  return (
    <div className="sf" ref={ref} aria-label="From idea to finished work in Eclipse">
      <div className="sf-steps" aria-hidden="true">
        {studioFlow.map(([name], i) => (
          <Fragment key={name}>
            {i > 0 && <ArrowRight className={`sf-arrow${i <= active ? " is-on" : ""}`} size={13} />}
            <span className={`sf-pill${i === active ? " is-active" : i < active ? " is-done" : ""}`}>{name}</span>
          </Fragment>
        ))}
      </div>
      <div className="sf-chart">
        {studioFlow.map(([name, where, n], i) => (
          <div className={`sf-col${i <= active ? " is-up" : ""}${i === active ? " is-active" : ""}`} key={name} style={{ ["--i" as string]: i }}>
            <b>{name}</b>
            <div className="sf-plot">
              <div className="sf-bar" style={{ height: `${(n / MAX) * 100}%` }}>
                {Array.from({ length: n }, (_, k) => <i key={k} style={{ ["--k" as string]: n - 1 - k }} />)}
              </div>
            </div>
            <span>{where}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
