"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Cpu, Plug, Puzzle } from "lucide-react";
import GlowOrb from "@/components/GlowOrb";

// "Atlas, at the core." After the owner's Framer reference (layout and motion only): two dashed rings round a glowing core, small round nodes travelling
// along them, static text in the four corners. Each ring turns one way and its nodes turn back at the same speed, so the icons stay upright.
// The rings only turn while the section is on screen.
const ITEMS = [
  { key: "memory", title: "Memory", text: "Atlas remembers your brand, your style and what you made before.", icon: Brain, ring: 1, angle: -40 },
  { key: "apps", title: "Apps", text: "Connects to the tools you already use.", icon: Plug, ring: 0, angle: 200 },
  { key: "skills", title: "Skills", text: "A growing library of skills for ads, product shots, motion and more.", icon: Puzzle, ring: 1, angle: 140 },
  { key: "intelligence", title: "Intelligence", text: "Picks the right model for every job.", icon: Cpu, ring: 0, angle: 20 },
] as const;
const OUTER_S = 60, INNER_S = 44;

export default function AtlasOrbitSection() {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ringNodes = (ring: 0 | 1, back: boolean, seconds: number) => ITEMS.filter((it) => it.ring === ring).map((it) => {
    const Icon = it.icon;
    return (
      <div key={it.key} className="core-slot" style={{ transform: `rotate(${it.angle}deg)` }}>
        <div className="core-pt">
          <div style={{ transform: `rotate(${-it.angle}deg)` }}>
            <div className={back ? "core-cw" : "core-ccw"} style={{ animationDuration: `${seconds}s` }}>
              <span className="core-node"><Icon size={20} strokeWidth={1.7} /></span>
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <section ref={root} data-visible={visible} className="core-section section-pad">
      <div className="core-head">
        <div>
          <span className="core-pill"><i /> Meet Atlas</span>
          <h2>Atlas, at<br />the core.</h2>
        </div>
        <p>One agent at the centre. Everything it knows and everything it can use orbits around it.</p>
      </div>

      <div className="core-stage">
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={it.key} className={`core-block core-b${i}`}>
              <span className="core-bicon"><Icon size={22} strokeWidth={1.7} /></span>
              <h3>{it.title}</h3>
              <p>{it.text}</p>
            </div>
          );
        })}

        <div className="core-circles">
          <div className="core-ring" />
          <div className="core-cw core-fill" style={{ animationDuration: `${OUTER_S}s` }}>{ringNodes(0, false, OUTER_S)}</div>
          <div className="core-inner">
            <div className="core-ring core-ring-in" />
            <div className="core-ccw core-fill" style={{ animationDuration: `${INNER_S}s` }}>{ringNodes(1, true, INNER_S)}</div>
          </div>
          <div className="core-orb"><GlowOrb /></div>
        </div>
      </div>
    </section>
  );
}
