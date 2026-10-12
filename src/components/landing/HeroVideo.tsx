"use client";

import { useEffect, useRef, useState } from "react";

// Full-bleed looping background video for the landing hero (public/hero/hero.mp4, muted, no audio). The still frame shows until the
// video plays and stays if it cannot (slow connection, data saver, reduced motion). The dark wash keeps the headline readable.
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.play()?.catch(() => {});
  }, []);

  return (
    <div className="hero-video" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-video-still" src="/hero/hero-poster.jpg" alt="" />
      {!still && (
        <video ref={ref} className="hero-video-el" src="/hero/hero.mp4" poster="/hero/hero-poster.jpg" autoPlay muted loop playsInline preload="auto" onError={() => setStill(true)} />
      )}
      <div className="hero-video-wash" />
    </div>
  );
}
