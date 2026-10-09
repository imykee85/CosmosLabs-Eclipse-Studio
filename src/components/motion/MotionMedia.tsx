"use client";

import { useEffect, useRef } from "react";
import type { MotionPrompt } from "@/lib/motion";

// The picture area of a motion card. Empty tile when there is no clip yet; otherwise the poster, with the short preview
// looping muted while on screen (unless previews are paused). The detail page passes `controls` for the full clip.
export default function MotionMedia({ item, paused = false, controls = false, className = "" }: { item: MotionPrompt; paused?: boolean; controls?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = controls ? item.video ?? item.preview : item.preview ?? item.video;

  useEffect(() => {
    const v = ref.current;
    if (!v || controls) return;
    if (paused) { v.pause(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, [paused, controls, src]);

  if (!src && !item.poster) return <span className={`mo-tile ${className}`} style={{ aspectRatio: item.ratio }} />;
  return src ? (
    <video ref={ref} className={`mo-tile mo-video ${className}`} style={{ aspectRatio: item.ratio }} src={src} poster={item.poster} muted={!controls} loop={!controls} playsInline controls={controls} preload={controls ? "metadata" : "none"} aria-label={item.title} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`mo-tile mo-video ${className}`} style={{ aspectRatio: item.ratio }} src={item.poster} alt={item.title} loading="lazy" />
  );
}
