"use client";

import { useEffect, useRef, useState } from "react";

// Full-bleed looping background video for the landing hero (public/hero/hero.mp4, muted, no audio). The still frame shows until the
// video plays and stays if it cannot (slow connection, data saver). The dark wash keeps the headline readable.
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    // The owner wants this background to always play, so it does not follow "reduce motion" (it is muted, has no flashing and stays behind the text).
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const go = () => { v.muted = true; v.play()?.catch(() => {}); };
    go();
    // Some phones (Low Power Mode, data saver) refuse autoplay until a real tap: start it then (a scroll does not count as a tap on iPhone), and again when the tab comes back.
    const first = () => { go(); cleanup(); };
    const vis = () => { if (!document.hidden) go(); };
    const cleanup = () => { window.removeEventListener("touchend", first); window.removeEventListener("click", first); window.removeEventListener("keydown", first); };
    window.addEventListener("touchend", first, { passive: true });
    window.addEventListener("click", first, { passive: true });
    window.addEventListener("keydown", first, { passive: true });
    document.addEventListener("visibilitychange", vis);
    v.addEventListener("loadeddata", go);
    return () => { cleanup(); document.removeEventListener("visibilitychange", vis); v.removeEventListener("loadeddata", go); };
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
