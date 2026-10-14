"use client";

import { useEffect, useRef } from "react";

// An empty strip under a grid: when it scrolls near the screen it asks for the next page, so a large Library or Gallery opens fast and fills in as you scroll.
export default function MoreSentinel({ active, onMore }: { active: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) onMore(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [active, onMore]);
  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}
