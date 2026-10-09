"use client";

import { useEffect, useRef } from "react";
import type { MotionPrompt } from "@/lib/motion";

// Just the video, no post around it. In the feed the short preview loops muted all the time, on screen or not (unless previews are
// paused); on the detail page `controls` plays the full clip with the browser's own controls.
export default function MotionMedia({ item, paused = false, controls = false }: { item: MotionPrompt; paused?: boolean; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = controls ? item.video : item.preview;

  // Previews play as soon as they load, whether or not they are on screen; the play/pause button in the feed stops and restarts all of them.
  useEffect(() => {
    const v = ref.current;
    if (!v || controls) return;
    if (paused) v.pause(); else v.play().catch(() => {});
  }, [paused, controls, src]);

  return <video ref={ref} className="mo-tile mo-video" style={{ aspectRatio: item.ratio }} src={src} poster={item.poster} muted={!controls} loop={!controls} autoPlay={!controls && !paused} playsInline controls={controls} preload={controls ? "metadata" : "auto"} {...({ referrerPolicy: "no-referrer" } as object)} aria-label={item.title} />;
}
