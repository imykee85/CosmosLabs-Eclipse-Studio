"use client";

import { useEffect, useRef } from "react";
import { atlasSteps } from "./data";

// "From idea to premium content." The workflow section, now about Atlas. Left: heading, Atlas and the button, pinned while you scroll.
// Right: a timeline that draws as you scroll (after the owner's Framer reference): the red line grows down to the middle of the screen,
// each dot lights when its step reaches that line, each step slides in from the right once, and the current step is bright while the rest dim.
// Under reduced motion the whole line is drawn and every step is shown at once.
export default function AtlasWorkflow({ cta, atlasImageSrc }: { cta: React.ReactNode; atlasImageSrc?: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const list = listRef.current, fill = fillRef.current;
    if (!list || !fill) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const trigger = window.innerHeight * 0.55;
      const lr = list.getBoundingClientRect();
      fill.style.height = `${reduce ? lr.height : Math.max(0, Math.min(lr.height, trigger - lr.top))}px`;
      let active = -1;
      itemRefs.current.forEach((li, i) => {
        const dot = li?.querySelector<HTMLElement>("[data-dot]");
        if (!li || !dot) return;
        const r = dot.getBoundingClientRect();
        const passed = reduce || r.top + r.height / 2 <= trigger;
        li.dataset.passed = String(passed);
        if (passed) active = i;
      });
      itemRefs.current.forEach((li, i) => { if (li) li.dataset.active = String(i === active || reduce); });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).dataset.in = "true"; io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    itemRefs.current.forEach((li) => { if (!li) return; if (reduce) li.dataset.in = "true"; else io.observe(li); });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="how-it-works" className="atl-section section-pad">
      <div className="atl-grid">
        <div className="atl-left">
          <div className="eyebrow">THE ECLIPSE WORKFLOW</div>
          <h2>From idea to<br /><em>premium content.</em></h2>
          <div className="atl-figure">
            {atlasImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={atlasImageSrc} alt="Atlas, the Eclipse agent" />
            ) : (
              // Atlas as drawn in the app (the floating agent), large, until the owner sends a picture.
              <div className="atl-bot" role="img" aria-label="Atlas, the Eclipse agent">
                <div className="atl-float">
                  <div className="atl-ball" />
                  <i className="atl-eye atl-eye-l"><b /></i>
                  <i className="atl-eye atl-eye-r"><b /></i>
                </div>
                <div className="atl-ground" />
              </div>
            )}
            <span className="atl-name">ATLAS</span>
          </div>
          <div className="atl-cta">{cta}</div>
        </div>

        <div className="atl-right">
          <div className="atl-line" aria-hidden="true" />
          <div className="atl-fill" ref={fillRef} aria-hidden="true" />
          <ol className="atl-steps" ref={listRef}>
            {atlasSteps.map(([n, title, text], i) => (
              <li key={n} ref={(el) => { itemRefs.current[i] = el; }} data-in="false" data-passed="false" data-active="false">
                <span className="atl-dot" data-dot />
                <div className="atl-step">
                  <span className="atl-num">{n}</span>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
