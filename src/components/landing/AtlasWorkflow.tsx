"use client";

import { useEffect, useRef, useState } from "react";
import { atlasSteps } from "./data";

// "From idea to premium content." The workflow section, same size as before. Left: heading, the button, and Atlas (the 3D agent from the app, larger).
// Right: a small self-playing animation of the process (after the owner's Framer timeline reference): a red line runs down the steps one by one,
// each dot lights as the line reaches it and that step brightens, then it starts again. It only plays while the section is on screen.
// Under reduced motion every step is shown at once, with the full line.
const STEP_MS = 1500;
const HOLD_MS = 1800;

export default function AtlasWorkflow({ cta }: { cta: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStill(true); setActive(atlasSteps.length - 1); return; }
    let timer = 0, visible = false, i = 0;
    const next = () => {
      if (!visible) return;
      i = i >= atlasSteps.length - 1 ? 0 : i + 1;
      setActive(i);
      timer = window.setTimeout(next, i === atlasSteps.length - 1 ? HOLD_MS : STEP_MS);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) { i = 0; setActive(0); timer = window.setTimeout(next, STEP_MS); }
      if (!visible) window.clearTimeout(timer);
    }, { threshold: 0.3 });
    if (box.current) io.observe(box.current);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, []);

  const last = atlasSteps.length - 1;
  return (
    <section id="how-it-works" className="atl-section section-pad">
      <div className="atl-left">
        <div className="eyebrow">THE ECLIPSE WORKFLOW</div>
        <h2>From idea to<br /><em>premium content.</em></h2>
        <div className="atl-cta">{cta}</div>
        {/* Atlas, drawn like the agent in the app, only bigger. */}
        <div className="atl-bot" role="img" aria-label="Atlas, the Eclipse agent">
          <div className="atl-float">
            <div className="atl-ball" />
            <i className="atl-eye atl-eye-l"><b /></i>
            <i className="atl-eye atl-eye-r"><b /></i>
          </div>
          <div className="atl-ground" />
        </div>
      </div>

      <div className="atl-demo" ref={box} aria-label="How Atlas works" style={{ ["--atl-p" as string]: still ? 1 : active / last }}>
        <div className="atl-line" aria-hidden="true"><div className="atl-fill" /></div>
        <ol>
          {atlasSteps.map(([n, title, text], i) => (
            <li key={n} className={`${i <= active ? "is-done" : ""} ${still || i === active ? "is-active" : ""}`}>
              <span className="atl-dot" aria-hidden="true" />
              <span className="atl-num">{n}</span>
              <div><b>{title}</b><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
