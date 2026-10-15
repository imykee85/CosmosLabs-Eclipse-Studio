"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { Render } from "@/lib/use-renders";
import RenderDialog from "./RenderDialog";

const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const Caption = ({ g }: { g: Render }) => (
  <>
    <span>{g.prompt}</span>
    <span className="lib-sub">{[g.modelLabel, stamp(g.createdAt)].filter(Boolean).join(" · ")}</span>
  </>
);

// A tile's clip loads and plays only while it is on (or just about to be on) screen: a Library full of videos used to start downloading every clip at once.
function TileVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); el.play?.().catch(() => {}); } else el.pause?.();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={near ? `${src}#t=0.1` : undefined} muted loop autoPlay playsInline preload={near ? "metadata" : "none"} aria-label={label} />;
}

// One render in the Gallery or Library: the picture, or a spinner while it is still being made, or why it failed.
export default function RenderTile({ g, onChanged }: { g: Render; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  if (g.status === "completed" && g.imageUrl) {
    return (
      <>
        <button type="button" className="lib-tile" onClick={() => setOpen(true)} title="View details">
          {g.kind === "video" ? (
            // A video tile: the same fixed square as a picture; it plays muted on a loop (#t=0.1 makes iPhone Safari draw a first frame). Tapping opens the full player.
            <span className="lib-video">
              <TileVideo src={g.imageUrl} label={g.prompt} />
              {g.durationSec ? <em>{Math.round(g.durationSec)} s</em> : null}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.imageUrl} alt={g.prompt} loading="lazy" decoding="async" />
          )}
          <Caption g={g} />
        </button>
        {open && <RenderDialog g={g} onClose={() => setOpen(false)} onChanged={onChanged} />}
      </>
    );
  }
  return (
    <div className="lib-tile" title={g.error ?? undefined}>
      <div className="lib-wait">
        {g.status === "failed" ? <><AlertCircle size={26} strokeWidth={1.5} /><p>{g.error ?? (g.kind === "video" ? "This video could not be made." : "This image could not be made.")}</p></> : <><Loader2 size={26} className="cr-spin" /><p>{g.kind === "video" ? "Making your video…" : "Creating your image…"}</p></>}
      </div>
      <Caption g={g} />
    </div>
  );
}
