"use client";

import { useEffect, useRef, useState } from "react";
import { carouselItems, type CarouselItem } from "./carouselItems";

const SLIDE_W = 384; // px per slide (368px card + 8px padding each side); 3 slides visible
const CARD_H = Math.round(((SLIDE_W - 16) * 16) / 9); // 9:16 card

const tryPlay = (video: HTMLVideoElement) => {
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute("muted", "");
  video.play()?.catch(() => {});
};

function Slide({ item, index }: { item: CarouselItem; index: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="carousel-slide flex justify-center">
      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ height: CARD_H }}>
        {failed ? (
          // Placeholder until the file is added to public/carousel/
          <div className={`tile tone-${index % 8} h-full`} style={{ borderRadius: 0 }} />
        ) : item.type === "video" ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
            onLoadedMetadata={(e) => tryPlay(e.currentTarget)}
            onCanPlay={(e) => tryPlay(e.currentTarget)}
            onLoadedData={(e) => tryPlay(e.currentTarget)}
            onError={() => setFailed(true)}
          >
            <source src={item.src} type="video/mp4" onError={() => setFailed(true)} />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={`Example creation ${(index % carouselItems.length) + 1}`}
            className="h-full w-full object-cover"
            loading={index < 3 ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

export default function HomeMediaCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep muted autoplay running: retry on load, resume and visibility changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    const playAll = () => videos.forEach(tryPlay);

    playAll();
    const timers = [100, 300, 700, 1500, 3000, 6000].map((d) => window.setTimeout(playAll, d));
    const interval = window.setInterval(playAll, 2000);
    document.addEventListener("visibilitychange", playAll);
    window.addEventListener("pageshow", playAll);

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => entries.forEach((e) => e.isIntersecting && tryPlay(e.target as HTMLVideoElement)),
            { threshold: 0.01 },
          )
        : null;
    videos.forEach((v) => observer?.observe(v));

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", playAll);
      window.removeEventListener("pageshow", playAll);
      observer?.disconnect();
    };
  }, []);

  const n = carouselItems.length;

  // Fixed geometry: the carousel is the same size at every screen width. Narrow
  // screens simply see less of it, clipped equally on both sides.
  return (
    <div className="carousel-frame z-[1] mt-16" aria-label="Examples of generated content">
      <div ref={rootRef} className="carousel-viewport overflow-hidden bg-black">
        <style>{`
          .carousel-frame { position: relative; width: 100%; height: ${CARD_H}px; }
          .carousel-viewport { position: absolute; left: 50%; width: ${SLIDE_W * 3}px; transform: translateX(-50%); }
          @keyframes glide { to { transform: translateX(-${SLIDE_W * n}px); } }
          .carousel-track { display: flex; width: max-content; animation: glide 100s linear infinite; pointer-events: none; }
          .carousel-slide { flex: 0 0 ${SLIDE_W}px; width: ${SLIDE_W}px; padding: 0 8px; }
          @media (prefers-reduced-motion: reduce) { .carousel-track { animation: none; } }
        `}</style>
        <div className="carousel-track">
          {[...carouselItems, ...carouselItems].map((item, i) => (
            <Slide key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
