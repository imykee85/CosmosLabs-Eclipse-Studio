"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { postUrl, type MotionPrompt } from "@/lib/motion";

// A post on X shown through X's own embed, so the video plays in X's player and stays credited to its creator. The embed
// script is loaded once, and each post is only built when it scrolls near the screen. Until it appears (or if it cannot load,
// for example when the post was deleted or the script is blocked) the card is an empty tile with a link to the post.
type Twttr = { widgets: { createTweet: (id: string, el: HTMLElement, o: Record<string, unknown>) => Promise<HTMLElement | undefined> } };
declare global { interface Window { twttr?: Twttr } }

let loader: Promise<Twttr | null> | null = null;
function loadX(): Promise<Twttr | null> {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  loader ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js"; s.async = true;
    s.onload = () => resolve(window.twttr ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loader;
}

export default function XPost({ item, large = false }: { item: MotionPrompt; large?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "failed">("idle");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const build = async () => {
      const x = await loadX();
      if (cancelled) return;
      if (!x) { setState("failed"); return; }
      const light = document.documentElement.getAttribute("data-app-theme") === "light";
      const made = await x.widgets.createTweet(item.xId, el, { theme: light ? "light" : "dark", conversation: "none", dnt: true, align: "center", width: large ? 550 : 330 }).catch(() => undefined);
      if (cancelled) return;
      setState(made ? "ready" : "failed");
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); build(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [item.xId, large]);

  return (
    <div className={`mo-x ${state === "ready" ? "is-ready" : ""}`}>
      <div ref={box} className="mo-x-embed" />
      {state !== "ready" && (
        <a className="mo-x-fallback mo-tile" style={{ aspectRatio: item.ratio }} href={postUrl(item)} target="_blank" rel="noopener noreferrer">
          <span>{state === "failed" ? "Could not load this post here" : "Loading post…"}</span>
          <small>View on X <ExternalLink size={12} /></small>
        </a>
      )}
    </div>
  );
}
