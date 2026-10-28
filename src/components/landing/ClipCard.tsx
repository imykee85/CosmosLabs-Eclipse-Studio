"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { decodeLoop } from "./clip-decode";

// A looping clip that starts by itself, at full quality. If the phone refuses to start the video (iPhone Low Power Mode), the clip
// is decoded and painted on a canvas instead (clip-decode.ts). If that is not possible either, the poster shows with one small
// play button, and a tap plays the video.
type Mode = "video" | "decode" | "still";

export function ClipCard({ src, webm, poster, className }: { src: string; webm?: string; poster: string; className: string }) {
  const [mode, setMode] = useState<Mode>("video");
  const ref = useRef<HTMLVideoElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (mode !== "video" || !v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    const started = v.play();
    if (started) started.catch(() => setMode("decode"));
  }, [mode]);

  useEffect(() => {
    if (mode !== "decode") return;
    const c = canvas.current;
    let stop: (() => void) | null = null;
    let alive = true;
    if (!c) return;
    import("mp4box")
      .then((m) => {
        if (!alive) return;
        stop = decodeLoop((m as any).default ?? m, src, c, () => setMode("still"));
        if (!stop) setMode("still");
      })
      .catch(() => { if (alive) setMode("still"); });
    return () => { alive = false; stop?.(); };
  }, [mode, src]);

  if (mode === "still") {
    return (
      <>
        <img className={className} src={poster} alt="" />
        <button type="button" className="clip-play" aria-label="Play" onClick={(e) => { e.stopPropagation(); setMode("video"); }}><Play size={14} fill="currentColor" /></button>
      </>
    );
  }
  if (mode === "decode") {
    return (
      <>
        <img className={className} src={poster} alt="" />
        <canvas ref={canvas} className={className} aria-hidden="true" />
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
