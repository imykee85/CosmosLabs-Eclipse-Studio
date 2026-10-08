"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { readCurrentProject } from "@/lib/projects";
import "./library.css";

type Render = { id: string; prompt: string; imageUrl: string };

// This project's renders only, newest first (the Library shows renders from every project). Links are short-lived and signed, so the list is fetched fresh each visit.
export default function GalleryView() {
  const [items, setItems] = useState<Render[] | null>(null);

  useEffect(() => {
    let live = true;
    const projectId = readCurrentProject()?.id;
    if (!projectId) { setItems([]); return; }
    fetch(`/api/generations?limit=100&projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);

  return (
    <div className="ws-ing lib">
      <h1>Gallery</h1>
      <p>Everything you have generated in this project, newest first.</p>
      {items && items.length > 0 ? (
        <div className="lib-grid">
          {items.map((g) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={g.id} className="lib-tile" href={g.imageUrl} target="_blank" rel="noreferrer"><img src={g.imageUrl} alt={g.prompt} loading="lazy" /><span>{g.prompt}</span></a>
          ))}
        </div>
      ) : items ? (
        <div className="lib-empty">
          <ImageIcon size={46} strokeWidth={1.4} aria-hidden="true" />
          <h2>Nothing here yet</h2>
          <p>Images you generate in this project appear here. Renders from all projects are in the Library.</p>
        </div>
      ) : null}
    </div>
  );
}
