"use client";

import { useEffect, useRef } from "react";
import type { MotionPrompt } from "@/lib/motion";

// Just the video, no post around it. In the feed the short preview loops muted while it is on screen (unless previews are
// paused); on the detail page `controls` plays the full clip with the browser's own controls. With no video the card is an empty tile.
export default function MotionMedia({ item, paused = false, controls = false }: { item: MotionPrompt; paused?: boolean; controls?: boolean }) {
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

  if (!src) return <span className="mo-tile" style={{ aspectRatio: item.ratio ?? "16 / 9" }} />;
  return <video ref={ref} className="mo-tile mo-video" style={{ aspectRatio: item.ratio ?? "16 / 9" }} src={src} poster={item.poster} muted={!controls} loop={!controls} playsInline controls={controls} preload={controls ? "metadata" : "none"} aria-label={item.title} />;
}
