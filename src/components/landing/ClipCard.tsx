"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

// A looping clip that starts by itself. If the phone will not start it (Low Power Mode or another autoplay block), the poster
// picture shows with one small play button instead, so no phone draws its own big play button over the card. One tap plays it.
export function ClipCard({ src, webm, poster, className }: { src: string; webm: string; poster: string; className: string }) {
  const [still, setStill] = useState(false);
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    const started = v.play();
    if (started) started.catch(() => setStill(true));
  }, [still]);
  if (still) {
    return (
      <>
        <img className={className} src={poster} alt="" />
        <button type="button" className="clip-play" aria-label="Play" onClick={(e) => { e.stopPropagation(); setStill(false); }}><Play size={14} fill="currentColor" /></button>
      </>
    );
  }
  return (
    <video ref={ref} className={className} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true">
      <source src={src} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  );
}
