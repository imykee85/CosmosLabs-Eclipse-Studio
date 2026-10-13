"use client";

import { useEffect } from "react";
import { Check, X } from "lucide-react";
import type { RefPick } from "../create/ReferencePicker";
import { useRenders } from "@/lib/use-renders";
import "../uploads/uploads.css";

// Reference clips: the person's own finished videos (the model follows their motion, look or action). Same dialog look as the picture picker.
// A chosen clip carries its recorded length (seconds), which motion transfer prices and checks by.
export type ClipPick = RefPick & { sec?: number | null };

export default function VideoRefPicker({ max, picked, onChange, onClose, title = "reference clips" }: { max: number; picked: ClipPick[]; onChange: (next: ClipPick[]) => void; onClose: () => void; title?: string }) {
  const { renders } = useRenders(undefined, 60);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const videos = (renders ?? []).filter((g) => g.kind === "video" && g.status === "completed" && g.imageUrl);
  const has = (id: string) => picked.some((p) => p.id === id);
  function toggle(id: string, url: string, label: string, sec: number | null) {
    if (has(id)) onChange(picked.filter((p) => p.id !== id));
    else if (picked.length < max) onChange([...picked, { type: "render", id, url, label, sec }]);
  }
  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog rp-dialog" role="dialog" aria-modal="true" aria-label={`Choose ${title}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Choose {title}</h2>
        <p className="rp-note">Choose up to {max} of your finished videos. The model uses them as a reference for your prompt (call them video 1, video 2…). <b>{picked.length} of {max}</b> chosen.</p>
        {renders === null ? <p className="rp-note">Loading…</p> : videos.length === 0 ? (
          <p className="rp-note">You have no finished videos yet. Make one in Video Studio first.</p>
        ) : (
          <div className="rp-grid">
            {videos.map((g) => {
              const on = has(g.id);
              return (
                <button key={g.id} type="button" className={`rp-item ${on ? "is-on" : ""}`} aria-pressed={on} disabled={!on && picked.length >= max} onClick={() => toggle(g.id, g.imageUrl ?? "", g.prompt, g.durationSec ?? null)} title={g.prompt}>
                  <video src={g.imageUrl ?? undefined} muted playsInline preload="metadata" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", border: `2px solid ${on ? "#c00707" : "var(--a-line2)"}`, borderRadius: 16, background: "var(--a-card)" }} />
                  {on && <span className="rp-check"><Check size={14} /></span>}
                  <span className="rp-name">{g.prompt}</span><small>{g.modelLabel ?? "Video"}</small>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="ws-add" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
