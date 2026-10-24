"use client";

import { useEffect } from "react";
import { Box, Check, Video } from "lucide-react";
import SoonTag from "../SoonTag";

export type MotionMode = "subject" | "scene";

const MODES: { id: MotionMode; title: string; text: string; icon: typeof Video; soon?: boolean }[] = [
  { id: "subject", title: "Motion + subject", text: "Moves your subject picture like the person in one of your clips (Kling Motion Control or Genjutsu), or changes what is in a video you made (Eclone).", icon: Video },
  { id: "scene", title: "3D scene", text: "You block the shot yourself: several shots, camera placed where you want it. Needs character and location pictures.", icon: Box, soon: true },
];

// Pop-up above the Motion chip: how the reference clip should steer the video. Choose the same one again to clear it.
export default function MotionMenu({ anchor, selected, onPick, onClose }: { anchor: DOMRect; selected: MotionMode | null; onPick: (m: MotionMode | null) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = Math.min(320, window.innerWidth - 16);
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  return (
    <>
      <div className="am-scrim" onMouseDown={onClose} onTouchStart={onClose} />
      <div className="am-menu vs-motionmenu" role="menu" aria-label="Motion" style={{ left, width, bottom: window.innerHeight - anchor.top + 8 }}>
        {MODES.map(({ id, title, text, icon: Icon, soon }) => (
          <button key={id} type="button" role="menuitemradio" aria-checked={selected === id} className="am-item" onClick={() => { onPick(selected === id ? null : id); onClose(); }}>
            <Icon size={16} />
            <span><b>{title}{soon && <SoonTag />}</b><small>{text}</small></span>
            {selected === id && <Check size={15} className="am-check" />}
          </button>
        ))}
      </div>
    </>
  );
}
