"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Render } from "@/lib/use-renders";
import RenderDetails from "./RenderDetails";
import "./library.css";

// A finished image shown large with all of its details. Esc, the X, or a click outside closes it.
export default function RenderDialog({ g, onClose }: { g: Render; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="rd-dialog" role="dialog" aria-modal="true" aria-label="Image details" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="rd-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.imageUrl && <img src={g.imageUrl} alt={g.prompt} />}
        </div>
        <RenderDetails g={g} />
      </div>
    </div>
  );
}
