"use client";

import { useEffect } from "react";

// The homepage pictures and clips are Eclipse's own work. This makes saving them hard for an ordinary visitor: no right-click "Save image" or "Save video"
// menu, no dragging a picture out of the page, no long-press save sheet on iPhone (the styles at the end of landing.css), and clips never offer a download
// button or Picture-in-Picture. It cannot stop a screenshot, a screen recording or someone who reads the page's network traffic: the browser has to receive
// the file to show it. Nothing here touches text, links, buttons or forms.
const MEDIA = "img, video, picture, .tile, .card-collage, .wow-carousel, .results-wall, .audience-card, .hero-video, .strip-logo";

export default function ProtectMedia() {
  useEffect(() => {
    const root = document.querySelector("main.site-shell");
    if (!root) return;
    const block = (e: Event) => {
      const t = e.target as Element | null;
      if (t && t.closest && t.closest(MEDIA)) e.preventDefault();
    };
    root.addEventListener("contextmenu", block);
    root.addEventListener("dragstart", block);
    return () => { root.removeEventListener("contextmenu", block); root.removeEventListener("dragstart", block); };
  }, []);
  return null;
}
