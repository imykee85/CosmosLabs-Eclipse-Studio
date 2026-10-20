"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, X } from "lucide-react";
import { useCredits } from "@/lib/use-credits";
import { fmtCredits } from "@/lib/credit-units";
import { launchConfetti, playPops } from "./confetti";

const SEEN = "eclipse-welcome-offer";

// Shown once on the dashboard to a new account that was given its welcome credits (and still has some left).
export default function WelcomeOffer({ onStart }: { onStart: () => void }) {
  const { credits } = useCredits();
  const left = credits && (credits.welcome ?? 0) > 0 && credits.balance > 0 ? credits.welcome ?? 0 : 0;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    try { if (!localStorage.getItem(SEEN)) setOpen(true); } catch { setOpen(true); }
  }, [left]);

  // Confetti falls over the whole screen, with pops, as the pop-up opens.
  // It keeps falling for a moment if the pop-up is closed (a tap that also unlocks the sound), and stops for good when the dashboard is left.
  const stops = useRef<(() => void)[]>([]);
  useEffect(() => {
    if (!open) return;
    stops.current = [launchConfetti(), playPops()];
  }, [open]);
  useEffect(() => () => stops.current.forEach((fn) => fn()), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    try { localStorage.setItem(SEEN, "1"); } catch {}
  }

  if (!open || left <= 0) return null;
  return (
    <div className="nm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="nm-card wo-card" role="dialog" aria-modal="true" aria-labelledby="wo-title">
        <button type="button" className="nm-close" aria-label="Close" onClick={close}><X size={16} /></button>
        <span className="wo-icon" aria-hidden><Gift size={26} /></span>
        <h2 id="wo-title">Welcome to Eclipse</h2>
        <p>You have {fmtCredits(left)} free credits to use on anything: images, video or voice. Make something worth keeping.</p>
        <button type="button" className="nm-create" onClick={() => { close(); onStart(); }}>Start creating</button>
      </div>
    </div>
  );
}
