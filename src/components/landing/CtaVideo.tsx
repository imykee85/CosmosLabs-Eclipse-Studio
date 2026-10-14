"use client";
import { useEffect, useRef } from "react";

// Background clip for the black "Start creating with Eclipse." card (public/cta/cta.mp4, the owner's clip). Muted loop; a still under reduced motion.
export default function CtaVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && matchMedia("(prefers-reduced-motion: reduce)").matches) v.pause();
  }, []);
  return (
    <div className="cta-bg" aria-hidden="true">
      <video ref={ref} className="cta-bg-video" src="/cta/cta.mp4" poster="/cta/cta-poster.jpg" autoPlay muted loop playsInline preload="auto" />
      <div className="cta-bg-wash" />
    </div>
  );
}
