"use client";

import { useEffect, useRef } from "react";
import { wowTiles } from "./data";

// The "One canvas" cards as a looping 3D carousel: a row of tall rounded cards that drifts sideways on its own, can be dragged or swiped, and tilts every card
// toward the viewer the further it sits from the middle (the middle ones face you; the outer ones turn so their inner edge sits further away, like the Framer-style reference). Positions are driven by hand each frame so the loop
// is seamless and fractional; vertical page scrolling still works on touch (`touch-action: pan-y`).
const COPIES = 3;
const MAX_DEG = 30;       // tilt of a card at the edge of the row
const DRIFT_PX_S = 28;    // slow automatic drift
const PERSPECTIVE = 1100;
const FLAT = 0.25;        // the middle stretch of the row keeps the base size
const GROW = 0.42;        // how much bigger a card gets for each step away from it (about 1.3x at the edge)

export default function CanvasCarousel() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = root.current, row = track.current;
    if (!box || !row) return;
    const cards = Array.from(row.children) as HTMLElement[];
    const per = wowTiles.length;
    let step = 1, setW = 1, boxW = 1, cardW = 1;
    let pos = 0, vel = 0, down = false, lastX = 0, lastT = 0, hover = false, raf = 0, prev = 0, visible = true;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      cardW = cards[0].offsetWidth;
      step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cardW;
      setW = step * per;
      boxW = box.clientWidth;
      if (pos < setW || pos >= 2 * setW) pos = setW + (((pos % setW) + setW) % setW);
    };
    const paint = () => {
      row.style.transform = `translate3d(${(boxW - cardW) / 2 - pos}px,0,0)`;
      for (let i = 0; i < cards.length; i++) {
        const d = i * step - pos;                         // distance of this card's middle from the middle of the row
        const n = Math.max(-1.25, Math.min(1.25, d / (boxW / 2)));
        // Like standing inside a curved wall: the middle cards sit further away (smaller), the outer ones come toward you (bigger) and turn so their inner edge falls back.
        const grow = 1 + GROW * Math.max(0, Math.abs(n) - FLAT);
        const z = PERSPECTIVE * (1 - 1 / grow);
        cards[i].style.transform = `translateZ(${z.toFixed(1)}px) rotateY(${(-n * MAX_DEG).toFixed(2)}deg)`;
      }
    };
    const wrap = () => { while (pos >= 2 * setW) pos -= setW; while (pos < setW) pos += setW; };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - (prev || t)) / 1000);
      prev = t;
      if (!down) {
        if (Math.abs(vel) > 4) { pos -= vel * dt; vel *= Math.pow(0.04, dt); }       // a flick glides to a stop
        else if (!hover && !still && visible) pos += DRIFT_PX_S * dt;
        wrap();
      }
      paint();
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => { down = true; vel = 0; lastX = e.clientX; lastT = performance.now(); box.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const now = performance.now(), dx = e.clientX - lastX;
      pos -= dx; wrap();
      if (now > lastT) vel = 0.6 * vel + 0.4 * (dx / ((now - lastT) / 1000));
      lastX = e.clientX; lastT = now;
    };
    const onUp = () => { down = false; if (performance.now() - lastT > 90) vel = 0; };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });

    measure(); paint();
    io.observe(box);
    window.addEventListener("resize", measure);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    const enter = () => { hover = true; }, leave = () => { hover = false; };
    box.addEventListener("mouseenter", enter);
    box.addEventListener("mouseleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", measure);
      box.removeEventListener("pointerdown", onDown); box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp); box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("mouseenter", enter); box.removeEventListener("mouseleave", leave);
    };
  }, []);

  const items = Array.from({ length: COPIES }, (_, c) => wowTiles.map(([title, sub], i) => ({ title, sub, i, key: `${c}-${i}`, hidden: c !== 1 })));
  return (
    <div className="wow-carousel" ref={root} style={{ perspective: PERSPECTIVE }} aria-label="Examples of what Eclipse makes">
      <div className="wow-track" ref={track}>
        {items.flat().map((it) => (
          <article className="wow-slide" key={it.key} aria-hidden={it.hidden || undefined}>
            <div className={`tile tone-${it.i}`} />
            <div className="image-wash" />
            <div className="wow-label"><b>{it.title}</b><span>{it.sub}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}
