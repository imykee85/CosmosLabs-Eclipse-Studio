"use client";

import { useEffect, useRef } from "react";

// Full-bleed background clip for the landing hero (public/hero/hero.mp4 + .webm, the owner's Seedance astronaut clip). The poster shows until it plays and stays under reduced motion. The dark wash keeps the headline readable.
export default function HeroImage() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true;
    const play = () => { v.play().catch(() => {}); };
    play();
    const vis = () => { if (!document.hidden) play(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("touchstart", play, { once: true, passive: true });
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("touchstart", play);
    };
  }, []);

  return (
    <div className="hero-video" aria-hidden="true">
      <video
        ref={ref}
        className="hero-video-el"
        poster="/hero/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
      >
        <source src="/hero/hero.mp4" type="video/mp4" />
        <source src="/hero/hero.webm" type="video/webm" />
      </video>
      <div className="hero-video-wash" />
    </div>
  );
}
