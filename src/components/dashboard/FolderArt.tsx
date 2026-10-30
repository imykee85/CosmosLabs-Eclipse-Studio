"use client";

import { useEffect, useState } from "react";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";

type Sheet = { id: string; url: string; video: boolean };
const cache = new Map<string, Sheet[]>();

// The folder picture in layers: back, the project's last two Gallery items peeking out like sheets of paper, then the front panel.
export default function FolderArt({ projectId, sheets }: { projectId: string; sheets: boolean }) {
  const [items, setItems] = useState<Sheet[]>(() => cache.get(projectId) ?? []);
  useEffect(() => {
    if (!sheets || cache.has(projectId)) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/generations?projectId=${encodeURIComponent(projectId)}&limit=8`);
        const d = r.ok ? await r.json() : { items: [] };
        const got: Sheet[] = (d.items ?? [])
          .filter((g: { status?: string; imageUrl?: string | null }) => g.imageUrl && (!g.status || g.status === "completed"))
          .slice(0, 2)
          .map((g: { id: string; imageUrl: string; kind?: string }) => ({ id: g.id, url: g.imageUrl, video: g.kind === "video" }));
        cache.set(projectId, got);
        if (live) setItems(got);
      } catch {}
    })();
    return () => { live = false; };
  }, [projectId, sheets]);

  // Older item behind, newest in front; tilt picked from the project id so it stays the same on every visit.
  const flip = projectId.charCodeAt(projectId.length - 1) % 2 ? 1 : -1;
  const shown = sheets ? items : [];
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="fa-back" src="/dashboard/folder.webp" alt="" aria-hidden="true" draggable={false} />
      {shown.slice().reverse().map((s, i, all) => {
        const front = i === all.length - 1;
        return (
          <span key={s.id} className="fa-sheet" style={{ transform: `rotate(${(front ? 3 : -5) * flip}deg)`, left: front ? "17%" : "12%", top: front ? "-7%" : "-4%" }}>
            {s.video
              ? <video src={`${s.url}#t=0.1`} muted playsInline preload="metadata" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={thumbOf("render", s.id)} onError={fallbackTo(s.url)} alt="" loading="lazy" decoding="async" draggable={false} />}
          </span>
        );
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="fa-front" src="/dashboard/folder-front.webp" alt="" aria-hidden="true" draggable={false} />
    </>
  );
}
