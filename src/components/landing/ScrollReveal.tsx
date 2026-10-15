"use client";

import { useEffect, useRef, useState } from "react";
import { I18N_EVENT, translateText } from "@/lib/i18n/translator";

// A paragraph whose words start faint and turn solid one after another as it scrolls up through the middle of the screen.
// Progress is 0 when the top of the paragraph is 85% of the way down the screen and 1 once its bottom reaches 45%. Under reduced motion every word is solid at once.
export default function ScrollReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // The sentence is split into one span per word, which the page translator cannot match, so the whole sentence is translated here (and again if the language arrives later).
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const update = () => setShown(translateText(text));
    update();
    window.addEventListener(I18N_EVENT, update);
    return () => window.removeEventListener(I18N_EVENT, update);
  }, [text]);
  const words = shown.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("span[data-w]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85, end = vh * 0.45;
      const p = reduce ? 1 : Math.max(0, Math.min(1, (start - r.top) / (start - end + r.height)));
      spans.forEach((s, i) => {
        const t = i / Math.max(1, spans.length - 1);
        const a = Math.max(0, Math.min(1, (p - t * 0.8) / 0.2));
        s.style.opacity = String(0.15 + 0.85 * a);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [shown]);

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} data-w style={{ opacity: 0.15, transition: "opacity 120ms linear" }}>{w}{" "}</span>
      ))}
    </p>
  );
}
