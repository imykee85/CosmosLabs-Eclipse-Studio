"use client";

import { useState } from "react";
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

// One render in the Gallery or Library: the picture, or a spinner while it is still being made, or why it failed.
export default function RenderTile({ g, onChanged }: { g: Render; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const ratio = (g.aspectRatio ?? "1:1").replace(":", " / ");
  if (g.status === "completed" && g.imageUrl) {
    return (
      <>
        <button type="button" className="lib-tile" onClick={() => setOpen(true)} title="View details">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.imageUrl} alt={g.prompt} loading="lazy" /><Caption g={g} />
        </button>
        {open && <RenderDialog g={g} onClose={() => setOpen(false)} onChanged={onChanged} />}
      </>
    );
  }
  return (
    <div className="lib-tile" title={g.error ?? undefined}>
      <div className="lib-wait" style={{ aspectRatio: ratio }}>
        {g.status === "failed" ? <><AlertCircle size={26} strokeWidth={1.5} /><p>{g.error ?? "This image could not be made."}</p></> : <><Loader2 size={26} className="cr-spin" /><p>Creating your image…</p></>}
      </div>
      <Caption g={g} />
    </div>
  );
}
