"use client";

import { useEffect, useState } from "react";
import { Bot, Clapperboard, FolderOpen, Layers, Wand2, X } from "lucide-react";
import { useCredits } from "@/lib/use-credits";

const DONE = "eclipse-first-tour";
const WELCOME = "eclipse-welcome-offer";
export const WELCOME_CLOSED = "eclipse-welcome-closed";

const STEPS = [
  { icon: Wand2, title: "Create", text: "Open Image Studio, Video Studio or Audio Studio, describe what you want and press Generate. Everything you make is saved to your project." },
  { icon: Clapperboard, title: "Plan", text: "Treatment turns a rough idea into a plan. Prompts writes the exact prompt for the model you pick." },
  { icon: Bot, title: "Atlas", text: "Switch Atlas on in any prompt box. He improves your prompt, sets the box for you and only generates when you press the button." },
  { icon: Layers, title: "Core", text: "Core is your creative computer: chat, skills, tools, memory and connected apps, all in one place." },
  { icon: FolderOpen, title: "Keep", text: "Library, Gallery and Assets hold everything you make and upload. Deleted items wait in the Bin until you empty it." },
];

// A short first-run tour for a new account: shown once on the dashboard, after the welcome offer has been dealt with.
export default function FirstTour() {
  const { credits } = useCredits();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    let done = false;
    try { done = !!localStorage.getItem(DONE); } catch {}
    if (done) return;
    const start = () => setOpen(true);
    let welcomeSeen = false;
    try { welcomeSeen = !!localStorage.getItem(WELCOME); } catch {}
    // The welcome offer comes first when there are free images to announce; otherwise the tour starts by itself once the balance is known.
    if (welcomeSeen || (credits && (credits.freeImages ?? 0) <= 0)) start();
    window.addEventListener(WELCOME_CLOSED, start);
    // Preview mode and signed-out visits never get a balance: start anyway unless the welcome offer is on screen.
    const t = window.setTimeout(() => { if (!credits && !document.querySelector("#wo-title")) start(); }, 2500);
    return () => { window.removeEventListener(WELCOME_CLOSED, start); window.clearTimeout(t); };
  }, [credits]);

  function close() {
    setOpen(false);
    try { localStorage.setItem(DONE, "1"); } catch {}
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;
  return (
    <div className="nm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="nm-card wo-card" role="dialog" aria-modal="true" aria-labelledby="ft-title">
        <button type="button" className="nm-close" aria-label="Close" onClick={close}><X size={16} /></button>
        <span className="wo-icon" aria-hidden><Icon size={26} /></span>
        <h2 id="ft-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="ft-dots" aria-hidden>
          {STEPS.map((_, n) => <span key={n} className={n === i ? "is-on" : ""} />)}
        </div>
        <button type="button" className="nm-create" onClick={() => (last ? close() : setI(i + 1))}>{last ? "Done" : "Next"}</button>
        {!last && <button type="button" className="ft-skip" onClick={close}>Skip</button>}
      </div>
    </div>
  );
}
