"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";

// The "Why Eclipse?" button on the hero: opens the film in a pop-up and plays it. Closes with the X, Escape or a tap outside.
export default function WhyVideo() {
  const [open, setOpen] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    vid.current?.play().catch(() => {});
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button type="button" className="hero-why" onClick={() => setOpen(true)}><Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />Why Eclipse?</button>
      {open && createPortal(
        <div className="why-back" role="dialog" aria-modal="true" aria-label="Why Eclipse" onClick={() => setOpen(false)}>
          <div className="why-box" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="why-x" aria-label="Close" onClick={() => setOpen(false)}><X size={20} /></button>
            <video ref={vid} className="why-video" src="/landing/why-eclipse.mp4" poster="/landing/why-eclipse-poster.jpg" controls autoPlay playsInline preload="metadata" />
          </div>
        </div>,
        document.body)}
    </>
  );
}
