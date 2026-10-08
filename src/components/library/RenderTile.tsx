"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { Render } from "@/lib/use-renders";

// One render in the Gallery or Library: the picture, or a spinner while it is still being made, or why it failed.
export default function RenderTile({ g }: { g: Render }) {
  const ratio = (g.aspectRatio ?? "1:1").replace(":", " / ");
  if (g.status === "completed" && g.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <a className="lib-tile" href={g.imageUrl} target="_blank" rel="noreferrer"><img src={g.imageUrl} alt={g.prompt} loading="lazy" /><span>{g.prompt}</span></a>
    );
  }
  return (
    <div className="lib-tile" title={g.error ?? undefined}>
      <div className="lib-wait" style={{ aspectRatio: ratio }}>
        {g.status === "failed" ? <><AlertCircle size={26} strokeWidth={1.5} /><p>{g.error ?? "This image could not be made."}</p></> : <><Loader2 size={26} className="cr-spin" /><p>Creating your image…</p></>}
      </div>
      <span>{g.prompt}</span>
    </div>
  );
}
