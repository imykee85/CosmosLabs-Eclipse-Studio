"use client";

import { useEffect, useRef, useState } from "react";
import { carouselItems, type CarouselItem } from "./carouselItems";

const tryPlay = (video: HTMLVideoElement) => {
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute("muted", "");
  video.play()?.catch(() => {});
};

// A video that fails to load (a dropped or throttled phone connection is enough) is tried again a few times, each time with a fresh <video>,
// and only then replaced: by its still frame when it has one, else by the colour tile. It never gives up on the first hiccup.
const RETRY_DELAYS_MS = [1500, 3000, 6000, 10000];

function Slide({ item, index, active }: { item: CarouselItem; index: number; active: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onFail = () => {
    if (item.type !== "video") { setFailed(true); return; }
    if (timer.current) return; // one retry at a time (the video and its source both report an error)
    if (attempt >= RETRY_DELAYS_MS.length) { setFailed(true); return; }
    timer.current = setTimeout(() => { timer.current = null; setAttempt((a) => a + 1); }, RETRY_DELAYS_MS[attempt]);
  };

  return (
    <div className="carousel-slide flex justify-center" data-i={index}>
      <div className="carousel-card relative w-full overflow-hidden bg-black">
        {failed ? (
          item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            // Placeholder until the file is added to public/carousel/
            <div className={`tile tone-${index % 8} absolute inset-0 h-full`} style={{ borderRadius: 0 }} />
          )
        ) : item.type === "video" && !active ? (
          // Off screen: only the still frame. Phones (iPhone Safari above all) can decode just a few videos at once, so a video exists only while its card is near the screen.
          item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null
        ) : item.type === "video" ? (
          <video
            key={attempt}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={item.poster}
            className="absolute inset-0 h-full w-full object-cover"
            onLoadedMetadata={(e) => tryPlay(e.currentTarget)}
            onCanPlay={(e) => tryPlay(e.currentTarget)}
            onLoadedData={(e) => tryPlay(e.currentTarget)}
            onError={onFail}
          >
            <source src={item.src} type="video/mp4" onError={onFail} />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={`Example creation ${(index % carouselItems.length) + 1}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading={index < 6 ? "eager" : "lazy"}
            decoding="async"
            onError={onFail}
          />
        )}
      </div>
    </div>
  );
}

export default function HomeMediaCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Which cards are on (or just beside) the screen. Only those get a playing <video>; see Slide.
  const [near, setNear] = useState<Set<number>>(() => new Set());

  // Keep muted autoplay running: retry on load, resume and visibility changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const playAll = () => root.querySelectorAll<HTMLVideoElement>("video").forEach(tryPlay);

    playAll();
    const timers = [100, 300, 700, 1500, 3000, 6000].map((d) => window.setTimeout(playAll, d));
    const interval = window.setInterval(playAll, 2000);
    document.addEventListener("visibilitychange", playAll);
    window.addEventListener("pageshow", playAll);

    // Watch the cards against the carousel's own frame, a little wider than the frame so a card starts loading just before it slides in.
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => setNear((prev) => {
              const next = new Set(prev);
              for (const e of entries) {
                const i = Number((e.target as HTMLElement).dataset.i);
                if (e.isIntersecting) next.add(i); else next.delete(i);
              }
              return next;
            }),
            { root, rootMargin: "0px 25% 0px 25%", threshold: 0 },
          )
        : null;
    if (observer) root.querySelectorAll(".carousel-slide").forEach((el) => observer.observe(el));
    else setNear(new Set(carouselItems.flatMap((_, i) => [i, i + carouselItems.length]))); // no observer: behave as before

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
          <Slide key={i} item={item} index={i} active={near.has(i)} />
        ))}
      </div>
    </div>
  );
}
