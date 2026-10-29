"use client";

import { useEffect, useState } from "react";
import "./subscribe-alert.css";

// A "Continue or cancel" question drawn in the page. The browser's own confirm box can be switched off (iPhone Safari offers "prevent more dialogs") or hidden
// (in-app browsers), and then it answers "no" without anyone seeing it, so a paid action looked like it did nothing. Use askConfirm instead of window.confirm.
const EVENT = "eclipse-confirm";
type Ask = { message: string; yes: string; no: string; resolve: (ok: boolean) => void };
declare global { interface Window { __eclipseConfirmHost?: boolean } }

export function askConfirm(message: string, yes = "Continue", no = "Cancel"): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (!window.__eclipseConfirmHost) return resolve(window.confirm(message));
    window.dispatchEvent(new CustomEvent<Ask>(EVENT, { detail: { message, yes, no, resolve } }));
  });
}

export default function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    window.__eclipseConfirmHost = true;
    const on = (e: Event) => setAsk((prev) => { prev?.resolve(false); return (e as CustomEvent<Ask>).detail; });
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); window.__eclipseConfirmHost = false; };
  }, []);

  const answer = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { ask.resolve(false); setAsk(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  if (!ask) return null;
  return (
    <div className="sa-back" onMouseDown={(e) => { if (e.target === e.currentTarget) answer(false); }}>
      <div className="sa-card" role="alertdialog" aria-modal="true" aria-label={ask.message}>
        <p>{ask.message}</p>
        <button type="button" className="sa-go" autoFocus onClick={() => answer(true)}>{ask.yes}</button>
        <button type="button" className="sa-no" onClick={() => answer(false)}>{ask.no}</button>
      </div>
    </div>
  );
}
