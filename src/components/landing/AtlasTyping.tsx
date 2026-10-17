"use client";

import { useEffect, useRef, useState } from "react";
import { I18N_EVENT, translateText } from "@/lib/i18n/translator";

// Beside Atlas: his art direction typed out as if live (after the owner's screen recording). Each line types, the caret blinks a moment, the line
// is deleted and the next one types. Plain text, no box, opening with a quote mark like the reference. It only runs while on screen; under reduced motion the first line shows still.
const TYPE_MS = 55, DELETE_MS = 22, HOLD_MS = 1800, GAP_MS = 400;
export default function AtlasTyping({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [shown, setShown] = useState(lines);
  const [text, setText] = useState("");
  const [still, setStill] = useState(false);

  // The text changes letter by letter, which the page translator cannot match, so each whole line is translated here.
  useEffect(() => {
    const update = () => setShown(lines.map((l) => translateText(l)));
    update();
    window.addEventListener(I18N_EVENT, update);
    return () => window.removeEventListener(I18N_EVENT, update);
  }, [lines]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setText(shown[0]); return; }
    let timer = 0, visible = false, line = 0, n = 0, deleting = false;
    const tick = () => {
      if (!visible) return;
      const full = shown[line];
      if (!deleting) {
        n++;
        setText(full.slice(0, n));
        if (n >= full.length) { deleting = true; timer = window.setTimeout(tick, HOLD_MS); return; }
        timer = window.setTimeout(tick, TYPE_MS + Math.random() * 40);
      } else {
        n--;
        setText(full.slice(0, n));
        if (n <= 0) { deleting = false; line = (line + 1) % shown.length; timer = window.setTimeout(tick, GAP_MS); return; }
        timer = window.setTimeout(tick, DELETE_MS);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) timer = window.setTimeout(tick, GAP_MS);
      if (!visible) window.clearTimeout(timer);
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [shown]);

  return (
    <p className="atl-type" ref={ref} translate="no" aria-label={shown.join(" ")}>
      <span aria-hidden="true">&ldquo;{text}<i className={still ? "is-still" : ""} /></span>
    </p>
  );
}
