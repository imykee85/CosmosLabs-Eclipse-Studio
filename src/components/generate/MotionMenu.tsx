"use client";

import { useEffect } from "react";
import { Check, Clapperboard, Video } from "lucide-react";

export type MotionMode = "subject" | "scene" | "moves";

const MODES: { id: MotionMode; title: string; text: string; icon: typeof Video; soon?: boolean }[] = [
  { id: "subject", title: "Motion + subject", text: "Moves your subject picture like the person in one of your clips (Kling Motion Control or Genjutsu), or changes what is in a video you made (Eclone).", icon: Video },
  { id: "moves", title: "ShotMap · Moves", text: "One camera with move pickers and sliders: pick a move, set the angle, distance, speed and lens, then generate from the guide video.", icon: Clapperboard },
  { id: "scene", title: "ShotMap · Keyframes", text: "A full 3D scene editor: build the set, place the camera and set its keyframes on a timeline, then generate from the guide video.", icon: Clapperboard },
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
        {MODES.map(({ id, title, text, icon: Icon }) => (
          <button key={id} type="button" role="menuitemradio" aria-checked={selected === id} className="am-item" onClick={() => { onPick(selected === id ? null : id); onClose(); }}>
            <Icon size={16} />
            <span><b>{title}</b><small>{text}</small></span>
            {selected === id && <Check size={15} className="am-check" />}
          </button>
        ))}
      </div>
    </>
  );
}
