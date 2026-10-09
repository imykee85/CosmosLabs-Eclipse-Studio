"use client";

import { useEffect, useRef, useState } from "react";
import type { MotionPrompt } from "@/lib/motion";

// Just the video, no post around it. In the feed the short preview loops muted while it is on screen (unless previews are
// paused); on the detail page `controls` plays the full clip with the browser's own controls. Entries that only carry the
// post id ask `/api/motion/video` for the video when they come near the screen; if none can be found the tile says so.
type Found = { poster?: string; preview?: string; video?: string; ratio?: MotionPrompt["ratio"] };
const memo = new Map<string, Found | null>();
let inFlight = 0;
const waiting: (() => void)[] = [];
const MAX_PARALLEL = 4;

function lookup(id: string): Promise<Found | null> {
  if (memo.has(id)) return Promise.resolve(memo.get(id) ?? null);
  return new Promise((resolve) => {
    const run = async () => {
      inFlight++;
      try {
        const res = await fetch(`/api/motion/video?id=${id}`);
        const data: Found | null = res.ok ? await res.json() : null;
        memo.set(id, data); resolve(data);
      } catch { resolve(null); }
      finally { inFlight--; waiting.shift()?.(); }
    };
    if (inFlight < MAX_PARALLEL) run(); else waiting.push(run);
  });
}

export default function MotionMedia({ item, paused = false, controls = false }: { item: MotionPrompt; paused?: boolean; controls?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const known = !!(item.video || item.preview);
  const [found, setFound] = useState<Found | null>(() => memo.get(item.xId) ?? null);
  const [failed, setFailed] = useState(() => memo.get(item.xId) === null);

  useEffect(() => {
    if (known || found || failed) return;
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      lookup(item.xId).then((f) => { if (cancelled) return; if (f) setFound(f); else setFailed(true); });
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [known, found, failed, item.xId]);

  const media = known ? item : found;
  const src = media ? (controls ? media.video ?? media.preview : media.preview ?? media.video) : undefined;
  const ratio = item.ratio ?? found?.ratio ?? "16 / 9";

  useEffect(() => {
    const v = ref.current;
    if (!v || controls) return;
    if (paused) { v.pause(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, [paused, controls, src]);

  if (!src) return <div ref={box} className="mo-tile mo-empty-tile" style={{ aspectRatio: ratio }}>{failed ? <span>Video not available here</span> : null}</div>;
  return <video ref={ref} className="mo-tile mo-video" style={{ aspectRatio: ratio }} src={src} poster={media?.poster} muted={!controls} loop={!controls} playsInline controls={controls} preload={controls ? "metadata" : "none"} {...({ referrerPolicy: "no-referrer" } as object)} aria-label={item.title ?? `@${item.handle}`} />;
}
