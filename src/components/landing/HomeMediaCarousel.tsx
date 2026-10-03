"use client";

import { useEffect, useRef, useState } from "react";
import { carouselItems, type CarouselItem } from "./carouselItems";

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
      <div className="carousel-card relative w-full overflow-hidden bg-black">
        {failed ? (
          // Placeholder until the file is added to public/carousel/
          <div className={`tile tone-${index % 8} absolute inset-0 h-full`} style={{ borderRadius: 0 }} />
        ) : item.type === "video" ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
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
            className="absolute inset-0 h-full w-full object-cover"
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

  return (
    <div ref={rootRef} className="carousel-root relative z-[1] mx-auto mt-16 overflow-hidden bg-black" aria-label="Examples of generated content">
      <style>{`
        /* No viewport units and no JS measuring: width comes from the container (%), height from
           aspect-ratio, so a card is always exactly 9:16 at any browser zoom level. */
        .carousel-root { width: 100%; max-width: 1152px; }
        .carousel-card { aspect-ratio: 9 / 16; height: auto; border-radius: 10% / 5.6%; }
        .carousel-track { align-items: flex-start; }
        .carousel-slide { padding: 0 0.52%; }
        @keyframes glide { to { transform: translateX(calc(-100% * 14 / 6)); } }
        .carousel-track { display: flex; width: 200%; animation: glide 100s linear infinite; pointer-events: none; }
        .carousel-slide { flex: 0 0 calc(100% / 6); }
        @media (prefers-reduced-motion: reduce) { .carousel-track { animation: none; } }
      `}</style>
      <div className="carousel-track">
        {[...carouselItems, ...carouselItems].map((item, i) => (
          <Slide key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
