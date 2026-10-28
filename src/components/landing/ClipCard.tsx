"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

// A looping clip that always starts by itself. iPhone Low Power Mode refuses to autoplay a <video>, but Safari also plays an
// MP4 placed in an <img> (muted, looping, like an animated picture), which that setting does not stop. So: try the video; if
// play() is refused, show the same MP4 as an image; only if the browser cannot draw an MP4 image (not Safari) does the poster
// show with one small play button.
export type ClipMode = "video" | "image" | "still";

export function ClipCard({ src, webm, poster, className }: { src: string; webm?: string; poster: string; className: string }) {
  const [mode, setMode] = useState<ClipMode>("video");
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (mode !== "video" || !v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    const started = v.play();
    if (started) started.catch(() => setMode("image"));
  }, [mode, setMode]);
  if (mode === "image") return <img className={className} src={src} alt="" onError={() => setMode("still")} />;
  if (mode === "still") {
    return (
      <>
        <img className={className} src={poster} alt="" />
        <button type="button" className="clip-play" aria-label="Play" onClick={(e) => { e.stopPropagation(); setMode("video"); }}><Play size={14} fill="currentColor" /></button>
      </>
    );
  }
  return (
    <video ref={ref} className={className} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true">
      <source src={src} type="video/mp4" />
      {webm && <source src={webm} type="video/webm" />}
    </video>
  );
}
