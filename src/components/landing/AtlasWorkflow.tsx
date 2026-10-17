"use client";

import { useEffect, useRef, useState } from "react";
import { atlasDirections, atlasStrengths, atlasSteps } from "./data";
import AtlasTyping from "./AtlasTyping";

// "Meet Atlas." Left: heading, subtext, Atlas (the 3D agent from the app, larger), his strengths, then the button. When the section comes into view
// Atlas bounces once and then spins (the same moves as in the app).
// Right: a small self-playing animation of the process (after the owner's Framer timeline reference): a red line runs down the steps one by one,
// each dot lights as the line reaches it and that step brightens, then it starts again. It only plays while the section is on screen.
// Under reduced motion every step is shown at once, with the full line.
const STEP_MS = 1500;
const HOLD_MS = 1800;
export default function AtlasWorkflow({ cta }: { cta: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const bot = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const introRow = useRef<HTMLDivElement>(null);

  // Side by side, the right column starts level with the strengths list (its first rule on the list's top rule) and Atlas's typed lines stretch across
  // the empty space above it to the right edge, like the owner's reference; stacked, both just follow.
  useEffect(() => {
    const align = () => {
      const r = right.current, l = list.current, t = introRow.current;
      if (!r || !l) return;
      r.style.marginTop = "0px";
      if (t) t.style.width = "";
      if (r.getBoundingClientRect().left <= l.getBoundingClientRect().left + 40) return;
      if (t) t.style.width = `${Math.round(r.getBoundingClientRect().right - t.getBoundingClientRect().left)}px`;
      r.style.marginTop = `${Math.max(0, Math.round(l.getBoundingClientRect().top - r.getBoundingClientRect().top))}px`;
    };
    align();
    window.addEventListener("resize", align);
    document.fonts?.ready.then(align);
    return () => window.removeEventListener("resize", align);
  }, []);
  const [intro, setIntro] = useState(false);

  // Bounce, then spin, the first time Atlas comes into view.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !bot.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIntro(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(bot.current);
    return () => io.disconnect();
  }, []);

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
        <div className="eyebrow">INTRODUCING</div>
        <h2>Meet <em>Atlas</em></h2>
        <p className="atl-sub">Your agentic creative partner.</p>
        {/* Atlas, drawn like the agent in the app (the eyes turn round the ball in 3D), only bigger. Beside him, his art direction types out as if live. */}
        <div className="atl-intro" ref={introRow}>
        <div className={`atl-bot${intro ? " is-intro" : ""}`} ref={bot} role="img" aria-label="Atlas, the Eclipse agent">
          <div className="atl-glow" />
          <div className="atl-hop">
            <div className="atl-float">
              <div className="atl-ball" />
              <div className="atl-spin">
                <div className="atl-sphere">
                  <i className="atl-eye atl-eye-l"><b /></i>
                  <i className="atl-eye atl-eye-r"><b /></i>
                </div>
              </div>
            </div>
          </div>
          <div className="atl-ground" />
        </div>
        <AtlasTyping lines={atlasDirections} />
        </div>
        <ul className="atl-strengths" ref={list}>
          {atlasStrengths.map(([q, a]) => (
            <li key={q}><b>{q}</b><p>{a}</p></li>
          ))}
        </ul>
        <div className="atl-cta">{cta}</div>
      </div>

      <div className="atl-right" ref={right}>
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
      <p className="atl-tag">Imagine it<br />Say it<br /><em>Atlas</em><br />Executes it</p>
      </div>
    </section>
  );
}
