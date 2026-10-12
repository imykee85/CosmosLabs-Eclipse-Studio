"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";
import type { Render } from "@/lib/use-renders";
import RenderDialog from "./RenderDialog";

const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const Caption = ({ g }: { g: Render }) => (
  <>
    <span>{g.prompt}</span>
    <span className="lib-sub">{[g.modelLabel, stamp(g.createdAt)].filter(Boolean).join(" · ")}</span>
  </>
);

// One render in the Gallery or Library: the picture, or a spinner while it is still being made, or why it failed.
export default function RenderTile({ g, onChanged }: { g: Render; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const ratio = (g.aspectRatio ?? "1:1").replace(":", " / ");
  if (g.status === "completed" && g.imageUrl) {
    return (
      <>
        <button type="button" className="lib-tile" onClick={() => setOpen(true)} title="View details">
          {g.kind === "video" ? (
            // A video tile: the first frame (#t=0.1 makes iPhone Safari draw one), playing muted while the pointer is over it. Tapping opens the full player.
            <span className="lib-video">
              <video src={`${g.imageUrl}#t=0.1`} muted playsInline preload="metadata" aria-label={g.prompt}
                onMouseEnter={(e) => { void e.currentTarget.play().catch(() => {}); }} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0.1; }} />
              <i className="lib-play" aria-hidden="true"><Play size={14} /></i>
              {g.durationSec ? <em>{Math.round(g.durationSec)} s</em> : null}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.imageUrl} alt={g.prompt} loading="lazy" />
          )}
          <Caption g={g} />
        </button>
        {open && <RenderDialog g={g} onClose={() => setOpen(false)} onChanged={onChanged} />}
      </>
    );
  }
  return (
    <div className="lib-tile" title={g.error ?? undefined}>
      <div className="lib-wait" style={{ aspectRatio: ratio }}>
        {g.status === "failed" ? <><AlertCircle size={26} strokeWidth={1.5} /><p>{g.error ?? (g.kind === "video" ? "This video could not be made." : "This image could not be made.")}</p></> : <><Loader2 size={26} className="cr-spin" /><p>{g.kind === "video" ? "Making your video…" : "Creating your image…"}</p></>}
      </div>
      <Caption g={g} />
    </div>
  );
}
