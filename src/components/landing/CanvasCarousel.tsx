"use client";

import { useEffect, useRef } from "react";
import { wowTiles } from "./data";

// Carousel cards that play a clip instead of the gradient tile (the owner's real estate clip).
const WOW_VIDEO: Record<string, { src: string; webm: string; poster: string }> = {
  "REAL ESTATE": { src: "/landing/real-estate-card.mp4", webm: "/landing/real-estate-card.webm", poster: "/landing/real-estate-card-poster.jpg" },
};

// Starts the clip by script as well as by attribute: iPhone Safari ignores the muted and autoplay props unless the element is muted and asked to play.
function WowVideo({ src, webm, poster }: { src: string; webm: string; poster: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    void v.play().catch(() => {});
  }, []);
  return (
    <video ref={ref} className="wow-video" poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true">
      <source src={src} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  );
}

// The "One canvas" cards as a looping 3D carousel, matched to the owner's reference (a Framer site, measured from their screenshot): the cards stand on the
// inside of a ring and the viewer stands at its centre, so every card faces you. That one geometry gives all three things seen in the reference:
//   - the cards in the middle are the smallest (furthest away),
//   - cards grow toward the sides (about 1.35x at the screen edge),
//   - each outer card's inner edge is shorter than its outer edge.
// Measured: camera distance about 0.52 x the screen width, middle card about 0.17 x 0.24 of the width, about 21.5 degrees from card to card.
// One shared camera: the cards are DIRECT children of the element with `perspective` (no moving track in between, which is what breaks 3D on iPhone Safari).
// The ring turns slowly on its own, can be dragged or swiped (a flick glides), and pauses under a mouse; vertical page scroll still works (`touch-action: pan-y`).
const SLOTS = wowTiles.length * 2;   // two copies of the cards go round the ring
const CAMERA = 0.52;                 // camera distance and ring radius, as a share of the width
const CARD_W = 0.17;
const CARD_H = 0.24;
const GAP_DEG = 3;                   // empty angle between neighbouring cards
const HIDE_DEG = 64;                 // cards further round than this are off screen
const DRIFT_PX_S = 26;               // slow automatic turn, measured at the middle of the row
const MAX_W = 1600;                  // above this width the ring stops growing

export default function CanvasCarousel() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const cards = Array.from(box.querySelectorAll<HTMLElement>(".wow-slide"));
    let R = 1, stepDeg = 20, stepPx = 1;
    let pos = 0, vel = 0, down = false, lastX = 0, lastT = 0, hover = false, raf = 0, prev = 0, visible = true;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const W = Math.min(box.clientWidth, MAX_W);
      const w = W * CARD_W, h = W * CARD_H;
      R = W * CAMERA;
      stepDeg = (2 * Math.atan(w / 2 / R) * 180) / Math.PI + GAP_DEG;
      stepPx = R * (stepDeg * Math.PI / 180);
      box.style.perspective = `${R}px`;
      box.style.height = `${Math.round(h * 1.85)}px`;
      box.style.setProperty("--cw", `${w}px`);
      box.style.setProperty("--ch", `${h}px`);
      box.style.setProperty("--cr", `${Math.max(10, w * 0.085)}px`);
    };
    const paint = () => {
      for (let j = 0; j < cards.length; j++) {
        let k = (j - pos) % SLOTS;                       // steps from the middle, wrapped to -SLOTS/2 .. SLOTS/2
        if (k >= SLOTS / 2) k -= SLOTS;
        if (k < -SLOTS / 2) k += SLOTS;
        const deg = k * stepDeg;
        const el = cards[j];
        if (Math.abs(deg) > HIDE_DEG) { el.style.visibility = "hidden"; continue; }
        el.style.visibility = "visible";
        // Out to the ring (R away), turned round the viewer, then the whole ring brought forward so its centre is the camera.
        el.style.transform = `translate3d(0,0,${R.toFixed(1)}px) rotateY(${(-deg).toFixed(3)}deg) translate3d(0,0,${(-R).toFixed(1)}px)`;
      }
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - (prev || t)) / 1000);
      prev = t;
      if (!down && visible) {
        if (Math.abs(vel) > 0.02) { pos += vel * dt; vel *= Math.pow(0.04, dt); }   // a flick glides to a stop
        else if (!hover && !still) pos += (DRIFT_PX_S / stepPx) * dt;
        pos = ((pos % SLOTS) + SLOTS) % SLOTS;
        paint();
      }
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => { down = true; vel = 0; lastX = e.clientX; lastT = performance.now(); box.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const now = performance.now(), dx = e.clientX - lastX;
      pos -= dx / stepPx;
      pos = ((pos % SLOTS) + SLOTS) % SLOTS;
      if (now > lastT) vel = 0.6 * vel + 0.4 * (-dx / stepPx / ((now - lastT) / 1000));
      lastX = e.clientX; lastT = now;
      paint();
    };
    const onUp = () => { down = false; if (performance.now() - lastT > 90) vel = 0; };
    const enter = () => { hover = true; }, leave = () => { hover = false; };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    const resize = () => { measure(); paint(); };

    measure(); paint();
    io.observe(box);
    window.addEventListener("resize", resize);
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    box.addEventListener("mouseenter", enter);
    box.addEventListener("mouseleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", resize);
      box.removeEventListener("pointerdown", onDown); box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp); box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("mouseenter", enter); box.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <div className="wow-carousel" ref={root} aria-label="Examples of what Eclipse makes">
      {Array.from({ length: SLOTS }, (_, j) => {
        const i = j % wowTiles.length;
        const [title, sub] = wowTiles[i];
        return (
          <article className="wow-slide" key={j} aria-hidden={j >= wowTiles.length || undefined}>
            {WOW_VIDEO[title] ? (
              <WowVideo {...WOW_VIDEO[title]} />
            ) : (
              <div className={`tile tone-${i}`} />
            )}
            {!WOW_VIDEO[title] && <div className="image-wash" />}
            <div className="wow-label"><b>{title}</b><span>{sub}</span></div>
          </article>
        );
      })}
    </div>
  );
}
