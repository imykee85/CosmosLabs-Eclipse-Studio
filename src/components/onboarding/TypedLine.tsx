"use client";

import { useEffect, useRef, useState } from "react";
import { I18N_EVENT, translateText } from "@/lib/i18n/translator";

// A line that types itself out letter by letter with a blinking caret, as if someone were writing it live (the welcome video after onboarding).
// The whole line is translated first (letter-by-letter text cannot be matched by the page translator). Under reduced motion the full line shows at once.
const START_MS = 1500, TYPE_MS = 62;
export default function TypedLine({ text }: { text: string }) {
  const [full, setFull] = useState(text);
  const [shown, setShown] = useState("");
  const [still, setStill] = useState(false);
  const fullRef = useRef(full);
  fullRef.current = full;

  useEffect(() => {
    const update = () => setFull((old) => { const next = translateText(text); return next === old ? old : next; });
    update();
    window.addEventListener(I18N_EVENT, update);
    return () => window.removeEventListener(I18N_EVENT, update);
  }, [text]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    let timer = 0, n = 0;
    const tick = () => {
      n++;
      setShown(fullRef.current.slice(0, n));
      if (n < fullRef.current.length) timer = window.setTimeout(tick, TYPE_MS + Math.random() * 45);
    };
    timer = window.setTimeout(tick, START_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const out = still ? full : shown;
  return (
    <p className="ob-typed" translate="no" aria-label={full}>
      <span aria-hidden="true">{out}<i className={still || out.length >= full.length ? "is-idle" : ""} /></span>
    </p>
  );
}
