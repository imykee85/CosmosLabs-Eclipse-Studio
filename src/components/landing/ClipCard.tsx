"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

// A looping clip that starts by itself, at full quality. If the phone refuses autoplay (iPhone Low Power Mode), the poster shows
// with one small play button, and the clip starts on the visitor's first tap anywhere on the page (iPhone lets a video start
// inside a tap). The video stays on the page, hidden, so play() can be called straight from that tap.
// (Showing the MP4 in an <img> was tried and left the cards blank on iPhone.)
export type ClipMode = "video" | "still";

// Starts `videos` on the first tap, click or key press anywhere; `onPlaying` runs once they are playing. Returns a cleanup.
export function playOnFirstGesture(videos: () => HTMLVideoElement[], onPlaying: () => void): () => void {
  const events = ["touchend", "click", "keydown"] as const;
  const go = () => {
    const vids = videos();
    if (!vids.length) return;
    vids[0].play().then(() => { stop(); vids.slice(1).forEach((v) => { void v.play().catch(() => {}); }); onPlaying(); }).catch(() => {});
  };
  const stop = () => events.forEach((e) => window.removeEventListener(e, go, true));
  events.forEach((e) => window.addEventListener(e, go, true));
  return stop;
}

export function ClipCard({ src, webm, poster, className }: { src: string; webm?: string; poster: string; className: string }) {
  const [mode, setMode] = useState<ClipMode>("video");
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    let stop = () => {};
    let alive = true;
    const started = v.play();
    if (started) started.catch(() => {
      if (!alive) return;
      setMode("still");
      stop = playOnFirstGesture(() => (ref.current ? [ref.current] : []), () => setMode("video"));
    });
    return () => { alive = false; stop(); };
  }, []);
  const tap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (v) v.play().then(() => setMode("video")).catch(() => {});
  };
  return (
    <>
      <video ref={ref} className={className} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" style={mode === "still" ? { display: "none" } : undefined}>
        <source src={src} type="video/mp4" />
        {webm && <source src={webm} type="video/webm" />}
      </video>
      {mode === "still" && (
        <>
          <img className={className} src={poster} alt="" />
          <button type="button" className="clip-play" aria-label="Play" onClick={tap}><Play size={14} fill="currentColor" /></button>
        </>
      )}
    </>
  );
}
